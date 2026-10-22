/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Share purchases are buyer-signed, paid transactions.
 *
 * `prepare` returns an unsigned `purchase_shares` transaction, the buyer signs
 * and submits it, and `confirm` records it only after verifying it on Soroban
 * RPC. No path in this flow signs with the admin key or calls mint_shares.
 *
 * The file has two parts:
 *  - StellarService.verifyPurchaseTransaction, exercised against a fake RPC
 *    server with real XDR envelopes and events (no database needed).
 *  - PropertyController.prepareBuyShares / confirmBuyShares, exercised against
 *    a real database with the RPC layer stubbed on the service singleton.
 */
import { afterEach, beforeEach, describe, expect, it, beforeAll } from 'bun:test';
import {
  Account,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  xdr,
} from '@stellar/stellar-sdk';
import { PropertyController } from '../controllers/PropertyController';
import { stellarService, StellarService } from '../services/StellarService';
import { propertyRepository } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { kycRepository } from '../repositories/KYCRepository';
import { db } from '../db';
import { properties, shareOwnerships, transactions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  formatTokenUnits,
  pricePerShareToTokenUnits,
  purchaseTotalToTokenUnits,
} from '../utils/paymentAmount';

const NETWORK_PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = 'CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4';
const OTHER_CONTRACT_ID = 'CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX';
const PAYMENT_TOKEN = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const TX_HASH = 'd'.repeat(64);

const BUYER = Keypair.random().publicKey();
const OTHER_BUYER = Keypair.random().publicKey();

function decodeContractId(contractId: string): xdr.ContractId {
  return new xdr.ContractId(Uint8Array.from(StrKey.decodeContract(contractId)));
}

/** Builds the envelope of a contract invocation with the buyer as its source. */
function buildEnvelope(params: {
  contractId: string;
  functionName: string;
  buyer: string;
  propertyId: bigint;
  amount: bigint;
  paymentToken?: string;
}): xdr.TransactionEnvelope {
  const contract = new Contract(params.contractId);
  const account = new Account(params.buyer, '0');
  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        params.functionName,
        nativeToScVal(params.buyer, { type: 'address' }),
        nativeToScVal(params.propertyId, { type: 'u64' }),
        nativeToScVal(params.amount, { type: 'u64' }),
        nativeToScVal(params.paymentToken ?? PAYMENT_TOKEN, { type: 'address' }),
      ) as unknown as xdr.Operation,
    )
    .setTimeout(0)
    .build();

  return xdr.TransactionEnvelope.fromXDR(transaction.toXDR(), 'base64');
}

/** Builds the SharePurchase event as the contract emits it. */
function buildSharePurchaseEvent(params: {
  contractId: string;
  propertyId: string;
  buyer: string;
  shares: bigint;
  totalCost: bigint;
  topicName?: string;
  omitFields?: boolean;
}): xdr.ContractEvent {
  const data = params.omitFields
    ? xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('property_id'),
          val: nativeToScVal(params.propertyId, { type: 'string' }),
        }),
      ])
    : xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('buyer'),
          val: nativeToScVal(params.buyer, { type: 'address' }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('property_id'),
          val: nativeToScVal(params.propertyId, { type: 'string' }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('shares'),
          val: nativeToScVal(params.shares, { type: 'i128' }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('total_cost'),
          val: nativeToScVal(params.totalCost, { type: 'i128' }),
        }),
      ]);

  return new xdr.ContractEvent({
    ext: xdr.ExtensionPoint.v0(),
    contractId: decodeContractId(params.contractId),
    type: xdr.ContractEventType.contract,
    body: xdr.ContractEventBody.v0(
      new xdr.ContractEventV0({
        topics: [xdr.ScVal.scvSymbol(params.topicName ?? 'share_purchase')],
        data,
      }),
    ),
  });
}

function metaWithEvents(events: xdr.ContractEvent[]): xdr.TransactionMeta {
  return xdr.TransactionMeta.v3(
    new xdr.TransactionMetaV3({
      ext: xdr.ExtensionPoint.v0(),
      txChangesBefore: [],
      operations: [],
      txChangesAfter: [],
      sorobanMeta: events.length
        ? new xdr.SorobanTransactionMeta({
            ext: xdr.SorobanTransactionMetaExt.v0(),
            events,
            returnValue: xdr.ScVal.scvVoid(),
            diagnosticEvents: [],
          })
        : null,
    }),
  );
}

interface FakeResponseOverrides {
  status?: string;
  feeBump?: boolean;
  envelopeXdr?: xdr.TransactionEnvelope;
  contractEventsXdr?: xdr.ContractEvent[][];
  resultMetaXdr?: xdr.TransactionMeta;
}

function fakeSuccessfulResponse(overrides: FakeResponseOverrides = {}) {
  return {
    status: overrides.status ?? 'SUCCESS',
    txHash: TX_HASH,
    latestLedger: 100,
    latestLedgerCloseTime: 1,
    oldestLedger: 1,
    oldestLedgerCloseTime: 1,
    ledger: 99,
    createdAt: 1,
    applicationOrder: 1,
    feeBump: overrides.feeBump ?? false,
    envelopeXdr:
      overrides.envelopeXdr ??
      buildEnvelope({
        contractId: CONTRACT_ID,
        functionName: 'purchase_shares',
        buyer: BUYER,
        propertyId: BigInt(42),
        amount: BigInt(3),
      }),
    resultMetaXdr: overrides.resultMetaXdr ?? metaWithEvents([]),
    events: { contractEventsXdr: overrides.contractEventsXdr ?? [] },
  } as unknown as Awaited<ReturnType<SorobanRpc.Server['getTransaction']>>;
}

function fakeRpcServer(response: unknown): InstanceType<typeof SorobanRpc.Server> {
  return {
    getTransaction: async () => response,
  } as unknown as InstanceType<typeof SorobanRpc.Server>;
}

function makeService(response: unknown): StellarService {
  return new StellarService(undefined, NETWORK_PASSPHRASE, fakeRpcServer(response));
}

function sharePurchaseEvent(
  overrides: Partial<Parameters<typeof buildSharePurchaseEvent>[0]> = {},
) {
  return buildSharePurchaseEvent({
    contractId: CONTRACT_ID,
    propertyId: '42',
    buyer: BUYER,
    shares: BigInt(3),
    totalCost: BigInt(3_000_000_000),
    ...overrides,
  });
}

describe('StellarService.verifyPurchaseTransaction', () => {
  it('verifies a successful purchase and decodes the call and event', async () => {
    const service = makeService(
      fakeSuccessfulResponse({
        contractEventsXdr: [[sharePurchaseEvent()]],
      }),
    );

    const verified = await service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID);

    expect(verified.txHash).toBe(TX_HASH);
    expect(verified.sourceAccount).toBe(BUYER);
    expect(verified.contractId).toBe(CONTRACT_ID);
    expect(verified.functionName).toBe('purchase_shares');
    expect(verified.call).toEqual({
      buyer: BUYER,
      propertyId: BigInt(42),
      amount: BigInt(3),
      paymentToken: PAYMENT_TOKEN,
    });
    expect(verified.sharePurchase).toEqual({
      propertyId: '42',
      buyer: BUYER,
      shares: BigInt(3),
      totalCost: BigInt(3_000_000_000),
    });
  });

  it('reads contract events from the transaction meta when RPC omits them', async () => {
    const service = makeService(
      fakeSuccessfulResponse({
        contractEventsXdr: [],
        resultMetaXdr: metaWithEvents([sharePurchaseEvent()]),
      }),
    );

    const verified = await service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID);
    expect(verified.sharePurchase.shares).toBe(BigInt(3));
  });

  it('rejects a malformed hash', async () => {
    const service = makeService(fakeSuccessfulResponse());
    await expect(
      service.verifyPurchaseTransaction('not-a-hash', CONTRACT_ID),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a transaction that is not found', async () => {
    const service = makeService(fakeSuccessfulResponse({ status: 'NOT_FOUND' }));
    await expect(service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects a failed transaction', async () => {
    const service = makeService(fakeSuccessfulResponse({ status: 'FAILED' }));
    await expect(service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID)).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects a transaction to a different contract', async () => {
    const service = makeService(
      fakeSuccessfulResponse({
        envelopeXdr: buildEnvelope({
          contractId: OTHER_CONTRACT_ID,
          functionName: 'purchase_shares',
          buyer: BUYER,
          propertyId: BigInt(42),
          amount: BigInt(3),
        }),
        contractEventsXdr: [[sharePurchaseEvent()]],
      }),
    );

    await expect(service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('invokes contract'),
    });
  });

  it('rejects a transaction calling a different function', async () => {
    const service = makeService(
      fakeSuccessfulResponse({
        envelopeXdr: buildEnvelope({
          contractId: CONTRACT_ID,
          functionName: 'mint_shares',
          buyer: BUYER,
          propertyId: BigInt(42),
          amount: BigInt(3),
        }),
        contractEventsXdr: [[sharePurchaseEvent()]],
      }),
    );

    await expect(service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('expected purchase_shares'),
    });
  });

  it('rejects a transaction with no SharePurchase event', async () => {
    const service = makeService(
      fakeSuccessfulResponse({
        contractEventsXdr: [[]],
        resultMetaXdr: metaWithEvents([]),
      }),
    );

    await expect(service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('SharePurchase'),
    });
  });

  it('rejects a SharePurchase event from a different event type', async () => {
    const service = makeService(
      fakeSuccessfulResponse({
        contractEventsXdr: [[sharePurchaseEvent({ topicName: 'share_transfer' })]],
      }),
    );

    await expect(service.verifyPurchaseTransaction(TX_HASH, CONTRACT_ID)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('SharePurchase'),
    });
  });
});

const skipIfNoDatabase = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDatabase)('PropertyController buy-shares prepare/confirm', () => {
  const propertyOwnerAddress = 'GOWNERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const buyerAddress = 'GBUYERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const secondBuyerAddress = 'GSECONDBUYERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  let propertyId: string;
  let buyerId: string;
  let secondBuyerId: string;
  let propertySorobanId: number;

  let originalMintPropertyShares: any;
  let originalPreparePurchaseShares: any;
  let originalVerifyPurchaseTransaction: any;
  let mintCalled: boolean;

  const verifiedPurchase = (overrides: Record<string, unknown> = {}) => ({
    txHash: TX_HASH,
    sourceAccount: buyerAddress,
    contractId: CONTRACT_ID,
    functionName: 'purchase_shares',
    call: {
      buyer: buyerAddress,
      propertyId: BigInt(propertySorobanId),
      amount: BigInt(2),
      paymentToken: PAYMENT_TOKEN,
    },
    sharePurchase: {
      propertyId: String(propertySorobanId),
      buyer: buyerAddress,
      shares: BigInt(2),
      // 2 shares at 100.00, in 7-decimal payment token units
      totalCost: BigInt(2_000_000_000),
    },
    ...overrides,
  });

  beforeAll(async () => {
    if (skipIfNoDatabase) return;

    process.env.PAYMENT_TOKEN_CONTRACT_ID = PAYMENT_TOKEN;

    const owner = await userRepository.getOrCreateByWallet(propertyOwnerAddress);
    const buyer = await userRepository.getOrCreateByWallet(buyerAddress);
    const secondBuyer = await userRepository.getOrCreateByWallet(secondBuyerAddress);
    buyerId = buyer.id;
    secondBuyerId = secondBuyer.id;

    await kycRepository.updateUserKycStatus(buyerId, 'approved');
    await kycRepository.updateUserKycStatus(secondBuyerId, 'approved');

    const prop = await propertyRepository.create({
      name: 'Test Buy Shares Property',
      description: 'Test description long enough',
      propertyType: 'residential',
      location: { address: '123', city: 'A', country: 'B' },
      totalValue: '100000',
      totalShares: 10,
      availableShares: 10,
      pricePerShare: '100.00',
      images: ['img'],
      verified: true,
      ownerId: owner.id,
    });
    propertyId = prop.id;

    propertySorobanId = await propertyRepository.allocateSorobanPropertyId();
    await db
      .update(properties)
      .set({
        tokenAddress: CONTRACT_ID,
        sorobanPropertyId: propertySorobanId,
      })
      .where(eq(properties.id, prop.id));
  });

  beforeEach(() => {
    mintCalled = false;
    originalMintPropertyShares = stellarService.mintPropertyShares;
    originalPreparePurchaseShares = stellarService.preparePurchaseShares;
    originalVerifyPurchaseTransaction = stellarService.verifyPurchaseTransaction;

    // Any call to the admin mint from the purchase path is a regression.
    (stellarService as any).mintPropertyShares = async () => {
      mintCalled = true;
      throw new Error('mintPropertyShares must not be reachable from buy-shares');
    };
    (stellarService as any).preparePurchaseShares = async () => ({
      xdr: 'AAAA-UNSIGNED-XDR',
      contractId: CONTRACT_ID,
    });
    (stellarService as any).verifyPurchaseTransaction = async () => verifiedPurchase();

    if (propertyId) {
      return db
        .update(properties)
        .set({ availableShares: 10 })
        .where(eq(properties.id, propertyId));
    }
  });

  afterEach(async () => {
    (stellarService as any).mintPropertyShares = originalMintPropertyShares;
    (stellarService as any).preparePurchaseShares = originalPreparePurchaseShares;
    (stellarService as any).verifyPurchaseTransaction = originalVerifyPurchaseTransaction;

    if (propertyId) {
      await db.delete(shareOwnerships).where(eq(shareOwnerships.propertyId, propertyId));
      await db.delete(transactions).where(eq(transactions.fromUserId, buyerId));
      await db.delete(transactions).where(eq(transactions.fromUserId, secondBuyerId));
      await db.update(properties).set({ availableShares: 10 }).where(eq(properties.id, propertyId));
    }
  });

  describe('prepare', () => {
    it('returns an unsigned purchase transaction and never mints', async () => {
      const result = await PropertyController.prepareBuyShares(
        propertyId,
        { buyer: buyerAddress, shares: 2 },
        buyerAddress,
      );

      expect(result.xdr).toBe('AAAA-UNSIGNED-XDR');
      expect(result.contractId).toBe(CONTRACT_ID);
      expect(result.sorobanPropertyId).toBe(String(propertySorobanId));
      expect(result.shares).toBe(2);
      expect(result.paymentToken).toBe(PAYMENT_TOKEN);
      expect(result.totalAmount).toBe('200.0000000');
      expect(mintCalled).toBe(false);

      // Preparing records nothing
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(10);
      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(eq(shareOwnerships.propertyId, propertyId), eq(shareOwnerships.ownerId, buyerId)),
        );
      expect(ownership).toBeUndefined();
    });

    it('rejects when inventory is insufficient', async () => {
      await expect(
        PropertyController.prepareBuyShares(
          propertyId,
          { buyer: buyerAddress, shares: 11 },
          buyerAddress,
        ),
      ).rejects.toThrow(/enough shares/i);
      expect(mintCalled).toBe(false);
    });

    it('rejects when the authenticated wallet differs from the buyer', async () => {
      await expect(
        PropertyController.prepareBuyShares(
          propertyId,
          { buyer: buyerAddress, shares: 2 },
          secondBuyerAddress,
        ),
      ).rejects.toThrow(/does not match buyer/i);
      expect(mintCalled).toBe(false);
    });
  });

  describe('confirm', () => {
    it('records a verified purchase exactly once', async () => {
      const result = await PropertyController.confirmBuyShares(
        propertyId,
        { txHash: TX_HASH },
        buyerAddress,
      );

      expect(result.transactionHash).toBe(TX_HASH);
      expect(result.newBalance).toBe(2);
      expect(mintCalled).toBe(false);

      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(8);

      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(eq(shareOwnerships.propertyId, propertyId), eq(shareOwnerships.ownerId, buyerId)),
        );
      expect(ownership).toBeDefined();
      expect(ownership!.shares).toBe(2);
      expect(parseFloat(ownership!.purchasePrice)).toBe(200); // 2 x 100.00

      const [tx] = await db.select().from(transactions).where(eq(transactions.hash, TX_HASH));
      expect(tx).toBeDefined();
      expect(tx!.status).toBe('confirmed');
      expect(parseFloat(tx!.amount)).toBe(200); // real paid amount, 7-decimal asset units
      expect(tx!.asset).toBe(PAYMENT_TOKEN);
      expect(tx!.type).toBe('buy_shares');
    });

    it('returns the same result when the same hash is confirmed twice', async () => {
      const first = await PropertyController.confirmBuyShares(
        propertyId,
        { txHash: TX_HASH },
        buyerAddress,
      );
      const second = await PropertyController.confirmBuyShares(
        propertyId,
        { txHash: TX_HASH },
        buyerAddress,
      );

      expect(second.transactionHash).toBe(first.transactionHash);
      expect(second.newBalance).toBe(first.newBalance);

      // No double counting: inventory and ownership moved only once
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(8);
      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(eq(shareOwnerships.propertyId, propertyId), eq(shareOwnerships.ownerId, buyerId)),
        );
      expect(ownership!.shares).toBe(2);
      const rows = await db.select().from(transactions).where(eq(transactions.hash, TX_HASH));
      expect(rows.length).toBe(1);
    });

    it('rejects when on-chain verification fails', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () => {
        throw Object.assign(new Error('Transaction did not succeed on-chain'), {
          statusCode: 422,
        });
      };

      await expect(
        PropertyController.confirmBuyShares(propertyId, { txHash: TX_HASH }, buyerAddress),
      ).rejects.toThrow('Transaction did not succeed on-chain');

      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(10);
      const [tx] = await db.select().from(transactions).where(eq(transactions.hash, TX_HASH));
      expect(tx).toBeUndefined();
      expect(mintCalled).toBe(false);
    });

    it('rejects a transaction signed by a different buyer', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () =>
        verifiedPurchase({
          sourceAccount: OTHER_BUYER,
          call: {
            buyer: OTHER_BUYER,
            propertyId: BigInt(propertySorobanId),
            amount: BigInt(2),
            paymentToken: PAYMENT_TOKEN,
          },
          sharePurchase: {
            propertyId: String(propertySorobanId),
            buyer: OTHER_BUYER,
            shares: BigInt(2),
            totalCost: BigInt(2_000_000_000),
          },
        });

      await expect(
        PropertyController.confirmBuyShares(propertyId, { txHash: TX_HASH }, buyerAddress),
      ).rejects.toThrow(/not signed by the authenticated buyer/i);

      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(10);
    });

    it('rejects a mismatched amount between the call and the event', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () =>
        verifiedPurchase({
          call: {
            buyer: buyerAddress,
            propertyId: BigInt(propertySorobanId),
            amount: BigInt(4),
            paymentToken: PAYMENT_TOKEN,
          },
          sharePurchase: {
            propertyId: String(propertySorobanId),
            buyer: buyerAddress,
            shares: BigInt(2),
            totalCost: BigInt(2_000_000_000),
          },
        });

      await expect(
        PropertyController.confirmBuyShares(propertyId, { txHash: TX_HASH }, buyerAddress),
      ).rejects.toThrow(/amount does not match/i);

      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(10);
    });

    it('rejects a purchase for a different property', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () =>
        verifiedPurchase({
          call: {
            buyer: buyerAddress,
            propertyId: BigInt(propertySorobanId + 1),
            amount: BigInt(2),
            paymentToken: PAYMENT_TOKEN,
          },
        });

      await expect(
        PropertyController.confirmBuyShares(propertyId, { txHash: TX_HASH }, buyerAddress),
      ).rejects.toThrow(/different property/i);
    });

    it('rejects an event whose total cost does not match the price', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () =>
        verifiedPurchase({
          call: {
            buyer: buyerAddress,
            propertyId: BigInt(propertySorobanId),
            amount: BigInt(2),
            paymentToken: PAYMENT_TOKEN,
          },
          sharePurchase: {
            propertyId: String(propertySorobanId),
            buyer: buyerAddress,
            shares: BigInt(2),
            totalCost: BigInt(1),
          },
        });

      await expect(
        PropertyController.confirmBuyShares(propertyId, { txHash: TX_HASH }, buyerAddress),
      ).rejects.toThrow(/total cost/i);
    });

    it('never reaches mintPropertyShares across prepare and confirm', async () => {
      await PropertyController.prepareBuyShares(
        propertyId,
        { buyer: buyerAddress, shares: 2 },
        buyerAddress,
      );
      await PropertyController.confirmBuyShares(propertyId, { txHash: TX_HASH }, buyerAddress);

      expect(mintCalled).toBe(false);
    });
  });

  describe('concurrency', () => {
    it('never lets two confirms oversell the inventory', async () => {
      // Two purchases of 8 shares each, but only 10 in stock: at most one can
      // be recorded and inventory can never go negative.
      const firstHash = '1'.repeat(64);
      const secondHash = '2'.repeat(64);
      let attempt = 0;
      (stellarService as any).verifyPurchaseTransaction = async (txHash: string) => {
        attempt += 1;
        const buyer = txHash === firstHash ? buyerAddress : secondBuyerAddress;
        return verifiedPurchase({
          txHash,
          sourceAccount: buyer,
          call: {
            buyer,
            propertyId: BigInt(propertySorobanId),
            amount: BigInt(8),
            paymentToken: PAYMENT_TOKEN,
          },
          sharePurchase: {
            propertyId: String(propertySorobanId),
            buyer,
            shares: BigInt(8),
            totalCost: BigInt(8_000_000_000),
          },
        });
      };

      const results = await Promise.allSettled([
        PropertyController.confirmBuyShares(propertyId, { txHash: firstHash }, buyerAddress),
        PropertyController.confirmBuyShares(propertyId, { txHash: secondHash }, secondBuyerAddress),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBe(1);
      expect(attempt).toBe(2);

      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBeGreaterThanOrEqual(0);
      expect(prop!.availableShares).toBe(2);

      const ownerships = await db
        .select()
        .from(shareOwnerships)
        .where(eq(shareOwnerships.propertyId, propertyId));
      expect(ownerships.length).toBe(1);
      expect(ownerships[0]!.shares).toBe(8);
    });
  });
});


describe('payment amount conversions', () => {
  it('converts a two-decimal share price to seven-decimal token units', () => {
    expect(pricePerShareToTokenUnits('125.50')).toBe(1_255_000_000n);
    expect(pricePerShareToTokenUnits('0.01')).toBe(100_000n);
  });

  it('calculates the exact total token amount for a positive share quantity', () => {
    expect(purchaseTotalToTokenUnits('125.50', 3)).toBe(3_765_000_000n);
    expect(formatTokenUnits(purchaseTotalToTokenUnits('125.50', 3))).toBe('376.5000000');
  });

  it('rejects zero, negative, and fractional share quantities', () => {
    expect(() => purchaseTotalToTokenUnits('100.00', 0)).toThrow(
      'Shares must be a positive integer',
    );
    expect(() => purchaseTotalToTokenUnits('100.00', -1)).toThrow(
      'Shares must be a positive integer',
    );
    expect(() => purchaseTotalToTokenUnits('100.00', 1.5)).toThrow(
      'Shares must be a positive integer',
    );
  });
});
