/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * On-chain settlement and confirmation tests for LendingController,
 * LendingRepository, lendingRoutes, and StellarService lending helpers.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';
import { getTableConfig } from 'drizzle-orm/pg-core';
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
import { errorHandler } from '../middleware/errorHandler';
import { lendingRoutes } from '../routes/lending';
import {
  lendingRepository,
  type ConfirmedLendingRecordResult,
  type RecordConfirmedLendingActionParams,
} from '../repositories/LendingRepository';
import { userRepository } from '../repositories/UserRepository';
import { stellarService, type LendingAction } from '../services/StellarService';
import {
  borrowPositions,
  depositPositions,
  lendingPools,
  transactions,
  users,
  type BorrowPosition,
  type DepositPosition,
  type LendingPool,
} from '../db/schema';
import { db } from '../db';
import { and, eq } from 'drizzle-orm';

const NETWORK_PASSPHRASE = Networks.TESTNET;
const DEFI_CONTRACT_ID = 'CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4';
const OTHER_CONTRACT_ID = 'CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX';
const COLLATERAL_TOKEN_ID = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const ASSET_TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const ADMIN_KEYPAIR = Keypair.random();
const USER_WALLET = Keypair.random().publicKey();
const OTHER_WALLET = Keypair.random().publicKey();
const BORROWER_WALLET = Keypair.random().publicKey();
const LIQUIDATOR_WALLET = Keypair.random().publicKey();

const OPS_SECRET = 'test-lending-ops-secret';
const LIQUIDATOR_SECRET = 'test-lending-liquidator-secret';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

const POOL_UUID = '11111111-1111-4111-8111-111111111111';
const USER_UUID = '22222222-2222-4222-8222-222222222222';
const BORROWER_UUID = '33333333-3333-4333-8333-333333333333';
const LIQUIDATOR_UUID = '44444444-4444-4444-8444-444444444444';
const CONTRACT_POOL_ID = 'usdc-main-pool';

function makeJwt(userId: string, walletAddress: string): string {
  return jwt.sign({ id: userId, walletAddress }, JWT_SECRET);
}

function buildLendingEnvelope(params: {
  sourceAccount: string;
  contractId: string;
  functionName: string;
  scArgs: xdr.ScVal[];
}): xdr.TransactionEnvelope {
  const contract = new Contract(params.contractId);
  const account = new Account(params.sourceAccount, '0');
  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(params.functionName, ...params.scArgs) as unknown as xdr.Operation)
    .setTimeout(0)
    .build();

  return xdr.TransactionEnvelope.fromXDR(transaction.toXDR(), 'base64');
}

function argsForAction(
  action: LendingAction,
  overrides: {
    actor?: string;
    poolId?: string;
    amount?: bigint;
    collateralAsset?: string;
    collateralAmount?: bigint;
    borrowerAddress?: string;
    debtToCover?: bigint;
  } = {},
): xdr.ScVal[] {
  const actor = overrides.actor ?? (action === 'liquidate' ? LIQUIDATOR_WALLET : USER_WALLET);
  const poolId = overrides.poolId ?? CONTRACT_POOL_ID;

  switch (action) {
    case 'deposit':
    case 'withdraw':
    case 'repay':
      return [
        nativeToScVal(actor, { type: 'address' }),
        nativeToScVal(poolId, { type: 'string' }),
        nativeToScVal(overrides.amount ?? 250_0000000n, { type: 'i128' }),
      ];
    case 'borrow':
      return [
        nativeToScVal(actor, { type: 'address' }),
        nativeToScVal(poolId, { type: 'string' }),
        nativeToScVal(overrides.amount ?? 300_0000000n, { type: 'i128' }),
        nativeToScVal(overrides.collateralAsset ?? COLLATERAL_TOKEN_ID, { type: 'address' }),
        nativeToScVal(overrides.collateralAmount ?? 500_0000000n, { type: 'i128' }),
      ];
    case 'liquidate':
      return [
        nativeToScVal(actor, { type: 'address' }),
        nativeToScVal(poolId, { type: 'string' }),
        nativeToScVal(overrides.borrowerAddress ?? BORROWER_WALLET, { type: 'address' }),
        nativeToScVal(overrides.debtToCover ?? 150_0000000n, { type: 'i128' }),
      ];
  }
}

function emptyMeta(): xdr.TransactionMeta {
  return xdr.TransactionMeta.v3(
    new xdr.TransactionMetaV3({
      ext: xdr.ExtensionPoint.v0(),
      txChangesBefore: [],
      operations: [],
      txChangesAfter: [],
      sorobanMeta: null,
    }),
  );
}

function fakeRpcTxResponse(params: {
  txHash: string;
  status?: string;
  envelopeXdr?: xdr.TransactionEnvelope;
}) {
  return {
    status: params.status ?? 'SUCCESS',
    txHash: params.txHash,
    latestLedger: 200,
    latestLedgerCloseTime: 1,
    oldestLedger: 1,
    oldestLedgerCloseTime: 1,
    ledger: 199,
    createdAt: 1,
    applicationOrder: 1,
    feeBump: false,
    envelopeXdr:
      params.envelopeXdr ??
      buildLendingEnvelope({
        sourceAccount: USER_WALLET,
        contractId: DEFI_CONTRACT_ID,
        functionName: 'deposit',
        scArgs: argsForAction('deposit'),
      }),
    resultMetaXdr: emptyMeta(),
    events: { contractEventsXdr: [] },
  } as unknown as Awaited<ReturnType<SorobanRpc.Server['getTransaction']>>;
}

function makeBasePool(): LendingPool {
  return {
    id: POOL_UUID,
    contractPoolId: CONTRACT_POOL_ID,
    name: 'USDC Main Pool',
    asset: 'USDC',
    assetAddress: ASSET_TOKEN_ID,
    totalDeposits: '1000.0000000',
    totalBorrows: '300.0000000',
    availableLiquidity: '700.0000000',
    utilizationRate: '30.00',
    supplyAPY: '4.50',
    borrowAPY: '7.20',
    collateralFactor: '0.75',
    liquidationThreshold: '0.80',
    liquidationPenalty: '0.05',
    reserveFactor: 1000,
    isActive: true,
    isPaused: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('Lending on-chain settlement (defi-rwa prepare/confirm)', () => {
  const app = new Elysia().use(errorHandler).use(lendingRoutes);
  const userToken = makeJwt(USER_UUID, USER_WALLET);

  const prevEnv = {
    OPERATIONS_BACKEND_CREDENTIAL: process.env.OPERATIONS_BACKEND_CREDENTIAL,
    LIQUIDATOR_API_KEY: process.env.LIQUIDATOR_API_KEY,
    DEFI_RWA_CONTRACT_ID: process.env.DEFI_RWA_CONTRACT_ID,
    STELLAR_ADMIN_PUBLIC_KEY: process.env.STELLAR_ADMIN_PUBLIC_KEY,
    STELLAR_ADMIN_SECRET: process.env.STELLAR_ADMIN_SECRET,
  };

  let origRepoFindById: typeof lendingRepository.findById;
  let origRepoFindActivePool: typeof lendingRepository.findActivePool;
  let origRepoFindByContractPoolId: typeof lendingRepository.findByContractPoolId;
  let origRepoCreate: typeof lendingRepository.create;
  let origRepoUpdate: typeof lendingRepository.update;
  let origRepoDelete: typeof lendingRepository.delete;
  let origRepoRecordConfirmed: typeof lendingRepository.recordConfirmedLendingAction;
  let origUserFindById: typeof userRepository.findById;
  let origUserGetOrCreateByWallet: typeof userRepository.getOrCreateByWallet;
  let origCreateDefiLendingClient: any;
  let origGetSorobanRpcServer: any;
  let origCallAndSubmitContract: any;

  // In-memory state backing mocked repository calls for deterministic unit verification
  let currentPool: LendingPool;
  let depositsByKey: Map<string, DepositPosition>;
  let borrowsByKey: Map<string, BorrowPosition>;
  let recordedHashes: Map<string, RecordConfirmedLendingActionParams>;
  let dbWriteCount: number;

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = OPS_SECRET;
    process.env.LIQUIDATOR_API_KEY = LIQUIDATOR_SECRET;
    process.env.DEFI_RWA_CONTRACT_ID = DEFI_CONTRACT_ID;
    process.env.STELLAR_ADMIN_PUBLIC_KEY = ADMIN_KEYPAIR.publicKey();
    process.env.STELLAR_ADMIN_SECRET = ADMIN_KEYPAIR.secret();

    origRepoFindById = lendingRepository.findById;
    origRepoFindActivePool = lendingRepository.findActivePool;
    origRepoFindByContractPoolId = lendingRepository.findByContractPoolId;
    origRepoCreate = lendingRepository.create;
    origRepoUpdate = lendingRepository.update;
    origRepoDelete = lendingRepository.delete;
    origRepoRecordConfirmed = lendingRepository.recordConfirmedLendingAction;
    origUserFindById = userRepository.findById;
    origUserGetOrCreateByWallet = userRepository.getOrCreateByWallet;
    origCreateDefiLendingClient = (stellarService as any).createDefiLendingClient;
    origGetSorobanRpcServer = (stellarService as any).getSorobanRpcServer;
    origCallAndSubmitContract = stellarService.callAndSubmitContract;

    currentPool = makeBasePool();
    depositsByKey = new Map();
    borrowsByKey = new Map();
    recordedHashes = new Map();
    dbWriteCount = 0;

    borrowsByKey.set(`${POOL_UUID}:${BORROWER_UUID}`, {
      id: '99999999-9999-4999-8999-999999999999',
      poolId: POOL_UUID,
      borrowerId: BORROWER_UUID,
      principal: '300.0000000',
      accruedInterest: '0.0000000',
      collateralAmount: '500.0000000',
      collateralAsset: COLLATERAL_TOKEN_ID,
      healthFactor: '0.8500',
      borrowedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastAccrualAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    (lendingRepository as any).findById = async (id: string) =>
      id === currentPool.id ? currentPool : undefined;
    (lendingRepository as any).findActivePool = async (id: string) =>
      id === currentPool.id && currentPool.isActive && !currentPool.isPaused
        ? currentPool
        : undefined;
    (lendingRepository as any).findByContractPoolId = async (cid: string) =>
      cid === currentPool.contractPoolId ? currentPool : undefined;

    (lendingRepository as any).recordConfirmedLendingAction = async (
      params: RecordConfirmedLendingActionParams,
    ): Promise<ConfirmedLendingRecordResult> => {
      const prior = recordedHashes.get(params.txHash);
      if (prior) {
        return {
          recorded: false,
          txHash: params.txHash,
          pool: currentPool,
          depositPosition:
            params.kind === 'deposit'
              ? (depositsByKey.get(`${params.poolId}:${params.positionUserId}`) ?? null)
              : null,
          borrowPosition:
            params.kind === 'borrow'
              ? (borrowsByKey.get(`${params.poolId}:${params.positionUserId}`) ?? null)
              : null,
        };
      }

      dbWriteCount += 1;
      recordedHashes.set(params.txHash, params);

      currentPool = {
        ...currentPool,
        totalDeposits: params.totalDeposits,
        totalBorrows: params.totalBorrows,
        availableLiquidity: params.availableLiquidity,
        utilizationRate: params.utilizationRate,
      };

      const key = `${params.poolId}:${params.positionUserId}`;
      let syncedDeposit: DepositPosition | null = null;
      let syncedBorrow: BorrowPosition | null = null;
      const now = new Date('2026-01-02T00:00:00.000Z');

      if (params.kind === 'deposit') {
        if (params.depositPosition === null) {
          depositsByKey.delete(key);
        } else {
          const existing = depositsByKey.get(key);
          syncedDeposit = {
            id: existing?.id ?? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            poolId: params.poolId,
            depositorId: params.positionUserId,
            amount: params.depositPosition.amount,
            shares: params.depositPosition.shares,
            depositedAt: existing?.depositedAt ?? now,
            lastAccrualAt: now,
            accruedInterest: params.depositPosition.accruedInterest ?? '0.0000000',
          };
          depositsByKey.set(key, syncedDeposit);
        }
      } else {
        if (params.borrowPosition === null) {
          borrowsByKey.delete(key);
        } else {
          const existing = borrowsByKey.get(key);
          syncedBorrow = {
            id: existing?.id ?? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            poolId: params.poolId,
            borrowerId: params.positionUserId,
            principal: params.borrowPosition.principal,
            accruedInterest: params.borrowPosition.accruedInterest ?? '0.0000000',
            collateralAmount: params.borrowPosition.collateralAmount,
            collateralAsset: params.borrowPosition.collateralAsset,
            healthFactor: params.borrowPosition.healthFactor,
            borrowedAt: existing?.borrowedAt ?? now,
            lastAccrualAt: now,
          };
          borrowsByKey.set(key, syncedBorrow);
        }
      }

      return {
        recorded: true,
        txHash: params.txHash,
        pool: currentPool,
        depositPosition: syncedDeposit,
        borrowPosition: syncedBorrow,
      };
    };

    (userRepository as any).findById = async (id: string) => {
      if (id === BORROWER_UUID) {
        return { id: BORROWER_UUID, walletAddress: BORROWER_WALLET };
      }
      if (id === USER_UUID) {
        return { id: USER_UUID, walletAddress: USER_WALLET };
      }
      return undefined;
    };

    (userRepository as any).getOrCreateByWallet = async (walletAddress: string) => {
      if (walletAddress === LIQUIDATOR_WALLET) {
        return { id: LIQUIDATOR_UUID, walletAddress: LIQUIDATOR_WALLET };
      }
      return { id: USER_UUID, walletAddress };
    };
  });

  afterEach(() => {
    (lendingRepository as any).findById = origRepoFindById;
    (lendingRepository as any).findActivePool = origRepoFindActivePool;
    (lendingRepository as any).findByContractPoolId = origRepoFindByContractPoolId;
    (lendingRepository as any).create = origRepoCreate;
    (lendingRepository as any).update = origRepoUpdate;
    (lendingRepository as any).delete = origRepoDelete;
    (lendingRepository as any).recordConfirmedLendingAction = origRepoRecordConfirmed;
    (userRepository as any).findById = origUserFindById;
    (userRepository as any).getOrCreateByWallet = origUserGetOrCreateByWallet;
    (stellarService as any).createDefiLendingClient = origCreateDefiLendingClient;
    (stellarService as any).getSorobanRpcServer = origGetSorobanRpcServer;
    (stellarService as any).callAndSubmitContract = origCallAndSubmitContract;

    for (const [key, val] of Object.entries(prevEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  describe('AC 1: Retired direct write routes never touch repository write methods', () => {
    it('removes unverified balance write methods from LendingRepository and returns 410 Gone on old write routes', async () => {
      expect('deposit' in lendingRepository).toBe(false);
      expect('withdraw' in lendingRepository).toBe(false);
      expect('borrow' in lendingRepository).toBe(false);
      expect('repay' in lendingRepository).toBe(false);
      expect('liquidate' in lendingRepository).toBe(false);

      const recordSpy = mock(lendingRepository.recordConfirmedLendingAction);
      const createSpy = mock(async () => currentPool);
      const updateSpy = mock(async () => currentPool);
      const deleteSpy = mock(async () => true);
      (lendingRepository as any).recordConfirmedLendingAction = recordSpy;
      (lendingRepository as any).create = createSpy;
      (lendingRepository as any).update = updateSpy;
      (lendingRepository as any).delete = deleteSpy;

      const retiredUserCalls = [
        {
          path: `/lending/pools/${POOL_UUID}/deposit`,
          body: { amount: '100' },
          expectedPrepare: `/lending/pools/${POOL_UUID}/deposit/prepare`,
        },
        {
          path: `/lending/pools/${POOL_UUID}/withdraw`,
          body: { amount: '50' },
          expectedPrepare: `/lending/pools/${POOL_UUID}/withdraw/prepare`,
        },
        {
          path: `/lending/pools/${POOL_UUID}/borrow`,
          body: {
            borrowAmount: '100',
            collateralAmount: '200',
            collateralAsset: COLLATERAL_TOKEN_ID,
          },
          expectedPrepare: `/lending/pools/${POOL_UUID}/borrow/prepare`,
        },
        {
          path: `/lending/pools/${POOL_UUID}/repay`,
          body: { amount: '50' },
          expectedPrepare: `/lending/pools/${POOL_UUID}/repay/prepare`,
        },
      ];

      for (const route of retiredUserCalls) {
        const res = await app.handle(
          new Request(`http://localhost${route.path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken}`,
            },
            body: JSON.stringify(route.body),
          }),
        );
        expect(res.status).toBe(410);
        const body = (await res.json()) as any;
        expect(body.message).toContain(route.expectedPrepare);
      }

      const liqRes = await app.handle(
        new Request(
          `http://localhost/lending/pools/${POOL_UUID}/positions/${BORROWER_UUID}/liquidate`,
          {
            method: 'POST',
            headers: { 'x-api-key': LIQUIDATOR_SECRET },
          },
        ),
      );
      expect(liqRes.status).toBe(410);
      const liqBody = (await liqRes.json()) as any;
      expect(liqBody.message).toContain(
        `/lending/pools/${POOL_UUID}/positions/${BORROWER_UUID}/liquidate/prepare`,
      );

      expect(recordSpy).not.toHaveBeenCalled();
      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('AC 2: POST /lending/pools operator-only authorization and on-chain create_pool', () => {
    it('rejects a normal authenticated user with 403 and invokes neither the contract nor repository', async () => {
      const createPoolContractMock = mock(async () => ({}));
      const repoCreateMock = mock(async () => currentPool);
      (stellarService as any).createDefiLendingClient = () => ({
        createPool: createPoolContractMock,
      });
      (lendingRepository as any).create = repoCreateMock;

      const res = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            contractPoolId: 'new-usdc-pool',
            name: 'USDC Pool',
            asset: 'USDC',
            assetAddress: ASSET_TOKEN_ID,
            collateralFactor: '0.75',
            liquidationThreshold: '0.80',
            liquidationPenalty: '0.05',
            closeFactor: '0.50',
            reserveFactor: 1000,
          }),
        }),
      );

      expect(res.status).toBe(403);
      expect(createPoolContractMock).not.toHaveBeenCalled();
      expect(repoCreateMock).not.toHaveBeenCalled();
    });

    it('creates the pool on-chain with closeFactor for an authorized operator and stores contract_pool_id', async () => {
      const signAndSendMock = mock(async () => ({
        sendTransactionResponse: { hash: 'a'.repeat(64) },
      }));
      const createPoolContractMock = mock(async (_args: any) => ({
        simulation: undefined,
        result: { isErr: () => false },
        signAndSend: signAndSendMock,
      }));
      (stellarService as any).createDefiLendingClient = () => ({
        createPool: createPoolContractMock,
      });

      let persistedRow: any = null;
      (lendingRepository as any).findByContractPoolId = async () => undefined;
      (lendingRepository as any).create = async (row: any) => {
        persistedRow = row;
        return {
          ...makeBasePool(),
          ...row,
          id: '77777777-7777-4777-8777-777777777777',
        };
      };

      const res = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
          },
          body: JSON.stringify({
            contractPoolId: 'operator-usdc-pool',
            name: 'Operator USDC Pool',
            asset: 'USDC',
            assetAddress: ASSET_TOKEN_ID,
            collateralFactor: '0.75',
            liquidationThreshold: '0.80',
            liquidationPenalty: '0.05',
            closeFactor: '0.50',
            reserveFactor: 1000,
          }),
        }),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.contractPoolId).toBe('operator-usdc-pool');
      expect(body.txHash).toBe('a'.repeat(64));

      expect(createPoolContractMock).toHaveBeenCalledTimes(1);
      expect(createPoolContractMock.mock.calls[0]?.[0]).toEqual({
        admin: ADMIN_KEYPAIR.publicKey(),
        poolId: 'operator-usdc-pool',
        name: 'Operator USDC Pool',
        asset: 'USDC',
        assetAddress: ASSET_TOKEN_ID,
        collateralFactor: 750_000_000_000_000_000n,
        liquidationThreshold: 800_000_000_000_000_000n,
        liquidationPenalty: 50_000_000_000_000_000n,
        closeFactor: 500_000_000_000_000_000n,
        reserveFactor: 1000,
      });
      expect(signAndSendMock).toHaveBeenCalledTimes(1);
      expect(persistedRow?.contractPoolId).toBe('operator-usdc-pool');
    });

    it('does not insert into lending_pools when on-chain create_pool fails', async () => {
      const repoCreateMock = mock(async () => currentPool);
      (lendingRepository as any).findByContractPoolId = async () => undefined;
      (lendingRepository as any).create = repoCreateMock;
      (stellarService as any).createDefiLendingClient = () => ({
        createPool: async () => {
          throw new Error('Contract trapped: InvalidCollateralFactor');
        },
      });

      const res = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
          },
          body: JSON.stringify({
            contractPoolId: 'broken-pool',
            name: 'Broken Pool',
            asset: 'USDC',
            assetAddress: ASSET_TOKEN_ID,
            collateralFactor: '0.95',
            liquidationThreshold: '0.80',
            liquidationPenalty: '0.05',
          }),
        }),
      );

      expect(res.status).toBe(400);
      expect(repoCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('AC 3: Confirm verification for every action (deposit, withdraw, borrow, repay, liquidate)', () => {
    const actions: Array<{
      action: LendingAction;
      wrongFunction: string;
      confirmPath: string;
      headers: () => Record<string, string>;
      confirmBody: (txHash: string) => Record<string, unknown>;
      actor: string;
    }> = [
      {
        action: 'deposit',
        wrongFunction: 'withdraw',
        confirmPath: `/lending/pools/${POOL_UUID}/deposit/confirm`,
        headers: () => ({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        }),
        confirmBody: (txHash) => ({ txHash }),
        actor: USER_WALLET,
      },
      {
        action: 'withdraw',
        wrongFunction: 'deposit',
        confirmPath: `/lending/pools/${POOL_UUID}/withdraw/confirm`,
        headers: () => ({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        }),
        confirmBody: (txHash) => ({ txHash }),
        actor: USER_WALLET,
      },
      {
        action: 'borrow',
        wrongFunction: 'repay',
        confirmPath: `/lending/pools/${POOL_UUID}/borrow/confirm`,
        headers: () => ({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        }),
        confirmBody: (txHash) => ({ txHash }),
        actor: USER_WALLET,
      },
      {
        action: 'repay',
        wrongFunction: 'borrow',
        confirmPath: `/lending/pools/${POOL_UUID}/repay/confirm`,
        headers: () => ({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        }),
        confirmBody: (txHash) => ({ txHash }),
        actor: USER_WALLET,
      },
      {
        action: 'liquidate',
        wrongFunction: 'repay',
        confirmPath: `/lending/pools/${POOL_UUID}/positions/${BORROWER_UUID}/liquidate/confirm`,
        headers: () => ({
          'Content-Type': 'application/json',
          'x-api-key': LIQUIDATOR_SECRET,
        }),
        confirmBody: (txHash) => ({ txHash, liquidator: LIQUIDATOR_WALLET }),
        actor: LIQUIDATOR_WALLET,
      },
    ];

    function stubChainGettersForConfirm() {
      (stellarService as any).createDefiLendingClient = () => ({
        getTotalDeposits: async () => ({ result: 1250_0000000n }),
        getTotalBorrows: async () => ({ result: 420_0000000n }),
        getDepositPosition: async () => ({
          result: {
            amount: 600_0000000n,
            shares: 590_0000000n,
            deposited_at: 100n,
          },
        }),
        getBorrowPosition: async () => ({
          result: {
            principal: 420_0000000n,
            collateral_amount: 700_0000000n,
            collateral_asset: COLLATERAL_TOKEN_ID,
            borrowed_at: 101n,
          },
        }),
        getHealthFactor: async () => ({
          result: {
            isOk: () => true,
            isErr: () => false,
            unwrap: () => 1_333_300_000_000_000_000n,
          },
        }),
      });
    }

    for (const spec of actions) {
      describe(`${spec.action} confirm`, () => {
        it('rejects a failed on-chain transaction with no DB change', async () => {
          const txHash = 'b'.repeat(64);
          stubChainGettersForConfirm();
          (stellarService as any).getSorobanRpcServer = () => ({
            getTransaction: async () =>
              fakeRpcTxResponse({
                txHash,
                status: 'FAILED',
                envelopeXdr: buildLendingEnvelope({
                  sourceAccount: spec.actor,
                  contractId: DEFI_CONTRACT_ID,
                  functionName: spec.action,
                  scArgs: argsForAction(spec.action),
                }),
              }),
          });

          const res = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );

          expect(res.status).toBe(422);
          expect(dbWriteCount).toBe(0);
        });

        it('rejects a transaction targeting a different contract with no DB change', async () => {
          const txHash = 'c'.repeat(64);
          stubChainGettersForConfirm();
          (stellarService as any).getSorobanRpcServer = () => ({
            getTransaction: async () =>
              fakeRpcTxResponse({
                txHash,
                envelopeXdr: buildLendingEnvelope({
                  sourceAccount: spec.actor,
                  contractId: OTHER_CONTRACT_ID,
                  functionName: spec.action,
                  scArgs: argsForAction(spec.action),
                }),
              }),
          });

          const res = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );

          expect(res.status).toBe(422);
          expect(dbWriteCount).toBe(0);
        });

        it('rejects a transaction calling a different function with no DB change', async () => {
          const txHash = 'd'.repeat(64);
          stubChainGettersForConfirm();
          (stellarService as any).getSorobanRpcServer = () => ({
            getTransaction: async () =>
              fakeRpcTxResponse({
                txHash,
                envelopeXdr: buildLendingEnvelope({
                  sourceAccount: spec.actor,
                  contractId: DEFI_CONTRACT_ID,
                  functionName: spec.wrongFunction,
                  scArgs: argsForAction(spec.action),
                }),
              }),
          });

          const res = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );

          expect(res.status).toBe(422);
          expect(dbWriteCount).toBe(0);
        });

        it('rejects a transaction signed by a different actor with no DB change', async () => {
          const txHash = 'e'.repeat(64);
          stubChainGettersForConfirm();
          (stellarService as any).getSorobanRpcServer = () => ({
            getTransaction: async () =>
              fakeRpcTxResponse({
                txHash,
                envelopeXdr: buildLendingEnvelope({
                  sourceAccount: OTHER_WALLET,
                  contractId: DEFI_CONTRACT_ID,
                  functionName: spec.action,
                  scArgs: argsForAction(spec.action, { actor: OTHER_WALLET }),
                }),
              }),
          });

          const res = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );

          expect(res.status).toBe(403);
          expect(dbWriteCount).toBe(0);
        });

        it('rejects a transaction targeting a different pool with no DB change', async () => {
          const txHash = 'f'.repeat(64);
          stubChainGettersForConfirm();
          (stellarService as any).getSorobanRpcServer = () => ({
            getTransaction: async () =>
              fakeRpcTxResponse({
                txHash,
                envelopeXdr: buildLendingEnvelope({
                  sourceAccount: spec.actor,
                  contractId: DEFI_CONTRACT_ID,
                  functionName: spec.action,
                  scArgs: argsForAction(spec.action, { poolId: 'other-onchain-pool' }),
                }),
              }),
          });

          const res = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );

          expect(res.status).toBe(422);
          expect(dbWriteCount).toBe(0);
        });

        it('writes the exact values read back from defi-rwa and confirming the same hash twice returns the same result and writes once', async () => {
          const txHash = '9'.repeat(64);
          stubChainGettersForConfirm();
          (stellarService as any).getSorobanRpcServer = () => ({
            getTransaction: async () =>
              fakeRpcTxResponse({
                txHash,
                envelopeXdr: buildLendingEnvelope({
                  sourceAccount: spec.actor,
                  contractId: DEFI_CONTRACT_ID,
                  functionName: spec.action,
                  scArgs: argsForAction(spec.action),
                }),
              }),
          });

          const firstRes = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );
          expect(firstRes.status).toBe(200);
          const firstBody = (await firstRes.json()) as any;

          expect(firstBody.pool.totalDeposits).toBe('1250.0000000');
          expect(firstBody.pool.totalBorrows).toBe('420.0000000');
          expect(firstBody.pool.availableLiquidity).toBe('830.0000000');
          if (spec.action === 'deposit' || spec.action === 'withdraw') {
            expect(firstBody.position.amount).toBe('600.0000000');
            expect(firstBody.position.shares).toBe('590.0000000');
          } else {
            expect(firstBody.position.principal).toBe('420.0000000');
            expect(firstBody.position.collateralAmount).toBe('700.0000000');
            expect(firstBody.position.healthFactor).toBe('1.3333');
          }
          expect(dbWriteCount).toBe(1);

          // Confirm the exact same hash a second time
          const secondRes = await app.handle(
            new Request(`http://localhost${spec.confirmPath}`, {
              method: 'POST',
              headers: spec.headers(),
              body: JSON.stringify(spec.confirmBody(txHash)),
            }),
          );
          expect(secondRes.status).toBe(200);
          const secondBody = (await secondRes.json()) as any;

          expect(secondBody).toEqual(firstBody);
          expect(dbWriteCount).toBe(1);
        });
      });
    }
  });

  describe('AC 4 & Simulation errors: Liquidation four-arg prepare and no swallow-on-failure', () => {
    it('resolves borrower wallet from borrowerId and builds four-argument liquidate call', async () => {
      const liquidateClientMock = mock(async (_args: any) => ({
        simulation: undefined,
        result: { isErr: () => false },
        toXDR: () => 'AAAA-UNSIGNED-LIQUIDATE-XDR',
      }));
      (stellarService as any).createDefiLendingClient = () => ({
        liquidate: liquidateClientMock,
      });

      const res = await app.handle(
        new Request(
          `http://localhost/lending/pools/${POOL_UUID}/positions/${BORROWER_UUID}/liquidate/prepare`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': LIQUIDATOR_SECRET,
            },
            body: JSON.stringify({
              liquidator: LIQUIDATOR_WALLET,
              debt_to_cover: '150.25',
            }),
          },
        ),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.xdr).toBe('AAAA-UNSIGNED-LIQUIDATE-XDR');
      expect(body.borrowerAddress).toBe(BORROWER_WALLET);
      expect(body.contractPoolId).toBe(CONTRACT_POOL_ID);

      expect(liquidateClientMock).toHaveBeenCalledTimes(1);
      expect(liquidateClientMock.mock.calls[0]?.[0]).toEqual({
        liquidator: LIQUIDATOR_WALLET,
        poolId: CONTRACT_POOL_ID,
        borrowerAddress: BORROWER_WALLET,
        debtToCover: 150_2500000n,
      });
    });

    it('surfaces simulation failures on prepare as 400 with a readable message', async () => {
      (stellarService as any).createDefiLendingClient = () => ({
        borrow: async () => ({
          simulation: { error: 'HostError: Error(Contract, #11) HealthFactorTooLow' },
          toXDR: () => 'unused',
        }),
      });

      const res = await app.handle(
        new Request(`http://localhost/lending/pools/${POOL_UUID}/borrow/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            borrowAmount: '900',
            collateralAmount: '100',
            collateralAsset: COLLATERAL_TOKEN_ID,
          }),
        }),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('HealthFactorTooLow');
      expect(dbWriteCount).toBe(0);
    });

    it('leaves the borrow position untouched when on-chain liquidation fails (no swallow-and-delete)', async () => {
      const submitSpy = mock(async () => {
        throw new Error('Soroban liquidate trapped on-chain');
      });
      (stellarService as any).callAndSubmitContract = submitSpy;

      // 1. Legacy endpoint no longer calls callAndSubmitContract or deletes the position
      const legacyRes = await app.handle(
        new Request(
          `http://localhost/lending/pools/${POOL_UUID}/positions/${BORROWER_UUID}/liquidate`,
          {
            method: 'POST',
            headers: { 'x-api-key': LIQUIDATOR_SECRET },
          },
        ),
      );
      expect(legacyRes.status).toBe(410);
      expect(submitSpy).not.toHaveBeenCalled();
      expect(borrowsByKey.get(`${POOL_UUID}:${BORROWER_UUID}`)?.principal).toBe('300.0000000');

      // 2. Failed on-chain liquidation transaction on /liquidate/confirm leaves position untouched
      const failedTxHash = '8'.repeat(64);
      (stellarService as any).getSorobanRpcServer = () => ({
        getTransaction: async () =>
          fakeRpcTxResponse({
            txHash: failedTxHash,
            status: 'FAILED',
            envelopeXdr: buildLendingEnvelope({
              sourceAccount: LIQUIDATOR_WALLET,
              contractId: DEFI_CONTRACT_ID,
              functionName: 'liquidate',
              scArgs: argsForAction('liquidate'),
            }),
          }),
      });

      const confirmRes = await app.handle(
        new Request(
          `http://localhost/lending/pools/${POOL_UUID}/positions/${BORROWER_UUID}/liquidate/confirm`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': LIQUIDATOR_SECRET,
            },
            body: JSON.stringify({ txHash: failedTxHash, liquidator: LIQUIDATOR_WALLET }),
          },
        ),
      );

      expect(confirmRes.status).toBe(422);
      expect(dbWriteCount).toBe(0);
      expect(borrowsByKey.get(`${POOL_UUID}:${BORROWER_UUID}`)?.principal).toBe('300.0000000');
    });
  });

  describe('AC 5: One borrow position per (pool_id, borrower_id), merged in place', () => {
    it('declares unique index on borrow_positions(pool_id, borrower_id) and updates the same row on a second confirmed borrow', async () => {
      const tableConfig = getTableConfig(borrowPositions);
      const uniqueBorrowIdx = tableConfig.indexes.find(
        (idx) => idx.config.name === 'borrow_positions_pool_id_borrower_id_unique',
      );
      expect(uniqueBorrowIdx).toBeDefined();
      expect(uniqueBorrowIdx?.config.unique).toBe(true);

      const firstBorrowHash = '6'.repeat(64);
      const secondBorrowHash = '7'.repeat(64);

      (stellarService as any).getSorobanRpcServer = () => ({
        getTransaction: async (hash: string) =>
          fakeRpcTxResponse({
            txHash: hash,
            envelopeXdr: buildLendingEnvelope({
              sourceAccount: USER_WALLET,
              contractId: DEFI_CONTRACT_ID,
              functionName: 'borrow',
              scArgs: argsForAction('borrow', {
                amount: hash === firstBorrowHash ? 200_0000000n : 150_0000000n,
              }),
            }),
          }),
      });

      let chainPrincipal = 200_0000000n;
      let chainCollateral = 400_0000000n;
      (stellarService as any).createDefiLendingClient = () => ({
        getTotalDeposits: async () => ({ result: 1000_0000000n }),
        getTotalBorrows: async () => ({ result: chainPrincipal }),
        getBorrowPosition: async () => ({
          result: {
            principal: chainPrincipal,
            collateral_amount: chainCollateral,
            collateral_asset: COLLATERAL_TOKEN_ID,
            borrowed_at: 50n,
          },
        }),
        getHealthFactor: async () => ({ result: 1_500_000_000_000_000_000n }),
      });

      const res1 = await app.handle(
        new Request(`http://localhost/lending/pools/${POOL_UUID}/borrow/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ txHash: firstBorrowHash }),
        }),
      );
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as any;

      // Second borrow updates chain totals to 350 principal and 700 collateral
      chainPrincipal = 350_0000000n;
      chainCollateral = 700_0000000n;

      const res2 = await app.handle(
        new Request(`http://localhost/lending/pools/${POOL_UUID}/borrow/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ txHash: secondBorrowHash }),
        }),
      );
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as any;

      expect(body2.position.id).toBe(body1.position.id);
      expect(body2.position.principal).toBe('350.0000000');
      expect(body2.position.collateralAmount).toBe('700.0000000');
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)(
  'LendingRepository Postgres upsert & unique constraint (DB required)',
  () => {
    const dbBorrowerWallet = Keypair.random().publicKey();
    let dbPoolId = '';
    let dbUserId = '';
    const dbContractPoolId = `pg-unique-borrow-${Date.now()}`;

    afterAll(async () => {
      if (dbPoolId) {
        await db.delete(borrowPositions).where(eq(borrowPositions.poolId, dbPoolId));
        await db.delete(depositPositions).where(eq(depositPositions.poolId, dbPoolId));
        await db.delete(lendingPools).where(eq(lendingPools.id, dbPoolId));
      }
      if (dbUserId) {
        await db.delete(transactions).where(eq(transactions.fromUserId, dbUserId));
        await db.delete(users).where(eq(users.id, dbUserId));
      }
    });

    it('merges a second confirmed borrow into the same borrow_positions row in Postgres', async () => {
      const user = await userRepository.getOrCreateByWallet(dbBorrowerWallet);
      dbUserId = user.id;

      const pool = await lendingRepository.create({
        contractPoolId: dbContractPoolId,
        name: 'Postgres Upsert Pool',
        asset: 'USDC',
        assetAddress: ASSET_TOKEN_ID,
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
        reserveFactor: 1000,
      });
      dbPoolId = pool.id;

      const first = await lendingRepository.recordConfirmedLendingAction({
        txHash: 'a1'.padEnd(64, '0'),
        action: 'borrow',
        poolId: dbPoolId,
        contractPoolId: dbContractPoolId,
        contractId: DEFI_CONTRACT_ID,
        actorUserId: dbUserId,
        actorWallet: dbBorrowerWallet,
        positionUserId: dbUserId,
        amount: '100.0000000',
        asset: 'USDC',
        totalDeposits: '1000.0000000',
        totalBorrows: '100.0000000',
        availableLiquidity: '900.0000000',
        utilizationRate: '10.00',
        kind: 'borrow',
        depositPosition: null,
        borrowPosition: {
          principal: '100.0000000',
          collateralAmount: '200.0000000',
          collateralAsset: COLLATERAL_TOKEN_ID,
          healthFactor: '1.6000',
        },
      });

      const second = await lendingRepository.recordConfirmedLendingAction({
        txHash: 'a2'.padEnd(64, '0'),
        action: 'borrow',
        poolId: dbPoolId,
        contractPoolId: dbContractPoolId,
        contractId: DEFI_CONTRACT_ID,
        actorUserId: dbUserId,
        actorWallet: dbBorrowerWallet,
        positionUserId: dbUserId,
        amount: '150.0000000',
        asset: 'USDC',
        totalDeposits: '1000.0000000',
        totalBorrows: '250.0000000',
        availableLiquidity: '750.0000000',
        utilizationRate: '25.00',
        kind: 'borrow',
        depositPosition: null,
        borrowPosition: {
          principal: '250.0000000',
          collateralAmount: '450.0000000',
          collateralAsset: COLLATERAL_TOKEN_ID,
          healthFactor: '1.4400',
        },
      });

      expect(first.borrowPosition?.id).toBeDefined();
      expect(second.borrowPosition?.id).toBe(first.borrowPosition?.id);

      const rows = await db
        .select()
        .from(borrowPositions)
        .where(and(eq(borrowPositions.poolId, dbPoolId), eq(borrowPositions.borrowerId, dbUserId)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.principal).toBe('250.0000000');
    });
  },
);
