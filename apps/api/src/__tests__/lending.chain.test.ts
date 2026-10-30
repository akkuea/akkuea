/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Lending settles on the defi-rwa contract.
 *
 * Users sign deposit, withdraw, borrow and repay themselves (prepare returns
 * an unsigned XDR, confirm verifies the submitted hash on Soroban RPC), and
 * liquidators do the same for liquidate. Postgres only caches what the
 * contract returns after a verified transaction.
 *
 * The file has three parts:
 *  - StellarService helpers, against a fake RPC server with real XDR.
 *  - LendingController and the routes, with the RPC server faked and the
 *    repository stubbed on its singleton (no database needed).
 *  - LendingRepository.applyConfirmedAction against a real database.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';
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
import { and, eq } from 'drizzle-orm';
import { lendingRoutes } from '../routes/lending';
import { errorHandler } from '../middleware/errorHandler';
import { LendingController, type LendingUserAction } from '../controllers/LendingController';
import {
  StellarService,
  describeSimulationError,
  stellarService,
  type LendingChainState,
} from '../services/StellarService';
import { lendingRepository } from '../repositories/LendingRepository';
import { userRepository } from '../repositories/UserRepository';
import { NotificationService } from '../services/NotificationService';
import {
  formatHealthFactor,
  formatUtilizationRate,
  parseContractFactor,
  parseTokenAmount,
} from '../utils/lendingChainValues';

const NETWORK_PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = 'CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4';
const OTHER_CONTRACT_ID = 'CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX';
const POOL_ASSET = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const COLLATERAL_ASSET = OTHER_CONTRACT_ID;
const CONTRACT_POOL_ID = 'usdc-pool';
const POOL_ID = '6f1c2b1e-5d1a-4a53-9a9e-6f3b0e1c2d3a';
const USER_ID = '2b0e8400-e29b-41d4-a716-446655440000';
const BORROWER_ID = '3c0e8400-e29b-41d4-a716-446655440000';
const TX_HASH = 'e'.repeat(64);
const OPS_KEY = 'lending-chain-ops-key';
const LIQUIDATOR_KEY = 'lending-chain-liquidator-key';

const USER = Keypair.random().publicKey();
const OTHER_USER = Keypair.random().publicKey();
const BORROWER = Keypair.random().publicKey();
const LIQUIDATOR = Keypair.random().publicKey();

const ONE = BigInt('1000000000000000000');

// ---------------------------------------------------------------------------
// XDR and RPC fixtures
// ---------------------------------------------------------------------------

function address(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'address' });
}

function i128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: 'i128' });
}

function str(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'string' });
}

/** Arguments of each lending function, in contract order. */
function lendingArgs(
  functionName: string,
  params: { actor: string; poolId: string; amount: bigint; borrower?: string },
): xdr.ScVal[] {
  const base = [address(params.actor), str(params.poolId)];
  if (functionName === 'borrow') {
    return [...base, i128(params.amount), address(COLLATERAL_ASSET), i128(params.amount * 2n)];
  }
  if (functionName === 'liquidate') {
    return [...base, address(params.borrower ?? BORROWER), i128(params.amount)];
  }
  return [...base, i128(params.amount)];
}

function buildEnvelope(params: {
  contractId?: string;
  functionName: string;
  source?: string;
  actor?: string;
  poolId?: string;
  amount?: bigint;
  borrower?: string;
  callFunctionName?: string;
}): xdr.TransactionEnvelope {
  const source = params.source ?? params.actor ?? USER;
  const contract = new Contract(params.contractId ?? CONTRACT_ID);
  const transaction = new TransactionBuilder(new Account(source, '0'), {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        params.callFunctionName ?? params.functionName,
        ...lendingArgs(params.functionName, {
          actor: params.actor ?? source,
          poolId: params.poolId ?? CONTRACT_POOL_ID,
          amount: params.amount ?? BigInt(1_000_000_000),
          borrower: params.borrower,
        }),
      ) as unknown as xdr.Operation,
    )
    .setTimeout(0)
    .build();
  return xdr.TransactionEnvelope.fromXDR(transaction.toXDR(), 'base64');
}

function rpcResponse(envelope: xdr.TransactionEnvelope, status = 'SUCCESS') {
  return {
    status,
    txHash: TX_HASH,
    latestLedger: 100,
    latestLedgerCloseTime: 1,
    oldestLedger: 1,
    oldestLedgerCloseTime: 1,
    ledger: 99,
    createdAt: 1,
    applicationOrder: 1,
    feeBump: false,
    envelopeXdr: envelope,
    resultMetaXdr: xdr.TransactionMeta.v3(
      new xdr.TransactionMetaV3({
        ext: xdr.ExtensionPoint.v0(),
        txChangesBefore: [],
        operations: [],
        txChangesAfter: [],
        sorobanMeta: null,
      }),
    ),
    events: { contractEventsXdr: [] },
  };
}

function fakeRpc(response: unknown) {
  return {
    getTransaction: async () => response,
  } as unknown as InstanceType<typeof SorobanRpc.Server>;
}

function chainState(overrides: Partial<LendingChainState> = {}): LendingChainState {
  return {
    totalDeposits: BigInt(50_000_000_000),
    totalBorrows: BigInt(10_000_000_000),
    deposit: {
      pool_id: CONTRACT_POOL_ID,
      depositor: USER,
      amount: BigInt(1_000_000_000),
      shares: BigInt(1_000_000_000),
      index_at_deposit: ONE,
      deposited_at: BigInt(1_790_000_000),
    },
    borrow: {
      pool_id: CONTRACT_POOL_ID,
      borrower: USER,
      principal: BigInt(1_000_000_000),
      index_at_borrow: ONE,
      collateral_amount: BigInt(2_000_000_000),
      collateral_asset: COLLATERAL_ASSET,
      borrowed_at: BigInt(1_790_000_000),
      healthFactor: (ONE * 3n) / 2n,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Part 1: StellarService helpers
// ---------------------------------------------------------------------------

describe('StellarService.verifyLendingCall', () => {
  const service = (response: unknown) =>
    new StellarService(undefined, NETWORK_PASSPHRASE, fakeRpc(response));

  it('decodes a deposit call', async () => {
    const verified = await service(
      rpcResponse(buildEnvelope({ functionName: 'deposit', amount: BigInt(5) })),
    ).verifyLendingCall(TX_HASH, CONTRACT_ID, 'deposit');

    expect(verified).toMatchObject({
      txHash: TX_HASH,
      sourceAccount: USER,
      contractId: CONTRACT_ID,
      functionName: 'deposit',
      actor: USER,
      poolId: CONTRACT_POOL_ID,
      amount: BigInt(5),
    });
  });

  it('decodes the collateral of a borrow call', async () => {
    const verified = await service(
      rpcResponse(buildEnvelope({ functionName: 'borrow', amount: BigInt(7) })),
    ).verifyLendingCall(TX_HASH, CONTRACT_ID, 'borrow');

    expect(verified.collateralAsset).toBe(COLLATERAL_ASSET);
    expect(verified.collateralAmount).toBe(BigInt(14));
  });

  it('decodes the borrower and debt of a liquidate call', async () => {
    const verified = await service(
      rpcResponse(
        buildEnvelope({ functionName: 'liquidate', actor: LIQUIDATOR, amount: BigInt(9) }),
      ),
    ).verifyLendingCall(TX_HASH, CONTRACT_ID, 'liquidate');

    expect(verified).toMatchObject({
      actor: LIQUIDATOR,
      borrower: BORROWER,
      amount: BigInt(9),
    });
  });

  it('rejects a failed transaction', async () => {
    await expect(
      service(rpcResponse(buildEnvelope({ functionName: 'deposit' }), 'FAILED')).verifyLendingCall(
        TX_HASH,
        CONTRACT_ID,
        'deposit',
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a call to another contract', async () => {
    await expect(
      service(
        rpcResponse(buildEnvelope({ functionName: 'deposit', contractId: OTHER_CONTRACT_ID })),
      ).verifyLendingCall(TX_HASH, CONTRACT_ID, 'deposit'),
    ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('contract') });
  });

  it('rejects a call to another function', async () => {
    await expect(
      service(rpcResponse(buildEnvelope({ functionName: 'withdraw' }))).verifyLendingCall(
        TX_HASH,
        CONTRACT_ID,
        'deposit',
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('expected deposit'),
    });
  });
});

describe('StellarService.prepareLendingCall', () => {
  let original: any;
  beforeEach(() => {
    original = (stellarService as any).buildTypedContractTransaction;
  });
  afterEach(() => {
    (stellarService as any).buildTypedContractTransaction = original;
  });

  it('returns the simulated XDR with the wallet as source', async () => {
    let received: unknown[] = [];
    (stellarService as any).buildTypedContractTransaction = async (...args: unknown[]) => {
      received = args;
      return { simulation: { id: '1', latestLedger: 1, transactionData: {} }, toXDR: () => 'XDR' };
    };

    const prepared = await stellarService.prepareLendingCall({
      contractId: CONTRACT_ID,
      source: USER,
      functionName: 'deposit',
      args: [USER, CONTRACT_POOL_ID, BigInt(10)],
    });

    expect(prepared).toEqual({ xdr: 'XDR', contractId: CONTRACT_ID });
    expect(received).toEqual([CONTRACT_ID, 'deposit', [USER, CONTRACT_POOL_ID, BigInt(10)], USER]);
  });

  it('maps a failed simulation to a readable 400', async () => {
    (stellarService as any).buildTypedContractTransaction = async () => ({
      simulation: {
        id: '1',
        latestLedger: 1,
        events: [],
        error: 'HostError: Error(WasmVm, InvalidAction) "Health factor too low"',
      },
      toXDR: () => 'never',
    });

    await expect(
      stellarService.prepareLendingCall({
        contractId: CONTRACT_ID,
        source: USER,
        functionName: 'borrow',
        args: [USER, CONTRACT_POOL_ID, BigInt(1), COLLATERAL_ASSET, BigInt(1)],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'The borrow would leave the position with too low a health factor',
    });
  });
});

describe('describeSimulationError', () => {
  it('explains contract panics and error codes', () => {
    expect(describeSimulationError('panicked: "insufficient pool liquidity"')).toBe(
      'The pool does not have enough liquidity for this withdrawal',
    );
    expect(describeSimulationError('HostError: Error(Contract, #5)')).toBe(
      'The protocol or this pool is paused',
    );
    expect(describeSimulationError('HostError: Error(Contract, #99)')).toBe(
      'The contract rejected the call (error 99)',
    );
    expect(describeSimulationError('something odd\nmore')).toBe('Simulation failed: something odd');
  });
});

describe('StellarService.createLendingPool', () => {
  it('signs create_pool with the close factor and requires the transaction to succeed', async () => {
    const service = new StellarService(undefined, NETWORK_PASSPHRASE);
    const admin = Keypair.random();
    let call: unknown[] = [];
    (service as any).callAndSubmitContract = async (...args: unknown[]) => {
      call = args;
      return TX_HASH;
    };
    let verifiedWith: unknown[] = [];
    (service as any).verifyContractCall = async (...args: unknown[]) => {
      verifiedWith = args;
      return {};
    };

    const result = await service.createLendingPool({
      contractId: CONTRACT_ID,
      adminPublicKey: admin.publicKey(),
      adminSecret: admin.secret(),
      poolId: CONTRACT_POOL_ID,
      name: 'USDC',
      asset: 'USDC',
      assetAddress: POOL_ASSET,
      collateralFactor: BigInt(1),
      liquidationThreshold: BigInt(2),
      liquidationPenalty: BigInt(3),
      closeFactor: BigInt(4),
      reserveFactor: 1000,
    });

    expect(result).toEqual({ txHash: TX_HASH });
    expect(call[1]).toBe('create_pool');
    expect(call[2]).toEqual([
      admin.publicKey(),
      CONTRACT_POOL_ID,
      'USDC',
      'USDC',
      POOL_ASSET,
      BigInt(1),
      BigInt(2),
      BigInt(3),
      BigInt(4),
      1000,
    ]);
    expect(verifiedWith).toEqual([TX_HASH, CONTRACT_ID, 'create_pool']);
  });
});

describe('lending chain value conversion', () => {
  it('parses token amounts and factors exactly', () => {
    expect(parseTokenAmount('12.5')).toBe(BigInt(125_000_000));
    expect(() => parseTokenAmount('1.12345678')).toThrow(/decimal places/);
    expect(parseContractFactor('0.75')).toBe((ONE * 3n) / 4n);
    expect(() => parseContractFactor('1.5')).toThrow(/between 0 and 1/);
  });

  it('formats health factor and utilization for their columns', () => {
    expect(formatHealthFactor((ONE * 3n) / 2n)).toBe('1.5000');
    expect(formatHealthFactor(ONE * 10n ** 9n)).toBe('999999.9999');
    expect(formatUtilizationRate(BigInt(400), BigInt(100))).toBe('25.00');
    expect(formatUtilizationRate(BigInt(0), BigInt(100))).toBe('0.00');
  });
});

// ---------------------------------------------------------------------------
// Part 2: controller and routes, repository stubbed
// ---------------------------------------------------------------------------

const POOL_ROW = {
  id: POOL_ID,
  contractPoolId: CONTRACT_POOL_ID,
  name: 'USDC Pool',
  asset: 'USDC',
  assetAddress: POOL_ASSET,
  totalDeposits: '0',
  totalBorrows: '0',
  availableLiquidity: '0',
  utilizationRate: '0',
  supplyAPY: '0',
  borrowAPY: '0',
  collateralFactor: '0.75',
  liquidationThreshold: '0.80',
  liquidationPenalty: '0.05',
  reserveFactor: 1000,
  isActive: true,
  isPaused: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

/** Methods of an object and its prototype chain, for spying on every call. */
function methodNames(target: object): string[] {
  const names = new Set<string>();
  for (let proto = target; proto && proto !== Object.prototype;) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && typeof (target as any)[name] === 'function') names.add(name);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return [...names];
}

describe('LendingController settles on-chain (repository stubbed)', () => {
  const env = {
    DEFI_RWA_CONTRACT_ID: process.env.DEFI_RWA_CONTRACT_ID,
    OPERATIONS_BACKEND_CREDENTIAL: process.env.OPERATIONS_BACKEND_CREDENTIAL,
    LIQUIDATOR_API_KEY: process.env.LIQUIDATOR_API_KEY,
    STELLAR_ADMIN_PUBLIC_KEY: process.env.STELLAR_ADMIN_PUBLIC_KEY,
    STELLAR_ADMIN_SECRET: process.env.STELLAR_ADMIN_SECRET,
  };
  const admin = Keypair.random();

  const repoOriginals = new Map<string, any>();
  const serviceOriginals = new Map<string, any>();
  const userOriginals = new Map<string, any>();
  const notificationOriginals = new Map<string, any>();
  let repoCalls: string[];
  let applied: Array<{ action: any; chain: LendingChainState }>;
  let recorded: Map<string, any>;
  let rpcResponseValue: unknown;
  let readStateCalls: unknown[][];
  let app: any;

  function stub(target: any, originals: Map<string, any>, name: string, fn: any) {
    if (!originals.has(name)) originals.set(name, target[name]);
    target[name] = fn;
  }

  beforeAll(() => {
    process.env.DEFI_RWA_CONTRACT_ID = CONTRACT_ID;
    process.env.OPERATIONS_BACKEND_CREDENTIAL = OPS_KEY;
    process.env.LIQUIDATOR_API_KEY = LIQUIDATOR_KEY;
    process.env.STELLAR_ADMIN_PUBLIC_KEY = admin.publicKey();
    process.env.STELLAR_ADMIN_SECRET = admin.secret();
    app = new Elysia().use(errorHandler).use(lendingRoutes);
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    repoCalls = [];
    applied = [];
    recorded = new Map();
    readStateCalls = [];
    rpcResponseValue = undefined;

    // Record every repository call; the read helpers answer from fixtures.
    for (const name of methodNames(lendingRepository)) {
      stub(lendingRepository, repoOriginals, name, async () => {
        repoCalls.push(name);
        throw new Error(`unexpected repository call: ${name}`);
      });
    }
    const repo = lendingRepository as any;
    repo.findById = async (id: string) => {
      repoCalls.push('findById');
      return id === POOL_ID ? POOL_ROW : undefined;
    };
    repo.findActivePool = async (id: string) => {
      repoCalls.push('findActivePool');
      return id === POOL_ID ? POOL_ROW : undefined;
    };
    repo.findRecordedAction = async (hash: string) => {
      repoCalls.push('findRecordedAction');
      return recorded.get(hash);
    };
    repo.getUserBorrows = async () => {
      repoCalls.push('getUserBorrows');
      return [{ collateralAmount: '200.0000000' }];
    };
    repo.applyConfirmedAction = async (action: any, readChainState: () => Promise<any>) => {
      repoCalls.push('applyConfirmedAction');
      const chain = await readChainState();
      applied.push({ action, chain });
      const result = {
        transactionHash: action.txHash,
        action: action.type,
        poolId: action.poolId,
        contractPoolId: action.contractPoolId,
        position:
          action.position === 'deposit'
            ? { amount: chain.deposit ? '100.0000000' : null }
            : { principal: chain.borrow ? '100.0000000' : null, collateralAmount: '150.0000000' },
        pool: { totalDeposits: '5000.0000000', totalBorrows: '1000.0000000' },
      };
      recorded.set(action.txHash, {
        hash: action.txHash,
        metadata: { ...action.metadata, result },
      });
      return { recorded: true, result };
    };

    stub(stellarService, serviceOriginals, 'sorobanRpcServer', {
      getTransaction: async () => rpcResponseValue,
    });
    stub(stellarService, serviceOriginals, 'readLendingState', async (...args: unknown[]) => {
      readStateCalls.push(args);
      return chainState();
    });
    stub(stellarService, serviceOriginals, 'prepareLendingCall', async (params: any) => ({
      xdr: `unsigned-${params.functionName}`,
      contractId: params.contractId,
    }));
    stub(userRepository, userOriginals, 'findById', async (id: string) =>
      id === USER_ID
        ? { id: USER_ID, walletAddress: USER }
        : id === BORROWER_ID
          ? { id: BORROWER_ID, walletAddress: BORROWER }
          : undefined,
    );
    stub(userRepository, userOriginals, 'getOrCreateByWallet', async (wallet: string) => ({
      id: '4d0e8400-e29b-41d4-a716-446655440000',
      walletAddress: wallet,
    }));
    stub(
      NotificationService.prototype,
      notificationOriginals,
      'notifyRepaymentProcessed',
      async () => undefined,
    );
    stub(
      NotificationService.prototype,
      notificationOriginals,
      'notifyLiquidationExecuted',
      async () => undefined,
    );
  });

  afterEach(() => {
    for (const [name, fn] of repoOriginals) (lendingRepository as any)[name] = fn;
    for (const [name, fn] of serviceOriginals) (stellarService as any)[name] = fn;
    for (const [name, fn] of userOriginals) (userRepository as any)[name] = fn;
    for (const [name, fn] of notificationOriginals)
      (NotificationService.prototype as any)[name] = fn;
    notificationOriginals.clear();
    repoOriginals.clear();
    serviceOriginals.clear();
    userOriginals.clear();
  });

  function userCtx(body: unknown, wallet = USER) {
    return {
      getAuthenticatedUser: async () => ({ id: USER_ID, walletAddress: wallet }),
      params: { id: POOL_ID },
      body,
    } as any;
  }

  function liquidationCtx(body: unknown) {
    return {
      params: { id: POOL_ID, borrowerId: BORROWER_ID },
      headers: { 'x-api-key': LIQUIDATOR_KEY },
      body,
    } as any;
  }

  const writeCalls = () =>
    repoCalls.filter(
      (name) =>
        !['findById', 'findActivePool', 'findRecordedAction', 'getUserBorrows'].includes(name),
    );

  describe('retired write routes', () => {
    for (const action of ['deposit', 'withdraw', 'borrow', 'repay']) {
      it(`POST /lending/pools/:id/${action} returns 410 and touches no repository method`, async () => {
        const token = jwt.sign(
          { id: USER_ID, walletAddress: USER },
          process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
        );
        const response = await app.handle(
          new Request(`http://localhost/lending/pools/${POOL_ID}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              amount: '100',
              borrowAmount: '100',
              collateralAmount: '200',
              collateralAsset: COLLATERAL_ASSET,
            }),
          }),
        );

        expect(response.status).toBe(410);
        expect(repoCalls).toEqual([]);
      });
    }
  });

  describe('POST /lending/pools', () => {
    const body = {
      name: 'USDC Pool',
      asset: 'USDC',
      assetAddress: POOL_ASSET,
      collateralFactor: '0.75',
      liquidationThreshold: '0.80',
      liquidationPenalty: '0.05',
      closeFactor: '0.5',
      contractPoolId: CONTRACT_POOL_ID,
    };

    function post(headers: Record<string, string>) {
      return app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body),
        }),
      );
    }

    it('rejects a normal authenticated user with 403 and never calls the contract', async () => {
      let chainCalled = false;
      stub(stellarService, serviceOriginals, 'createLendingPool', async () => {
        chainCalled = true;
        return { txHash: TX_HASH };
      });
      const token = jwt.sign(
        { id: USER_ID, walletAddress: USER },
        process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
      );

      const response = await post({ Authorization: `Bearer ${token}` });

      expect(response.status).toBe(403);
      expect(chainCalled).toBe(false);
      expect(repoCalls).toEqual([]);
    });

    it('creates the pool on-chain, then records it with its contract pool id', async () => {
      const order: string[] = [];
      let chainParams: any;
      stub(stellarService, serviceOriginals, 'createLendingPool', async (params: any) => {
        order.push('chain');
        chainParams = params;
        return { txHash: TX_HASH };
      });
      let created: any;
      (lendingRepository as any).findByContractPoolId = async () => undefined;
      (lendingRepository as any).create = async (row: any) => {
        order.push('db');
        created = row;
        return { ...POOL_ROW, ...row };
      };

      const response = await post({ 'x-internal-api-key': OPS_KEY });

      expect(response.status).toBe(201);
      expect(order).toEqual(['chain', 'db']);
      expect(chainParams).toMatchObject({
        contractId: CONTRACT_ID,
        adminPublicKey: admin.publicKey(),
        poolId: CONTRACT_POOL_ID,
        assetAddress: POOL_ASSET,
        collateralFactor: (ONE * 3n) / 4n,
        liquidationThreshold: (ONE * 4n) / 5n,
        liquidationPenalty: ONE / 20n,
        closeFactor: ONE / 2n,
        reserveFactor: 1000,
      });
      expect(created.contractPoolId).toBe(CONTRACT_POOL_ID);
      const json = await response.json();
      expect(json.contractPoolId).toBe(CONTRACT_POOL_ID);
      expect(json.txHash).toBe(TX_HASH);
    });

    it('does not insert the row when the on-chain call fails', async () => {
      stub(stellarService, serviceOriginals, 'createLendingPool', async () => {
        throw new Error('create_pool failed');
      });
      let inserted = false;
      (lendingRepository as any).findByContractPoolId = async () => undefined;
      (lendingRepository as any).create = async () => {
        inserted = true;
      };

      const response = await post({ 'x-internal-api-key': OPS_KEY });

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(inserted).toBe(false);
    });
  });

  describe('prepare', () => {
    it('builds the user call with the wallet and the contract pool id', async () => {
      let params: any;
      (stellarService as any).prepareLendingCall = async (p: any) => {
        params = p;
        return { xdr: 'unsigned', contractId: p.contractId };
      };

      const response = await LendingController.prepareAction(
        'borrow',
        userCtx({
          borrowAmount: '10',
          collateralAmount: '25.5',
          collateralAsset: COLLATERAL_ASSET,
        }),
      );

      expect(response.status).toBe(200);
      expect(params).toEqual({
        contractId: CONTRACT_ID,
        source: USER,
        functionName: 'borrow',
        args: [USER, CONTRACT_POOL_ID, BigInt(100_000_000), COLLATERAL_ASSET, BigInt(255_000_000)],
      });
      expect(writeCalls()).toEqual([]);
    });

    it('rejects a pool that has no on-chain counterpart', async () => {
      (lendingRepository as any).findActivePool = async () => ({
        ...POOL_ROW,
        contractPoolId: null,
      });

      await expect(
        LendingController.prepareAction('deposit', userCtx({ amount: '1' })),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  const actions: LendingUserAction[] = ['deposit', 'withdraw', 'borrow', 'repay'];

  for (const action of actions) {
    describe(`confirm ${action}`, () => {
      const confirm = (wallet = USER) =>
        LendingController.confirmAction(action, userCtx({ txHash: TX_HASH }, wallet));

      const rejected: Array<[string, () => unknown, number, string]> = [
        [
          'a failed transaction',
          () => rpcResponse(buildEnvelope({ functionName: action }), 'FAILED'),
          422,
          'did not succeed',
        ],
        [
          'a different contract',
          () => rpcResponse(buildEnvelope({ functionName: action, contractId: OTHER_CONTRACT_ID })),
          422,
          'invokes contract',
        ],
        [
          'a different function',
          () =>
            rpcResponse(
              buildEnvelope({
                functionName: action,
                callFunctionName: action === 'deposit' ? 'withdraw' : 'deposit',
              }),
            ),
          422,
          `expected ${action}`,
        ],
        [
          'a different actor',
          () => rpcResponse(buildEnvelope({ functionName: action, source: OTHER_USER })),
          403,
          'not signed by the authenticated wallet',
        ],
        [
          'a different pool',
          () => rpcResponse(buildEnvelope({ functionName: action, poolId: 'another-pool' })),
          422,
          'different pool',
        ],
      ];

      for (const [label, response, status, message] of rejected) {
        it(`rejects ${label} without writing anything`, async () => {
          rpcResponseValue = response();

          await expect(confirm()).rejects.toMatchObject({
            statusCode: status,
            message: expect.stringContaining(message),
          });
          expect(writeCalls()).toEqual([]);
          expect(readStateCalls).toEqual([]);
        });
      }

      it('rejects a transaction whose actor argument is someone else, even if signed by the user', async () => {
        rpcResponseValue = rpcResponse(
          buildEnvelope({ functionName: action, source: USER, actor: OTHER_USER }),
        );

        await expect(confirm()).rejects.toMatchObject({ statusCode: 403 });
        expect(writeCalls()).toEqual([]);
      });

      it('writes the values read back from the contract', async () => {
        rpcResponseValue = rpcResponse(
          buildEnvelope({ functionName: action, amount: BigInt(1_000_000_000) }),
        );

        const response = await confirm();

        expect(response.status).toBe(200);
        expect(applied).toHaveLength(1);
        const position = action === 'deposit' || action === 'withdraw' ? 'deposit' : 'borrow';
        expect(applied[0]!.action).toMatchObject({
          txHash: TX_HASH,
          type: action,
          poolId: POOL_ID,
          contractPoolId: CONTRACT_POOL_ID,
          position,
          positionUserId: USER_ID,
          fromUserId: USER_ID,
          amount: '100.0000000',
          asset: POOL_ASSET,
        });
        expect(readStateCalls).toEqual([[CONTRACT_ID, CONTRACT_POOL_ID, USER, position]]);
        expect(applied[0]!.chain).toEqual(chainState());
        const json = (await response.json()) as { transactionHash: string };
        expect(json.transactionHash).toBe(TX_HASH);
      });

      it('confirming the same hash twice writes once and returns the same result', async () => {
        rpcResponseValue = rpcResponse(buildEnvelope({ functionName: action }));

        const first = await (await confirm()).json();
        const second = await (await confirm()).json();

        expect(second).toEqual(first);
        expect(repoCalls.filter((name) => name === 'applyConfirmedAction')).toHaveLength(1);
      });

      it('refuses to replay a recorded hash for another wallet', async () => {
        rpcResponseValue = rpcResponse(buildEnvelope({ functionName: action }));
        await confirm();

        await expect(confirm(OTHER_USER)).rejects.toMatchObject({ statusCode: 409 });
        expect(repoCalls.filter((name) => name === 'applyConfirmedAction')).toHaveLength(1);
      });
    });
  }

  describe('liquidation', () => {
    it('prepares liquidate(liquidator, contract_pool_id, borrower_address, debt_to_cover)', async () => {
      let params: any;
      (stellarService as any).prepareLendingCall = async (p: any) => {
        params = p;
        return { xdr: 'unsigned-liquidate', contractId: p.contractId };
      };

      const response = await LendingController.prepareLiquidation(
        liquidationCtx({ liquidator: LIQUIDATOR, debtToCover: '25' }),
      );

      expect(response.status).toBe(200);
      expect(params).toEqual({
        contractId: CONTRACT_ID,
        source: LIQUIDATOR,
        functionName: 'liquidate',
        args: [LIQUIDATOR, CONTRACT_POOL_ID, BORROWER, BigInt(250_000_000)],
      });
      const json = (await response.json()) as { borrowerAddress: string };
      expect(json.borrowerAddress).toBe(BORROWER);
      expect(writeCalls()).toEqual([]);
    });

    it('rejects a liquidator without the liquidator key', async () => {
      await expect(
        LendingController.prepareLiquidation({
          ...liquidationCtx({ liquidator: LIQUIDATOR, debtToCover: '25' }),
          headers: {},
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('a failed on-chain liquidation leaves the position untouched', async () => {
      rpcResponseValue = rpcResponse(
        buildEnvelope({ functionName: 'liquidate', actor: LIQUIDATOR }),
        'FAILED',
      );

      await expect(
        LendingController.confirmLiquidation(
          liquidationCtx({ liquidator: LIQUIDATOR, txHash: TX_HASH }),
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(writeCalls()).toEqual([]);
      expect(readStateCalls).toEqual([]);
    });

    it('rejects a liquidation of a different borrower', async () => {
      rpcResponseValue = rpcResponse(
        buildEnvelope({ functionName: 'liquidate', actor: LIQUIDATOR, borrower: OTHER_USER }),
      );

      await expect(
        LendingController.confirmLiquidation(
          liquidationCtx({ liquidator: LIQUIDATOR, txHash: TX_HASH }),
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(writeCalls()).toEqual([]);
    });

    it('refreshes the borrower position from the contract after a verified liquidation', async () => {
      rpcResponseValue = rpcResponse(
        buildEnvelope({ functionName: 'liquidate', actor: LIQUIDATOR, amount: BigInt(50) }),
      );
      (stellarService as any).readLendingState = async (...args: unknown[]) => {
        readStateCalls.push(args);
        return chainState({ borrow: null });
      };

      const response = await LendingController.confirmLiquidation(
        liquidationCtx({ liquidator: LIQUIDATOR, txHash: TX_HASH }),
      );

      expect(response.status).toBe(200);
      expect(readStateCalls).toEqual([[CONTRACT_ID, CONTRACT_POOL_ID, BORROWER, 'borrow']]);
      expect(applied[0]!.action).toMatchObject({
        type: 'liquidation',
        position: 'borrow',
        positionUserId: BORROWER_ID,
        toUserId: BORROWER_ID,
      });
      expect(applied[0]!.chain.borrow).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Part 3: LendingRepository.applyConfirmedAction against a real database
// ---------------------------------------------------------------------------

const skipIfNoDatabase = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDatabase)('LendingRepository.applyConfirmedAction (DB required)', () => {
  let db: any;
  let schema: any;
  let poolId: string;
  let userId: string;
  const wallet = Keypair.random().publicKey();
  const contractPoolId = `chain-test-${Date.now()}`;
  const hashes = ['1', '2', '3', '4', '5'].map((c) => c.repeat(64));

  beforeAll(async () => {
    if (skipIfNoDatabase) return;
    db = (await import('../db')).db;
    schema = await import('../db/schema');
    const user = await userRepository.getOrCreateByWallet(wallet);
    userId = user.id;
    const pool = await lendingRepository.create({
      contractPoolId,
      name: 'Chain Test Pool',
      asset: 'USDC',
      assetAddress: POOL_ASSET,
      collateralFactor: '0.75',
      liquidationThreshold: '0.80',
      liquidationPenalty: '0.05',
      reserveFactor: 1000,
    });
    poolId = pool.id;
  });

  afterAll(async () => {
    if (skipIfNoDatabase) return;
    await db.delete(schema.transactions).where(eq(schema.transactions.fromUserId, userId));
    await db.delete(schema.depositPositions).where(eq(schema.depositPositions.poolId, poolId));
    await db.delete(schema.borrowPositions).where(eq(schema.borrowPositions.poolId, poolId));
    await db.delete(schema.lendingPools).where(eq(schema.lendingPools.id, poolId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  function action(txHash: string, type: any, position: 'deposit' | 'borrow') {
    return {
      txHash,
      type,
      poolId,
      contractPoolId,
      position,
      positionUserId: userId,
      fromUserId: userId,
      amount: '100.0000000',
      asset: POOL_ASSET,
      metadata: { action: type, poolId, contractPoolId, actor: wallet },
    };
  }

  it('stores the deposit and pool totals the contract returned', async () => {
    const applied = await lendingRepository.applyConfirmedAction(
      action(hashes[0]!, 'deposit', 'deposit'),
      async () => chainState(),
    );

    expect(applied.recorded).toBe(true);
    const pool = await lendingRepository.findById(poolId);
    expect(pool!.totalDeposits).toBe('5000.0000000');
    expect(pool!.totalBorrows).toBe('1000.0000000');
    expect(pool!.availableLiquidity).toBe('4000.0000000');
    expect(pool!.utilizationRate).toBe('20.00');
    const deposits = await lendingRepository.getUserDeposits(poolId, userId);
    expect(deposits).toHaveLength(1);
    expect(deposits[0]!.amount).toBe('100.0000000');
  });

  it('a second confirmed borrow updates the same row', async () => {
    await lendingRepository.applyConfirmedAction(action(hashes[1]!, 'borrow', 'borrow'), async () =>
      chainState(),
    );
    await lendingRepository.applyConfirmedAction(action(hashes[2]!, 'borrow', 'borrow'), async () =>
      chainState({
        borrow: { ...chainState().borrow!, principal: BigInt(3_000_000_000) },
      }),
    );

    const rows = await db
      .select()
      .from(schema.borrowPositions)
      .where(
        and(
          eq(schema.borrowPositions.poolId, poolId),
          eq(schema.borrowPositions.borrowerId, userId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].principal).toBe('300.0000000');
    expect(rows[0].healthFactor).toBe('1.5000');
  });

  it('confirming the same hash twice writes once', async () => {
    let reads = 0;
    const read = async () => {
      reads += 1;
      return chainState({ borrow: { ...chainState().borrow!, principal: BigInt(9) } });
    };

    const second = await lendingRepository.applyConfirmedAction(
      action(hashes[2]!, 'borrow', 'borrow'),
      read,
    );

    expect(second.recorded).toBe(false);
    expect(reads).toBe(0);
    const recorded = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.hash, hashes[2]!));
    expect(recorded).toHaveLength(1);
    const [row] = await lendingRepository.getUserBorrows(poolId, userId);
    expect(row!.principal).toBe('300.0000000');
  });

  it('a failed chain read leaves the position and the transactions table untouched', async () => {
    await expect(
      lendingRepository.applyConfirmedAction(
        action(hashes[3]!, 'liquidation', 'borrow'),
        async () => {
          throw new Error('rpc down');
        },
      ),
    ).rejects.toThrow('rpc down');

    const [row] = await lendingRepository.getUserBorrows(poolId, userId);
    expect(row!.principal).toBe('300.0000000');
    expect(await lendingRepository.findRecordedAction(hashes[3]!)).toBeUndefined();
  });

  it('removes the borrow row once the contract holds no position', async () => {
    await lendingRepository.applyConfirmedAction(action(hashes[4]!, 'repay', 'borrow'), async () =>
      chainState({ borrow: null }),
    );

    expect(await lendingRepository.getUserBorrows(poolId, userId)).toHaveLength(0);
  });
});
