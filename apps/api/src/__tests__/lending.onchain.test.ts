/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Lending is an on-chain protocol: Postgres is only a cache of contract state.
 *
 * This file covers:
 *  - operator-only pool creation through the contract's admin signer,
 *  - prepare building the right contract call for every user action,
 *  - StellarService.verifyContractTransaction against a fake Soroban RPC with
 *    real XDR envelopes (contract id, function name, decoded arguments),
 *  - confirm rejecting everything that does not match before writing anything,
 *  - confirm caching positions/totals exactly as the contract getters return them,
 *  - liquidation's four-argument call and borrower wallet resolution,
 *  - the retired database-only write routes returning 410.
 */
import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Elysia } from 'elysia';
import { and, eq, inArray } from 'drizzle-orm';
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
import { LendingController } from '../controllers/LendingController';
import { lendingRoutes } from '../routes/lending';
import { errorHandler } from '../middleware/errorHandler';
import { stellarService, StellarService } from '../services/StellarService';
import { lendingRepository } from '../repositories/LendingRepository';
import { userRepository } from '../repositories/UserRepository';
import { ApiError } from '../errors/ApiError';
import { NotificationService } from '../services/NotificationService';
import { db } from '../db';
import { borrowPositions, lendingPools, transactions, users } from '../db/schema';

const NETWORK_PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = 'CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX';
const OTHER_CONTRACT_ID = 'CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4';
const ASSET_CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const TX_HASH = 'a'.repeat(64);

const POOL_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const BORROWER_ID = '33333333-3333-4333-8333-333333333333';
const CONTRACT_POOL_ID = 'contract-pool-1';

const WALLET = Keypair.random().publicKey();
const OTHER_WALLET = Keypair.random().publicKey();
const LIQUIDATOR = Keypair.random().publicKey();
const BORROWER_WALLET = Keypair.random().publicKey();

process.env.DEFI_RWA_CONTRACT_ID = CONTRACT_ID;
process.env.STELLAR_ADMIN_PUBLIC_KEY = Keypair.random().publicKey();
process.env.STELLAR_ADMIN_SECRET = Keypair.random().secret();
process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-ops-secret';
process.env.LIQUIDATOR_API_KEY = 'test-liquidator-secret';

const poolFixture = {
  id: POOL_ID,
  name: 'USDC Pool',
  asset: 'USDC',
  assetAddress: ASSET_CONTRACT_ID,
  contractPoolId: CONTRACT_POOL_ID,
  totalDeposits: '0.0000000',
  totalBorrows: '0.0000000',
  availableLiquidity: '0.0000000',
  utilizationRate: '0.00',
  supplyAPY: '0.00',
  borrowAPY: '0.00',
  collateralFactor: '0.75',
  liquidationThreshold: '0.80',
  liquidationPenalty: '0.05',
  reserveFactor: 1000,
  isActive: true,
  isPaused: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function buildLendingEnvelope(params: {
  contractId: string;
  functionName: string;
  source: string;
  args: xdr.ScVal[];
}): xdr.TransactionEnvelope {
  const contract = new Contract(params.contractId);
  const account = new Account(params.source, '0');
  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(params.functionName, ...params.args) as unknown as xdr.Operation)
    .setTimeout(0)
    .build();

  return xdr.TransactionEnvelope.fromXDR(transaction.toXDR(), 'base64');
}

function fakeResponse(
  overrides: {
    status?: string;
    envelopeXdr?: xdr.TransactionEnvelope;
    events?: { contractEventsXdr: xdr.ContractEvent[][] };
  } = {},
) {
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
    feeBump: false,
    envelopeXdr:
      overrides.envelopeXdr ??
      buildLendingEnvelope({
        contractId: CONTRACT_ID,
        functionName: 'deposit',
        source: WALLET,
        args: [
          nativeToScVal(WALLET, { type: 'address' }),
          nativeToScVal(CONTRACT_POOL_ID, { type: 'string' }),
          nativeToScVal(BigInt(1_000_000_000), { type: 'i128' }),
        ],
      }),
    resultMetaXdr: xdr.TransactionMeta.v3(
      new xdr.TransactionMetaV3({
        ext: xdr.ExtensionPoint.v0(),
        txChangesBefore: [],
        operations: [],
        txChangesAfter: [],
        sorobanMeta: new xdr.SorobanTransactionMeta({
          ext: xdr.SorobanTransactionMetaExt.v0(),
          events: [],
          returnValue: xdr.ScVal.scvVoid(),
          diagnosticEvents: [],
        }),
      }),
    ),
    events: overrides.events ?? { contractEventsXdr: [] },
  } as unknown as Awaited<ReturnType<SorobanRpc.Server['getTransaction']>>;
}

function makeRepayEvent(
  params: {
    contractId?: string;
    borrower?: string;
    poolId?: string;
    amount?: bigint;
  } = {},
): xdr.ContractEvent {
  const data = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('amount'),
      val: nativeToScVal(params.amount ?? BigInt(500_000_000), { type: 'i128' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('borrower'),
      val: nativeToScVal(params.borrower ?? WALLET, { type: 'address' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('pool_id'),
      val: nativeToScVal(params.poolId ?? CONTRACT_POOL_ID, { type: 'string' }),
    }),
  ]);

  return new xdr.ContractEvent({
    ext: xdr.ExtensionPoint.v0(),
    contractId: new xdr.ContractId(
      Uint8Array.from(StrKey.decodeContract(params.contractId ?? CONTRACT_ID)),
    ),
    type: xdr.ContractEventType.contract,
    body: xdr.ContractEventBody.v0(
      new xdr.ContractEventV0({
        topics: [xdr.ScVal.scvSymbol('repay')],
        data,
      }),
    ),
  });
}

function makeStellarService(response: unknown): StellarService {
  return new StellarService(undefined, NETWORK_PASSPHRASE, {
    getTransaction: async () => response,
  } as unknown as InstanceType<typeof SorobanRpc.Server>);
}

function authCtx(
  body: unknown,
  options: { params?: Record<string, string>; wallet?: string; userId?: string } = {},
) {
  return {
    params: options.params ?? { id: POOL_ID },
    body,
    getAuthenticatedUser: async () => ({
      id: options.userId ?? USER_ID,
      walletAddress: options.wallet ?? WALLET,
    }),
  } as any;
}

const verifiedDeposit = {
  txHash: TX_HASH,
  sourceAccount: WALLET,
  contractId: CONTRACT_ID,
  functionName: 'deposit',
  args: [WALLET, CONTRACT_POOL_ID, BigInt(1_000_000_000)],
};

type ConfirmableAction = 'withdraw' | 'borrow' | 'repay';

function makeActionResponse(
  action: ConfirmableAction,
  overrides: {
    status?: string;
    contractId?: string;
    functionName?: string;
    source?: string;
    actor?: string;
    poolId?: string;
  } = {},
) {
  const actor = overrides.actor ?? WALLET;
  const args = [
    nativeToScVal(actor, { type: 'address' }),
    nativeToScVal(overrides.poolId ?? CONTRACT_POOL_ID, { type: 'string' }),
    nativeToScVal(BigInt(1_000_000_000), { type: 'i128' }),
  ];
  if (action === 'borrow') {
    args.push(
      nativeToScVal(ASSET_CONTRACT_ID, { type: 'address' }),
      nativeToScVal(BigInt(5_000_000_000), { type: 'i128' }),
    );
  }

  return fakeResponse({
    status: overrides.status,
    envelopeXdr: buildLendingEnvelope({
      contractId: overrides.contractId ?? CONTRACT_ID,
      functionName: overrides.functionName ?? action,
      source: overrides.source ?? actor,
      args,
    }),
    ...(action === 'repay'
      ? {
          events: {
            contractEventsXdr: [[makeRepayEvent({ borrower: actor, poolId: overrides.poolId })]],
          },
        }
      : {}),
  });
}

const totals = {
  totalDeposits: BigInt(1_000_000_000),
  totalBorrows: BigInt(0),
  availableLiquidity: BigInt(1_000_000_000),
};

const originalServiceMethods = {
  createLendingPool: stellarService.createLendingPool,
  prepareLendingAction: stellarService.prepareLendingAction,
  prepareLiquidation: stellarService.prepareLiquidation,
  verifyContractTransaction: stellarService.verifyContractTransaction,
  getLendingPoolTotals: stellarService.getLendingPoolTotals,
  getLendingDepositPosition: stellarService.getLendingDepositPosition,
  getLendingBorrowPosition: stellarService.getLendingBorrowPosition,
  getLendingHealthFactor: stellarService.getLendingHealthFactor,
};
const originalRepositoryMethods = {
  findActivePool: lendingRepository.findActivePool,
  findById: lendingRepository.findById,
  create: lendingRepository.create,
  recordConfirmedAction: lendingRepository.recordConfirmedAction,
};
const originalUserFindById = userRepository.findById;
const originalNotifyLiquidation = NotificationService.prototype.notifyLiquidationExecuted;

let serviceMocks: Record<string, any>;
let repositoryMocks: Record<string, any>;
let userFindByIdMock: any;

beforeEach(() => {
  serviceMocks = {
    createLendingPool: mock(async () => ({ txHash: TX_HASH, contractId: CONTRACT_ID })),
    prepareLendingAction: mock(async () => ({ xdr: 'unsigned-xdr', contractId: CONTRACT_ID })),
    prepareLiquidation: mock(async () => ({
      xdr: 'unsigned-liquidation-xdr',
      contractId: CONTRACT_ID,
    })),
    verifyContractTransaction: mock(async () => verifiedDeposit),
    getLendingPoolTotals: mock(async () => totals),
    getLendingDepositPosition: mock(async () => ({
      amount: BigInt(1_000_000_000),
      shares: BigInt(1_000_000_000),
    })),
    getLendingBorrowPosition: mock(async () => null),
    getLendingHealthFactor: mock(async () => BigInt(0)),
  };
  repositoryMocks = {
    findActivePool: mock(async () => poolFixture),
    findById: mock(async () => poolFixture),
    create: mock(async (data: Record<string, unknown>) => ({ ...poolFixture, ...data })),
    recordConfirmedAction: mock(async () => ({
      recorded: true,
      transaction: { id: 'tx-1', hash: TX_HASH, status: 'confirmed' },
    })),
  };
  userFindByIdMock = mock(async () => ({
    id: BORROWER_ID,
    walletAddress: BORROWER_WALLET,
  }));

  Object.assign(stellarService as any, serviceMocks);
  Object.assign(lendingRepository as any, repositoryMocks);
  (userRepository as any).findById = userFindByIdMock;
  // The liquidation confirmation records the notification after the database
  // write; keep this suite database-free.
  (NotificationService.prototype as any).notifyLiquidationExecuted = mock(async () => ({}));
});

afterAll(() => {
  Object.assign(stellarService as any, originalServiceMethods);
  Object.assign(lendingRepository as any, originalRepositoryMethods);
  (userRepository as any).findById = originalUserFindById;
  (NotificationService.prototype as any).notifyLiquidationExecuted = originalNotifyLiquidation;
});

describe('POST /lending/pools is operator-only', () => {
  const app = new Elysia().use(errorHandler).use(lendingRoutes);
  const body = JSON.stringify({
    name: 'USDC Pool',
    asset: 'USDC',
    assetAddress: ASSET_CONTRACT_ID,
    collateralFactor: '0.75',
    liquidationThreshold: '0.80',
    liquidationPenalty: '0.05',
    closeFactor: '0.50',
    reserveFactor: 1000,
  });

  function post(extraHeaders: Record<string, string> = {}) {
    return app.handle(
      new Request('http://localhost/lending/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body,
      }),
    );
  }

  it('returns 403 and never creates anything without the operator key', async () => {
    const response = await post();

    expect(response.status).toBe(403);
    expect(serviceMocks.createLendingPool).not.toHaveBeenCalled();
    expect(repositoryMocks.create).not.toHaveBeenCalled();
  });

  it('returns 403 for a wrong operator key', async () => {
    const response = await post({ 'x-internal-api-key': 'wrong' });

    expect(response.status).toBe(403);
    expect(serviceMocks.createLendingPool).not.toHaveBeenCalled();
  });

  it('creates the pool on-chain first and caches it with its contract_pool_id', async () => {
    const response = await post({ 'x-internal-api-key': 'test-ops-secret' });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ txHash: TX_HASH });
    expect(serviceMocks.createLendingPool).toHaveBeenCalledTimes(1);

    const call = serviceMocks.createLendingPool.mock.calls[0]?.[0] as Record<string, any>;
    expect(call.contractId).toBe(CONTRACT_ID);
    expect(call.closeFactor).toBe(BigInt('500000000000000000'));
    expect(call.collateralFactor).toBe(BigInt('750000000000000000'));
    expect(call.reserveFactor).toBe(1000);

    const created = repositoryMocks.create.mock.calls[0]?.[0] as Record<string, any>;
    expect(created.contractPoolId).toBe(call.poolId);
    expect(created.id).toBe(call.poolId);
  });

  it('does not store a pool when on-chain creation fails', async () => {
    serviceMocks.createLendingPool = mock(async () => {
      throw ApiError.badRequest('contract rejected create_pool');
    });
    (stellarService as any).createLendingPool = serviceMocks.createLendingPool;

    const response = await post({ 'x-internal-api-key': 'test-ops-secret' });

    expect(response.status).toBe(400);
    expect(repositoryMocks.create).not.toHaveBeenCalled();
  });
});

describe('prepare endpoints build the correct contract call', () => {
  it('prepares a deposit with the authenticated wallet as source', async () => {
    const response = await LendingController.prepareDeposit(authCtx({ amount: '100' }));

    expect(response.status).toBe(200);
    expect(serviceMocks.prepareLendingAction).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      action: 'deposit',
      wallet: WALLET,
      poolId: CONTRACT_POOL_ID,
      amount: BigInt(1_000_000_000),
    });
    expect(await response.json()).toMatchObject({
      action: 'deposit',
      xdr: 'unsigned-xdr',
      sourceAccount: WALLET,
    });
  });

  it('prepares a withdraw', async () => {
    await LendingController.prepareWithdraw(authCtx({ amount: '25.5' }));

    expect(serviceMocks.prepareLendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'withdraw', amount: BigInt(255_000_000) }),
    );
  });

  it('prepares a borrow with collateral arguments', async () => {
    await LendingController.prepareBorrow(
      authCtx({
        borrowAmount: '300',
        collateralAmount: '500',
        collateralAsset: ASSET_CONTRACT_ID,
      }),
    );

    expect(serviceMocks.prepareLendingAction).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      action: 'borrow',
      wallet: WALLET,
      poolId: CONTRACT_POOL_ID,
      amount: BigInt(3_000_000_000),
      collateralAsset: ASSET_CONTRACT_ID,
      collateralAmount: BigInt(5_000_000_000),
    });
  });

  it('prepares a repay', async () => {
    await LendingController.prepareRepay(authCtx({ amount: '10' }));

    expect(serviceMocks.prepareLendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'repay', amount: BigInt(100_000_000) }),
    );
  });

  it('returns a readable 400 when simulation fails', async () => {
    serviceMocks.prepareLendingAction = mock(async () => {
      throw ApiError.badRequest('Failed to prepare the deposit transaction: simulation reverted');
    });
    (stellarService as any).prepareLendingAction = serviceMocks.prepareLendingAction;

    await expect(LendingController.prepareDeposit(authCtx({ amount: '1' }))).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('simulation reverted'),
    });
  });

  it('refuses pools that were never created on-chain', async () => {
    repositoryMocks.findActivePool = mock(async () => ({ ...poolFixture, contractPoolId: null }));
    (lendingRepository as any).findActivePool = repositoryMocks.findActivePool;

    await expect(LendingController.prepareDeposit(authCtx({ amount: '1' }))).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(serviceMocks.prepareLendingAction).not.toHaveBeenCalled();
  });
});

describe('StellarService.verifyContractTransaction', () => {
  it('decodes a successful lending call', async () => {
    const service = makeStellarService(fakeResponse());

    const verified = await service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'deposit');

    expect(verified.sourceAccount).toBe(WALLET);
    expect(verified.functionName).toBe('deposit');
    expect(verified.args).toEqual([WALLET, CONTRACT_POOL_ID, BigInt(1_000_000_000)]);
  });

  it('rejects a transaction for a different contract ID', async () => {
    const service = makeStellarService(fakeResponse());

    await expect(
      service.verifyContractTransaction(TX_HASH, OTHER_CONTRACT_ID, 'deposit'),
    ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('expected') });
  });

  it('rejects a transaction calling a different function', async () => {
    const service = makeStellarService(fakeResponse());

    await expect(
      service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'withdraw'),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('expected withdraw'),
    });
  });

  it('rejects a transaction that failed on-chain', async () => {
    const service = makeStellarService(fakeResponse({ status: 'FAILED' }));

    await expect(
      service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'deposit'),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects an unknown transaction hash', async () => {
    const service = makeStellarService(fakeResponse({ status: 'NOT_FOUND' }));

    await expect(
      service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'deposit'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('uses the amount emitted by the Repay event instead of the requested amount', async () => {
    const service = makeStellarService(
      fakeResponse({
        envelopeXdr: buildLendingEnvelope({
          contractId: CONTRACT_ID,
          functionName: 'repay',
          source: WALLET,
          args: [
            nativeToScVal(WALLET, { type: 'address' }),
            nativeToScVal(CONTRACT_POOL_ID, { type: 'string' }),
            nativeToScVal(BigInt(1_000_000_000), { type: 'i128' }),
          ],
        }),
        events: { contractEventsXdr: [[makeRepayEvent({ amount: 13n })]] },
      }),
    );

    const verified = await service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'repay');

    expect(verified.actualAmount).toBe(13n);
  });

  it('rejects a repay transaction with no matching Repay event', async () => {
    const response = makeActionResponse('repay');
    const service = makeStellarService({ ...response, events: { contractEventsXdr: [] } });

    await expect(
      service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'repay'),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('no Repay event'),
    });
  });

  it('rejects a Repay event for a different borrower or pool', async () => {
    const service = makeStellarService(
      fakeResponse({
        envelopeXdr: buildLendingEnvelope({
          contractId: CONTRACT_ID,
          functionName: 'repay',
          source: WALLET,
          args: [
            nativeToScVal(WALLET, { type: 'address' }),
            nativeToScVal(CONTRACT_POOL_ID, { type: 'string' }),
            nativeToScVal(BigInt(1_000_000_000), { type: 'i128' }),
          ],
        }),
        events: { contractEventsXdr: [[makeRepayEvent({ borrower: OTHER_WALLET })]] },
      }),
    );

    await expect(
      service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'repay'),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('does not match'),
    });
  });

  it('verifies the four-argument liquidation call', async () => {
    const service = makeStellarService(
      fakeResponse({
        envelopeXdr: buildLendingEnvelope({
          contractId: CONTRACT_ID,
          functionName: 'liquidate',
          source: LIQUIDATOR,
          args: [
            nativeToScVal(LIQUIDATOR, { type: 'address' }),
            nativeToScVal(CONTRACT_POOL_ID, { type: 'string' }),
            nativeToScVal(BORROWER_WALLET, { type: 'address' }),
            nativeToScVal(BigInt(500_000_000), { type: 'i128' }),
          ],
        }),
      }),
    );

    const verified = await service.verifyContractTransaction(TX_HASH, CONTRACT_ID, 'liquidate');

    expect(verified.args).toEqual([
      LIQUIDATOR,
      CONTRACT_POOL_ID,
      BORROWER_WALLET,
      BigInt(500_000_000),
    ]);
  });
});

describe('StellarService lending position reads', () => {
  it('propagates deposit-position RPC failures', async () => {
    const rpcFailure = new Error('RPC timeout');
    const service = makeStellarService(fakeResponse());
    (service as any).createDefiLendingClient = () => ({
      getUserDeposits: async () => ({ result: [CONTRACT_POOL_ID] }),
      getDepositPosition: async () => {
        throw rpcFailure;
      },
    });

    await expect(
      service.getLendingDepositPosition(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).rejects.toBe(rpcFailure);
  });

  it('propagates borrow-position RPC failures', async () => {
    const rpcFailure = new Error('RPC timeout');
    const service = makeStellarService(fakeResponse());
    (service as any).createDefiLendingClient = () => ({
      getUserBorrows: async () => ({ result: [CONTRACT_POOL_ID] }),
      getBorrowPosition: async () => {
        throw rpcFailure;
      },
    });

    await expect(
      service.getLendingBorrowPosition(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).rejects.toBe(rpcFailure);
  });

  it('propagates health-factor RPC failures', async () => {
    const rpcFailure = new Error('RPC timeout');
    const service = makeStellarService(fakeResponse());
    (service as any).createDefiLendingClient = () => ({
      getHealthFactor: async () => {
        throw rpcFailure;
      },
    });

    await expect(
      service.getLendingHealthFactor(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).rejects.toBe(rpcFailure);
  });

  it('unwraps successful health-factor contract results', async () => {
    const healthFactor = BigInt('1500000000000000000');
    const service = makeStellarService(fakeResponse());
    (service as any).createDefiLendingClient = () => ({
      getHealthFactor: async () => ({ result: { unwrap: () => healthFactor } }),
    });

    await expect(
      service.getLendingHealthFactor(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).resolves.toBe(healthFactor);
  });

  it('propagates contract errors returned by the health-factor getter', async () => {
    const contractFailure = new Error('borrow position not found');
    const service = makeStellarService(fakeResponse());
    (service as any).createDefiLendingClient = () => ({
      getHealthFactor: async () => ({
        result: {
          unwrap: () => {
            throw contractFailure;
          },
        },
      }),
    });

    await expect(
      service.getLendingHealthFactor(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).rejects.toBe(contractFailure);
  });

  it('returns null only when the contract position index confirms absence', async () => {
    const service = makeStellarService(fakeResponse());
    const getDepositPosition = mock(async () => ({
      result: { amount: BigInt(1), shares: BigInt(1) },
    }));
    const getBorrowPosition = mock(async () => ({
      result: {
        principal: BigInt(1),
        collateral_amount: BigInt(1),
        collateral_asset: OTHER_WALLET,
      },
    }));
    (service as any).createDefiLendingClient = () => ({
      getUserDeposits: async () => ({ result: [] }),
      getUserBorrows: async () => ({ result: [] }),
      getDepositPosition,
      getBorrowPosition,
    });

    await expect(
      service.getLendingDepositPosition(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).resolves.toBeNull();
    await expect(
      service.getLendingBorrowPosition(CONTRACT_ID, CONTRACT_POOL_ID, WALLET, WALLET),
    ).resolves.toBeNull();
    expect(getDepositPosition).not.toHaveBeenCalled();
    expect(getBorrowPosition).not.toHaveBeenCalled();
  });
});

describe('confirm endpoints cache contract state', () => {
  it('writes Postgres from the values the contract getters return', async () => {
    const response = await LendingController.confirmDeposit(authCtx({ txHash: TX_HASH }));

    expect(response.status).toBe(200);
    expect(repositoryMocks.recordConfirmedAction).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.recordConfirmedAction.mock.calls[0]?.[0]).toMatchObject({
      type: 'deposit',
      hash: TX_HASH,
      userId: USER_ID,
      amount: '100.0000000',
      asset: 'USDC',
      poolId: POOL_ID,
      contractPoolId: CONTRACT_POOL_ID,
      poolTotals: {
        totalDeposits: '100.0000000',
        totalBorrows: '0.0000000',
        availableLiquidity: '100.0000000',
      },
      deposit: { amount: '100.0000000', shares: '100.0000000' },
    });
  });

  it('records zero writes when transaction verification fails', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => {
      throw ApiError.validation('Transaction did not succeed on-chain');
    });
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;

    await expect(
      LendingController.confirmDeposit(authCtx({ txHash: TX_HASH })),
    ).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  for (const action of ['withdraw', 'borrow', 'repay'] as const) {
    const confirm = (ctx: ReturnType<typeof authCtx>) => {
      if (action === 'withdraw') return LendingController.confirmWithdraw(ctx);
      if (action === 'borrow') return LendingController.confirmBorrow(ctx);
      return LendingController.confirmRepay(ctx);
    };

    describe(`confirm ${action} rejects unverified transactions`, () => {
      const failures = [
        ['a failed transaction', { status: 'FAILED' }, 422],
        ['a different contract', { contractId: OTHER_CONTRACT_ID }, 422],
        ['a different function', { functionName: 'deposit' }, 422],
        ['a different actor', { actor: OTHER_WALLET }, 403],
        ['a different pool', { poolId: 'another-pool' }, 422],
      ] as const;

      for (const [description, overrides, statusCode] of failures) {
        it(`does not write for ${description}`, async () => {
          const response = makeActionResponse(action, overrides);
          serviceMocks.verifyContractTransaction = mock(
            async (hash: string, contractId: string, functionName: string) =>
              makeStellarService(response).verifyContractTransaction(
                hash,
                contractId,
                functionName,
              ),
          );
          (stellarService as any).verifyContractTransaction =
            serviceMocks.verifyContractTransaction;

          await expect(confirm(authCtx({ txHash: TX_HASH }))).rejects.toMatchObject({
            statusCode,
          });
          expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
        });
      }
    });
  }

  it('does not delete an existing deposit when the post-withdraw position read fails', async () => {
    const rpcFailure = new Error('RPC timeout');
    serviceMocks.getLendingDepositPosition = mock(async () => {
      throw rpcFailure;
    });
    (stellarService as any).getLendingDepositPosition = serviceMocks.getLendingDepositPosition;

    await expect(LendingController.confirmWithdraw(authCtx({ txHash: TX_HASH }))).rejects.toBe(
      rpcFailure,
    );
    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('does not delete an existing borrow when the post-repay position read fails', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      ...verifiedDeposit,
      actualAmount: BigInt(500_000_000),
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;
    const rpcFailure = new Error('RPC timeout');
    serviceMocks.getLendingBorrowPosition = mock(async () => {
      throw rpcFailure;
    });
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;

    await expect(LendingController.confirmRepay(authCtx({ txHash: TX_HASH }))).rejects.toBe(
      rpcFailure,
    );
    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('does not update database positions when the post-borrow health-factor read fails', async () => {
    const rpcFailure = new Error('RPC timeout');
    serviceMocks.getLendingBorrowPosition = mock(async () => ({
      principal: BigInt(2_500_000_000),
      collateralAmount: BigInt(6_000_000_000),
      collateralAsset: OTHER_WALLET,
    }));
    serviceMocks.getLendingHealthFactor = mock(async () => {
      throw rpcFailure;
    });
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;
    (stellarService as any).getLendingHealthFactor = serviceMocks.getLendingHealthFactor;

    await expect(LendingController.confirmBorrow(authCtx({ txHash: TX_HASH }))).rejects.toBe(
      rpcFailure,
    );
    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('rejects a transaction signed by a different actor', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      ...verifiedDeposit,
      sourceAccount: OTHER_WALLET,
      args: [OTHER_WALLET, CONTRACT_POOL_ID, BigInt(1_000_000_000)],
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;

    await expect(
      LendingController.confirmDeposit(authCtx({ txHash: TX_HASH })),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('rejects a transaction for a different pool', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      ...verifiedDeposit,
      args: [WALLET, 'another-pool', BigInt(1_000_000_000)],
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;

    await expect(
      LendingController.confirmDeposit(authCtx({ txHash: TX_HASH })),
    ).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('treats duplicate confirmation as idempotent', async () => {
    let hasRecordedHash = false;
    let databaseWrites = 0;
    repositoryMocks.recordConfirmedAction = mock(async () => {
      if (hasRecordedHash) {
        return {
          recorded: false,
          transaction: { id: 'tx-1', hash: TX_HASH, status: 'confirmed' },
        };
      }
      hasRecordedHash = true;
      databaseWrites += 1;
      return {
        recorded: true,
        transaction: { id: 'tx-1', hash: TX_HASH, status: 'confirmed' },
      };
    });
    (lendingRepository as any).recordConfirmedAction = repositoryMocks.recordConfirmedAction;

    const first = await LendingController.confirmDeposit(authCtx({ txHash: TX_HASH }));
    const second = await LendingController.confirmDeposit(authCtx({ txHash: TX_HASH }));
    const firstBody = (await first.json()) as { recorded: boolean };
    const secondBody = (await second.json()) as { recorded: boolean };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.recorded).toBe(true);
    expect(secondBody.recorded).toBe(false);
    expect(repositoryMocks.recordConfirmedAction).toHaveBeenCalledTimes(2);
    expect(databaseWrites).toBe(1);
  });

  it('updates the existing borrow row on a second confirmed borrow', async () => {
    let confirmationCount = 0;
    const borrowRows = new Map<string, Record<string, unknown>>();
    serviceMocks.verifyContractTransaction = mock(async () => {
      confirmationCount += 1;
      return {
        txHash: confirmationCount === 1 ? TX_HASH : 'b'.repeat(64),
        sourceAccount: WALLET,
        contractId: CONTRACT_ID,
        functionName: 'borrow',
        args: [
          WALLET,
          CONTRACT_POOL_ID,
          BigInt(1_000_000_000),
          OTHER_WALLET,
          BigInt(5_000_000_000),
        ],
      };
    });
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;
    serviceMocks.getLendingBorrowPosition = mock(async () =>
      confirmationCount === 1
        ? {
            principal: BigInt(1_500_000_000),
            collateralAmount: BigInt(3_000_000_000),
            collateralAsset: OTHER_WALLET,
          }
        : {
            principal: BigInt(2_500_000_000),
            collateralAmount: BigInt(6_000_000_000),
            collateralAsset: OTHER_WALLET,
          },
    );
    serviceMocks.getLendingHealthFactor = mock(async () => BigInt('1500000000000000000'));
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;
    (stellarService as any).getLendingHealthFactor = serviceMocks.getLendingHealthFactor;
    repositoryMocks.recordConfirmedAction = mock(async (input: Record<string, any>) => {
      const key = `${input.poolId}:${input.userId}`;
      borrowRows.set(key, input.borrow);
      return {
        recorded: true,
        transaction: { id: `tx-${confirmationCount}`, hash: input.hash, status: 'confirmed' },
      };
    });
    (lendingRepository as any).recordConfirmedAction = repositoryMocks.recordConfirmedAction;

    await LendingController.confirmBorrow(authCtx({ txHash: TX_HASH }));
    await LendingController.confirmBorrow(authCtx({ txHash: 'b'.repeat(64) }));

    expect(repositoryMocks.recordConfirmedAction).toHaveBeenCalledTimes(2);
    expect(borrowRows.size).toBe(1);
    expect(borrowRows.get(`${POOL_ID}:${USER_ID}`)).toEqual({
      principal: '250.0000000',
      collateralAmount: '600.0000000',
      collateralAsset: OTHER_WALLET,
      healthFactor: '1.5000',
    });
  });

  it('caches the merged borrow position returned by the contract after a later borrow', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      txHash: TX_HASH,
      sourceAccount: WALLET,
      contractId: CONTRACT_ID,
      functionName: 'borrow',
      args: [WALLET, CONTRACT_POOL_ID, BigInt(1_000_000_000), OTHER_WALLET, BigInt(5_000_000_000)],
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;
    serviceMocks.getLendingBorrowPosition = mock(async () => ({
      principal: BigInt(2_500_000_000),
      collateralAmount: BigInt(6_000_000_000),
      collateralAsset: OTHER_WALLET,
    }));
    serviceMocks.getLendingHealthFactor = mock(async () => BigInt('1500000000000000000'));
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;
    (stellarService as any).getLendingHealthFactor = serviceMocks.getLendingHealthFactor;

    await LendingController.confirmBorrow(authCtx({ txHash: TX_HASH }));

    const recorded = repositoryMocks.recordConfirmedAction.mock.calls[0]?.[0] as Record<
      string,
      any
    >;
    // 250 from the contract's combined debt, not 100 + 150 added up here.
    expect(recorded.borrow).toEqual({
      principal: '250.0000000',
      collateralAmount: '600.0000000',
      collateralAsset: OTHER_WALLET,
      healthFactor: '1.5000',
    });
  });

  it('removes the cached borrow position when repayment clears the debt', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      txHash: TX_HASH,
      sourceAccount: WALLET,
      contractId: CONTRACT_ID,
      functionName: 'repay',
      args: [WALLET, CONTRACT_POOL_ID, BigInt(500_000_000)],
      actualAmount: BigInt(13),
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;
    serviceMocks.getLendingBorrowPosition = mock(async () => null);
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;

    await LendingController.confirmRepay(authCtx({ txHash: TX_HASH }));

    const recorded = repositoryMocks.recordConfirmedAction.mock.calls[0]?.[0] as Record<
      string,
      any
    >;
    expect(recorded.borrow).toBeNull();
    expect(recorded.amount).toBe('0.0000013');
  });
});

describe('liquidation', () => {
  it('prepares the four-argument call with the borrower wallet resolved from their user id', async () => {
    const response = await LendingController.prepareLiquidation({
      params: { id: POOL_ID, borrowerId: BORROWER_ID },
      body: { liquidator: LIQUIDATOR, debtToCover: '50' },
    });

    expect(response.status).toBe(200);
    expect(userFindByIdMock).toHaveBeenCalledWith(BORROWER_ID);
    expect(serviceMocks.prepareLiquidation).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      liquidator: LIQUIDATOR,
      poolId: CONTRACT_POOL_ID,
      borrowerAddress: BORROWER_WALLET,
      debtToCover: BigInt(500_000_000),
    });
  });

  it('refreshes the borrower position after a confirmed liquidation', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      txHash: TX_HASH,
      sourceAccount: LIQUIDATOR,
      contractId: CONTRACT_ID,
      functionName: 'liquidate',
      args: [LIQUIDATOR, CONTRACT_POOL_ID, BORROWER_WALLET, BigInt(500_000_000)],
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;
    serviceMocks.getLendingBorrowPosition = mock(async () => ({
      principal: BigInt(1_000_000_000),
      collateralAmount: BigInt(2_000_000_000),
      collateralAsset: OTHER_WALLET,
    }));
    serviceMocks.getLendingHealthFactor = mock(async () => BigInt('1500000000000000000'));
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;
    (stellarService as any).getLendingHealthFactor = serviceMocks.getLendingHealthFactor;

    const response = await LendingController.confirmLiquidation({
      params: { id: POOL_ID, borrowerId: BORROWER_ID },
      body: { txHash: TX_HASH },
    });

    expect(response.status).toBe(200);
    const recorded = repositoryMocks.recordConfirmedAction.mock.calls[0]?.[0] as Record<
      string,
      any
    >;
    expect(recorded).toMatchObject({
      type: 'liquidation',
      userId: BORROWER_ID,
      amount: '50.0000000',
      borrow: expect.objectContaining({ principal: '100.0000000' }),
    });
  });

  it('leaves the database untouched when the liquidation failed', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => {
      throw ApiError.validation('Transaction did not succeed on-chain');
    });
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;

    await expect(
      LendingController.confirmLiquidation({
        params: { id: POOL_ID, borrowerId: BORROWER_ID },
        body: { txHash: TX_HASH },
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('rejects a liquidation aimed at a different borrower', async () => {
    serviceMocks.verifyContractTransaction = mock(async () => ({
      txHash: TX_HASH,
      sourceAccount: LIQUIDATOR,
      contractId: CONTRACT_ID,
      functionName: 'liquidate',
      args: [LIQUIDATOR, CONTRACT_POOL_ID, OTHER_WALLET, BigInt(500_000_000)],
    }));
    (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;

    await expect(
      LendingController.confirmLiquidation({
        params: { id: POOL_ID, borrowerId: BORROWER_ID },
        body: { txHash: TX_HASH },
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
  });

  it('keeps prepare protected by the liquidator key', async () => {
    const app = new Elysia().use(errorHandler).use(lendingRoutes);
    const response = await app.handle(
      new Request(
        `http://localhost/lending/pools/${POOL_ID}/positions/${BORROWER_ID}/liquidate/prepare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liquidator: LIQUIDATOR, debtToCover: '50' }),
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(serviceMocks.prepareLiquidation).not.toHaveBeenCalled();
  });
});

describe('retired database-only write routes', () => {
  const app = new Elysia().use(errorHandler).use(lendingRoutes);

  for (const action of ['deposit', 'withdraw', 'borrow', 'repay']) {
    it(`POST /lending/pools/:id/${action} returns 410 and writes nothing`, async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${POOL_ID}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '10', borrowAmount: '10' }),
        }),
      );

      expect(response.status).toBe(410);
      expect(repositoryMocks.recordConfirmedAction).not.toHaveBeenCalled();
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('GONE');
    });
  }

  it('removed the repository ledger-writing methods entirely', () => {
    expect((lendingRepository as any).deposit).toBeUndefined();
    expect((lendingRepository as any).withdraw).toBeUndefined();
    expect((lendingRepository as any).borrow).toBeUndefined();
    expect((lendingRepository as any).repay).toBeUndefined();
    expect((lendingRepository as any).liquidate).toBeUndefined();
  });
});

describe.skipIf(!process.env.DATABASE_URL)('confirmed borrow database integration', () => {
  it('preserves a position on RPC failure, upserts a later borrow, and ignores duplicate hashes', async () => {
    const wallet = Keypair.random().publicKey();
    const poolContractId = `test-${randomUUID()}`;
    const hashes = [
      randomUUID().replaceAll('-', '').repeat(2),
      randomUUID().replaceAll('-', '').repeat(2),
    ];
    let userId: string | undefined;
    let poolId: string | undefined;

    try {
      const [user] = await db.insert(users).values({ walletAddress: wallet }).returning();
      if (!user) {
        throw new Error('Failed to create the confirmed-borrow test user');
      }
      userId = user.id;
      const [pool] = await db
        .insert(lendingPools)
        .values({
          name: 'Confirmed borrow integration pool',
          asset: 'USDC',
          assetAddress: wallet,
          contractPoolId: poolContractId,
          collateralFactor: '0.75',
          liquidationThreshold: '0.80',
          liquidationPenalty: '0.05',
        })
        .returning();
      if (!pool) {
        throw new Error('Failed to create the confirmed-borrow test pool');
      }
      poolId = pool.id;

      repositoryMocks.findById = mock(async () => ({
        ...poolFixture,
        id: poolId,
        contractPoolId: poolContractId,
      }));
      (lendingRepository as any).findById = repositoryMocks.findById;
      (lendingRepository as any).recordConfirmedAction =
        originalRepositoryMethods.recordConfirmedAction;

      const verifiedBorrow = (txHash: string) => ({
        txHash,
        sourceAccount: wallet,
        contractId: CONTRACT_ID,
        functionName: 'borrow',
        args: [wallet, poolContractId, BigInt(1_000_000_000), OTHER_WALLET, BigInt(5_000_000_000)],
      });
      const verifiedTransactions = [
        verifiedBorrow(hashes[0]!),
        verifiedBorrow(randomUUID().replaceAll('-', '').repeat(2)),
        verifiedBorrow(hashes[1]!),
        verifiedBorrow(hashes[1]!),
      ];
      serviceMocks.verifyContractTransaction = mock(async () => verifiedTransactions.shift()!);
      (stellarService as any).verifyContractTransaction = serviceMocks.verifyContractTransaction;

      let borrowReadCount = 0;
      serviceMocks.getLendingBorrowPosition = mock(async () => {
        borrowReadCount += 1;
        if (borrowReadCount === 2) {
          throw new Error('RPC timeout');
        }

        return {
          principal: BigInt(
            borrowReadCount === 1
              ? 1_500_000_000
              : borrowReadCount === 3
                ? 2_500_000_000
                : 9_000_000_000,
          ),
          collateralAmount: BigInt(6_000_000_000),
          collateralAsset: OTHER_WALLET,
        };
      });
      (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;
      serviceMocks.getLendingHealthFactor = mock(async () => BigInt('1500000000000000000'));
      (stellarService as any).getLendingHealthFactor = serviceMocks.getLendingHealthFactor;

      const context = (txHash: string) =>
        authCtx(
          { txHash },
          {
            params: { id: poolId! },
            userId,
            wallet,
          },
        );
      const readPosition = async () => {
        const [position] = await db
          .select()
          .from(borrowPositions)
          .where(and(eq(borrowPositions.poolId, poolId!), eq(borrowPositions.borrowerId, userId!)));
        expect(position).toBeDefined();
        return position!;
      };

      const firstConfirmation = await LendingController.confirmBorrow(context(hashes[0]!));
      expect(((await firstConfirmation.json()) as { recorded: boolean }).recorded).toBe(true);
      expect((await readPosition()).principal).toBe('150.0000000');

      await expect(
        LendingController.confirmBorrow(context(randomUUID().replaceAll('-', '').repeat(2))),
      ).rejects.toThrow('RPC timeout');
      expect((await readPosition()).principal).toBe('150.0000000');

      const secondConfirmation = await LendingController.confirmBorrow(context(hashes[1]!));
      expect(((await secondConfirmation.json()) as { recorded: boolean }).recorded).toBe(true);
      expect((await readPosition()).principal).toBe('250.0000000');

      const duplicateConfirmation = await LendingController.confirmBorrow(context(hashes[1]!));
      expect(((await duplicateConfirmation.json()) as { recorded: boolean }).recorded).toBe(false);
      expect((await readPosition()).principal).toBe('250.0000000');

      const recordedTransactions = await db
        .select()
        .from(transactions)
        .where(inArray(transactions.hash, hashes));
      expect(recordedTransactions).toHaveLength(2);
    } finally {
      if (poolId) {
        await db.delete(borrowPositions).where(eq(borrowPositions.poolId, poolId));
      }
      await db.delete(transactions).where(inArray(transactions.hash, hashes));
      if (poolId) {
        await db.delete(lendingPools).where(eq(lendingPools.id, poolId));
      }
      if (userId) {
        await db.delete(users).where(eq(users.id, userId));
      }
    }
  });
});
