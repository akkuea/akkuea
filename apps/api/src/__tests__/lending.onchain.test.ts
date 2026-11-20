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
import { Elysia } from 'elysia';
import {
  Account,
  Contract,
  Keypair,
  Networks,
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

const NETWORK_PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = 'CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX';
const OTHER_CONTRACT_ID = 'CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4';
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
  assetAddress: OTHER_WALLET,
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
    events: { contractEventsXdr: [] },
  } as unknown as Awaited<ReturnType<SorobanRpc.Server['getTransaction']>>;
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
    getLendingHealthFactor: mock(async () => null),
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
    assetAddress: OTHER_WALLET,
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
        collateralAsset: OTHER_WALLET,
      }),
    );

    expect(serviceMocks.prepareLendingAction).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      action: 'borrow',
      wallet: WALLET,
      poolId: CONTRACT_POOL_ID,
      amount: BigInt(3_000_000_000),
      collateralAsset: OTHER_WALLET,
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
    repositoryMocks.recordConfirmedAction = mock(async () => ({
      recorded: false,
      transaction: { id: 'tx-1', hash: TX_HASH, status: 'confirmed' },
    }));
    (lendingRepository as any).recordConfirmedAction = repositoryMocks.recordConfirmedAction;

    const response = await LendingController.confirmDeposit(authCtx({ txHash: TX_HASH }));
    const body = (await response.json()) as { recorded: boolean };

    expect(response.status).toBe(200);
    expect(body.recorded).toBe(false);
    expect(repositoryMocks.recordConfirmedAction).toHaveBeenCalledTimes(1);
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
    (stellarService as any).getLendingBorrowPosition = serviceMocks.getLendingBorrowPosition;

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
