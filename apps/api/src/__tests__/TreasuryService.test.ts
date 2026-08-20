/**
 * Unit tests for the treasury track's pure logic: amount scaling, slippage,
 * share math, contract-error mapping, and position assembly.
 *
 * These do not talk to a network. The contract call paths themselves are
 * covered against the real deployed vaults in
 * `src/tests/treasury.integration.test.ts`; what is faked here is only the
 * seam between the service and the vault client, so the arithmetic and the
 * failure handling can be driven through every branch deterministically.
 */
import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import {
  applySlippageFloor,
  fromSmallestUnit,
  mapVaultErrorToApiError,
  toSmallestUnit,
  TreasuryService,
  type VaultClient,
} from '../services/TreasuryService';
import { DefindexVaultError, toDefindexVaultError } from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
import type { TreasuryVenue } from '../config/treasury';
import { TreasuryRepository } from '../repositories/TreasuryRepository';
import type { AuditService } from '../services/AuditService';
import type { CacheService } from '../services/CacheService';

const TESTNET_USDC_ASSET = 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU';
const TESTNET_USDC_VAULT = 'CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN';
const TREASURY_ACCOUNT = 'GCNBMXP33TL2QPYMRTHVZOWNINZOGFJQEOPWVCYU3XDGOCH3TICREXLM';
const STRATEGY = 'CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY';

interface FakeVaultOptions {
  shares?: bigint;
  totalSupply?: bigint;
  totalAmount?: bigint;
  idleAmount?: bigint;
  investedAmount?: bigint;
  paused?: boolean;
  assetAddress?: string;
  onDeposit?: (args: unknown) => Promise<unknown>;
  onWithdraw?: (args: unknown) => Promise<unknown>;
}

function fakeVaultClient(options: FakeVaultOptions = {}): VaultClient {
  const {
    shares = 0n,
    totalSupply = 1_000_0000000n,
    totalAmount = 1_000_0000000n,
    idleAmount = 0n,
    investedAmount = totalAmount,
    paused = false,
    assetAddress = TESTNET_USDC_ASSET,
  } = options;

  return {
    balance: async () => shares,
    totalSupply: async () => totalSupply,
    fetchTotalManagedFunds: async () => [
      {
        asset: assetAddress,
        total_amount: totalAmount,
        idle_amount: idleAmount,
        invested_amount: investedAmount,
        strategy_allocations: [{ strategy_address: STRATEGY, amount: investedAmount, paused }],
      },
    ],
    // Share price of exactly 1.0 keeps the arithmetic under test readable.
    getAssetAmountsPerShares: async (vaultShares: bigint) => [vaultShares],
    getFees: async () => [100, 2000] as [number, number],
    deposit:
      options.onDeposit ??
      (async () => {
        throw new Error('deposit not stubbed for this test');
      }),
    withdraw:
      options.onWithdraw ??
      (async () => {
        throw new Error('withdraw not stubbed for this test');
      }),
  } as unknown as VaultClient;
}

function noopAudit(): AuditService {
  return { logAction: mock(() => Promise.resolve()) } as unknown as AuditService;
}

describe('toSmallestUnit', () => {
  it('scales whole and fractional amounts without floating-point drift', () => {
    expect(toSmallestUnit(10, 7)).toBe(100_000_000n);
    expect(toSmallestUnit(0.1, 7)).toBe(1_000_000n);
    expect(toSmallestUnit('0.0000001', 7)).toBe(1n);
    expect(toSmallestUnit('1234.5678901', 7)).toBe(12_345_678_901n);
    // `(0.0000005).toString()` is "5e-7"; exponential form must still scale.
    expect(toSmallestUnit(0.0000005, 7)).toBe(5n);
  });

  it('rejects more precision than the asset can hold rather than truncating', () => {
    expect(() => toSmallestUnit('0.12345678', 7)).toThrow(ApiError);
  });

  it('rejects zero, negative and non-numeric amounts', () => {
    expect(() => toSmallestUnit(0, 7)).toThrow(ApiError);
    expect(() => toSmallestUnit(-5, 7)).toThrow(ApiError);
    expect(() => toSmallestUnit('abc', 7)).toThrow(ApiError);
  });
});

describe('fromSmallestUnit', () => {
  it('round-trips with toSmallestUnit', () => {
    expect(fromSmallestUnit(toSmallestUnit('25.5', 7), 7)).toBe('25.5000000');
    expect(fromSmallestUnit(0n, 7)).toBe('0.0000000');
    expect(fromSmallestUnit(1n, 7)).toBe('0.0000001');
  });
});

describe('applySlippageFloor', () => {
  it('reduces the amount by the given basis points, rounding down', () => {
    expect(applySlippageFloor(100_000_000n, 50)).toBe(99_500_000n);
    expect(applySlippageFloor(100_000_000n, 0)).toBe(100_000_000n);
    expect(applySlippageFloor(3n, 50)).toBe(2n);
  });
});

describe('mapVaultErrorToApiError', () => {
  const cases: Array<[string, number, number, string]> = [
    ['StrategyPaused', 144, 503, 'TREASURY_VENUE_PAUSED'],
    ['StrategyPausedOrNotFound', 141, 503, 'TREASURY_VENUE_PAUSED'],
    ['InsufficientManagedFunds', 114, 409, 'TREASURY_INSUFFICIENT_VENUE_LIQUIDITY'],
    ['UnwindMoreThanAvailable', 128, 409, 'TREASURY_INSUFFICIENT_VENUE_LIQUIDITY'],
    ['BalanceError', 10, 409, 'TREASURY_INSUFFICIENT_BALANCE'],
    ['TrustlineMissingError', 13, 409, 'TREASURY_TRUSTLINE_MISSING'],
    ['BalanceDeauthorizedError', 11, 409, 'TREASURY_ASSET_NOT_AUTHORIZED'],
    ['AmountBelowMinDust', 451, 422, 'TREASURY_AMOUNT_REJECTED'],
    ['UnderlyingAmountBelowMin', 452, 409, 'TREASURY_SLIPPAGE_EXCEEDED'],
    ['DeadlineExpired', 421, 409, 'TREASURY_DEADLINE_EXPIRED'],
    ['Unauthorized', 130, 403, 'TREASURY_UNAUTHORIZED'],
    ['ExternalError', 422, 502, 'TREASURY_VENUE_REJECTED'],
  ];

  for (const [errorName, code, expectedStatus, expectedCode] of cases) {
    it(`maps ${errorName} (#${code}) to ${expectedStatus} ${expectedCode}`, () => {
      const apiError = mapVaultErrorToApiError(
        new DefindexVaultError(errorName, code, 'vault', 'boom'),
      );

      expect(apiError.statusCode).toBe(expectedStatus);
      expect(apiError.code).toBe(expectedCode);
      expect(apiError.details).toMatchObject({ venueError: errorName, contractErrorCode: code });
    });
  }

  it('falls through to 502 for an unmodelled venue failure', () => {
    const apiError = mapVaultErrorToApiError(
      new DefindexVaultError('Unknown', 9999, 'unknown', 'something new broke'),
    );

    expect(apiError.statusCode).toBe(502);
    expect(apiError.code).toBe('TREASURY_VENUE_ERROR');
  });
});

describe('toDefindexVaultError', () => {
  it('decodes a host trap into the vault error name', () => {
    const decoded = toDefindexVaultError(
      new Error('transaction simulation failed: HostError: Error(Contract, #144)'),
    );

    expect(decoded.errorName).toBe('StrategyPaused');
    expect(decoded.errorCode).toBe(144);
    expect(decoded.source).toBe('vault');
  });

  it('decodes a Stellar Asset Contract trap surfaced through the vault', () => {
    const decoded = toDefindexVaultError(
      new Error('transaction simulation failed: HostError: Error(Contract, #13)'),
    );

    expect(decoded.errorName).toBe('TrustlineMissingError');
    expect(decoded.source).toBe('token');
  });

  it('decodes a strategy error code', () => {
    const decoded = toDefindexVaultError(new Error('Error(Contract, #455)'));

    expect(decoded.errorName).toBe('SupplyNotFound');
    expect(decoded.source).toBe('strategy');
  });

  it('keeps the original message when no contract code is present', () => {
    const decoded = toDefindexVaultError(new Error('connection refused'));

    expect(decoded.errorName).toBe('Unknown');
    expect(decoded.errorCode).toBeUndefined();
    expect(decoded.message).toBe('connection refused');
  });
});

describe('TreasuryService.getPosition', () => {
  const originalEnv = { ...process.env };
  const recordSnapshot = TreasuryRepository.recordSnapshot;

  beforeEach(() => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.TREASURY_SOURCE_PUBLIC_KEY = TREASURY_ACCOUNT;
    // The snapshot write is best-effort; stub it so these tests need no DB.
    TreasuryRepository.recordSnapshot = mock(() =>
      Promise.resolve({} as Awaited<ReturnType<typeof recordSnapshot>>),
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    TreasuryRepository.recordSnapshot = recordSnapshot;
  });

  it('reports shares, position value and vault totals as decimal strings', async () => {
    const service = new TreasuryService(
      () =>
        fakeVaultClient({
          shares: 25_0000000n,
          totalAmount: 100_0000000n,
          idleAmount: 10_0000000n,
          investedAmount: 90_0000000n,
        }),
      noopAudit(),
    );

    const position = await service.getPosition('defindex-blend');

    expect(position.venue).toBe('defindex-blend');
    expect(position.assetCode).toBe('USDC');
    expect(position.shares).toBe('25.0000000');
    expect(position.positionValue).toBe('25.0000000');
    expect(position.vaultTotalManaged).toBe('100.0000000');
    expect(position.vaultIdleAmount).toBe('10.0000000');
    expect(position.vaultInvestedAmount).toBe('90.0000000');
    expect(position.fees).toEqual({ vaultBps: 100, protocolBps: 2000 });
    expect(position.paused).toBe(false);
  });

  it('links the vault, the asset and the treasury account on stellar.expert', async () => {
    const service = new TreasuryService(() => fakeVaultClient(), noopAudit());
    const position = await service.getPosition('defindex-blend');

    expect(position.explorer.vault).toBe(
      `https://stellar.expert/explorer/testnet/contract/${TESTNET_USDC_VAULT}`,
    );
    expect(position.explorer.asset).toBe(
      `https://stellar.expert/explorer/testnet/contract/${TESTNET_USDC_ASSET}`,
    );
    expect(position.explorer.account).toBe(
      `https://stellar.expert/explorer/testnet/account/${TREASURY_ACCOUNT}`,
    );
  });

  it('flags the venue as paused when every strategy is paused', async () => {
    const service = new TreasuryService(
      () =>
        fakeVaultClient({
          paused: true,
          assetAddress: 'CC72F57YTPX76HAA64JQOEGHQAPSADQWSY5DWVBR66JINPFDLNCQYHIC',
        }),
      noopAudit(),
    );

    const position = await service.getPosition('etherfuse-stablebond');
    expect(position.paused).toBe(true);
    expect(position.strategies[0]!.paused).toBe(true);
  });

  it('captures at most one snapshot per venue within the throttle window', async () => {
    const service = new TreasuryService(() => fakeVaultClient(), noopAudit());

    await service.getPosition('defindex-blend');
    await service.getPosition('defindex-blend');

    // Reads are public and unauthenticated, so repeated page loads must not
    // turn into a row per request.
    expect(TreasuryRepository.recordSnapshot).toHaveBeenCalledTimes(1);
  });

  it('serves a cached position without hitting the chain again', async () => {
    const store = new Map<string, unknown>();
    const cache = {
      get: async (key: string) => (store.get(key) ?? null) as never,
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    } as unknown as CacheService;

    let vaultReads = 0;
    const service = new TreasuryService(
      () => {
        vaultReads += 1;
        return fakeVaultClient();
      },
      noopAudit(),
      cache,
    );

    const first = await service.getPosition('defindex-blend');
    const second = await service.getPosition('defindex-blend');

    expect(vaultReads).toBe(1);
    expect(second).toEqual(first);
  });

  it('fails loudly when the vault does not manage the configured asset', async () => {
    const service = new TreasuryService(
      () => fakeVaultClient({ assetAddress: 'CDIFFERENTASSETADDRESS' }),
      noopAudit(),
    );

    await expect(service.getPosition('defindex-blend')).rejects.toMatchObject({
      statusCode: 502,
      code: 'TREASURY_VENUE_ASSET_MISMATCH',
    });
  });

  it('reports the venue as unconfigured rather than guessing on mainnet', async () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    const service = new TreasuryService(() => fakeVaultClient(), noopAudit());

    await expect(service.getPosition('defindex-blend')).rejects.toMatchObject({
      statusCode: 503,
      code: 'TREASURY_VENUE_NOT_CONFIGURED',
    });
  });
});

describe('TreasuryService.getPortfolio', () => {
  const originalEnv = { ...process.env };
  const recordSnapshot = TreasuryRepository.recordSnapshot;

  beforeEach(() => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.TREASURY_SOURCE_PUBLIC_KEY = TREASURY_ACCOUNT;
    TreasuryRepository.recordSnapshot = mock(() =>
      Promise.resolve({} as Awaited<ReturnType<typeof recordSnapshot>>),
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    TreasuryRepository.recordSnapshot = recordSnapshot;
  });

  it('surfaces a venue that could not be read instead of dropping it', async () => {
    const service = new TreasuryService((venue) => {
      if (venue.id === 'etherfuse-stablebond') {
        return {
          balance: async () => {
            throw new Error('Error(Contract, #100)');
          },
          totalSupply: async () => 0n,
          fetchTotalManagedFunds: async () => [],
          getAssetAmountsPerShares: async () => [],
          getFees: async () => [0, 0] as [number, number],
        } as unknown as VaultClient;
      }
      return fakeVaultClient();
    }, noopAudit());

    const portfolio = await service.getPortfolio();

    expect(portfolio.positions.map((p) => p.venue)).toEqual(['defindex-blend']);
    expect(portfolio.unavailable.map((entry) => entry.venue)).toEqual(['etherfuse-stablebond']);
    expect(portfolio.sourceAccount).toBe(TREASURY_ACCOUNT);
  });
});

describe('TreasuryService movements', () => {
  const originalEnv = { ...process.env };
  const recordTransaction = TreasuryRepository.recordTransaction;
  const recordSnapshot = TreasuryRepository.recordSnapshot;

  beforeEach(() => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.TREASURY_SOURCE_PUBLIC_KEY = TREASURY_ACCOUNT;
    process.env.TREASURY_SOURCE_SECRET = 'SDNBSVFTCEXAXHFTBFHQKLVLGT6IPHDHNPUSXSPGZKBFN2C4RIPCEKAP';
    TreasuryRepository.recordTransaction = mock((entry) =>
      Promise.resolve({
        id: '11111111-1111-4111-8111-111111111111',
        ...entry,
      } as Awaited<ReturnType<typeof recordTransaction>>),
    );
    TreasuryRepository.recordSnapshot = mock(() =>
      Promise.resolve({} as Awaited<ReturnType<typeof recordSnapshot>>),
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    TreasuryRepository.recordTransaction = recordTransaction;
    TreasuryRepository.recordSnapshot = recordSnapshot;
  });

  it('deposits with a slippage floor derived from the requested amount', async () => {
    let capturedArgs:
      { amountsDesired: bigint[]; amountsMin: bigint[]; invest: boolean } | undefined;

    const service = new TreasuryService(
      () =>
        fakeVaultClient({
          onDeposit: async (args: unknown) => {
            capturedArgs = args as NonNullable<typeof capturedArgs>;
            return {
              signAndSend: async () => ({ sendTransactionResponse: { hash: 'abc123' } }),
            };
          },
        }),
      noopAudit(),
    );

    const result = await service.deposit({
      venue: 'defindex-blend',
      amount: 10,
      requestedBy: 'ops@akkuea',
    });

    expect(capturedArgs).toMatchObject({
      amountsDesired: [100_000_000n],
      amountsMin: [99_500_000n],
      invest: true,
    });
    expect(result.txHash).toBe('abc123');
    expect(result.amount).toBe('10.0000000');
    expect(result.explorerUrl).toBe('https://stellar.expert/explorer/testnet/tx/abc123');
  });

  it('records a failed deposit with the contract error before rethrowing', async () => {
    const service = new TreasuryService(
      () =>
        fakeVaultClient({
          onDeposit: async () => {
            throw new Error('HostError: Error(Contract, #144)');
          },
        }),
      noopAudit(),
    );

    await expect(
      service.deposit({ venue: 'defindex-blend', amount: 10, requestedBy: 'ops@akkuea' }),
    ).rejects.toMatchObject({ statusCode: 503, code: 'TREASURY_VENUE_PAUSED' });

    const calls = (TreasuryRepository.recordTransaction as ReturnType<typeof mock>).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toMatchObject({
      status: 'failed',
      operation: 'deposit',
      errorName: 'StrategyPaused',
      errorCode: '144',
    });
  });

  it('converts a withdrawal amount into shares using the live share price', async () => {
    let capturedShares: bigint | undefined;

    const service = new TreasuryService(
      () =>
        fakeVaultClient({
          // 200 shares back 400 units of the asset: share price 2.0.
          totalSupply: 200_0000000n,
          totalAmount: 400_0000000n,
          investedAmount: 400_0000000n,
          onWithdraw: async (args: unknown) => {
            capturedShares = (args as { withdrawShares: bigint }).withdrawShares;
            return {
              signAndSend: async () => ({ getTransactionResponse: { txHash: 'def456' } }),
            };
          },
        }),
      noopAudit(),
    );

    const result = await service.withdraw({
      venue: 'defindex-blend',
      amount: 100,
      requestedBy: 'ops@akkuea',
    });

    // 100 USDC at a share price of 2.0 is 50 shares.
    expect(capturedShares).toBe(50_0000000n);
    expect(result.txHash).toBe('def456');
  });

  it('rounds shares up so a withdrawal is never short of the requested amount', async () => {
    let capturedShares: bigint | undefined;

    const service = new TreasuryService(
      () =>
        fakeVaultClient({
          totalSupply: 3n,
          totalAmount: 7n,
          investedAmount: 7n,
          onWithdraw: async (args: unknown) => {
            capturedShares = (args as { withdrawShares: bigint }).withdrawShares;
            return { signAndSend: async () => ({ sendTransactionResponse: { hash: 'h' } }) };
          },
        }),
      noopAudit(),
    );

    await service.withdraw({
      venue: 'defindex-blend',
      amount: 0.0000005,
      requestedBy: 'ops@akkuea',
    });

    // 3 * 5 / 7 = 2.14…, which must round up to 3 rather than down to 2.
    expect(capturedShares).toBe(3n);
  });

  it('refuses a withdrawal larger than the venue holds', async () => {
    const service = new TreasuryService(
      () => fakeVaultClient({ totalSupply: 10_0000000n, totalAmount: 10_0000000n }),
      noopAudit(),
    );

    await expect(
      service.withdraw({ venue: 'defindex-blend', amount: 500, requestedBy: 'ops@akkuea' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'TREASURY_INSUFFICIENT_VENUE_LIQUIDITY',
    });
  });

  it('rejects an out-of-range slippage tolerance before touching the chain', async () => {
    const service = new TreasuryService(() => fakeVaultClient(), noopAudit());

    await expect(
      service.deposit({
        venue: 'defindex-blend',
        amount: 10,
        slippageBps: 5000,
        requestedBy: 'ops@akkuea',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses to move funds when no treasury signing key is configured', async () => {
    delete process.env.TREASURY_SOURCE_SECRET;
    delete process.env.STELLAR_ADMIN_SECRET;
    const service = new TreasuryService(() => fakeVaultClient(), noopAudit());

    await expect(
      service.deposit({ venue: 'defindex-blend', amount: 10, requestedBy: 'ops@akkuea' }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'TREASURY_SOURCE_NOT_CONFIGURED',
    });
  });
});

describe('treasury venue registry', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('lists both venues with configuration status for the active network', async () => {
    process.env.STELLAR_NETWORK = 'testnet';
    const service = new TreasuryService(() => fakeVaultClient(), noopAudit());

    expect(service.listVenues()).toEqual([
      {
        venue: 'defindex-blend',
        configured: true,
        label: 'DeFindex Blend strategy',
        provider: 'DeFindex',
        strategy: 'Lends the deposited USDC into Blend',
      },
      {
        venue: 'etherfuse-stablebond',
        configured: true,
        label: 'Etherfuse Stablebonds',
        provider: 'DeFindex / Etherfuse',
        strategy: 'Holds CETES, Etherfuse tokenized Mexican sovereign debt, and lends it on Blend',
      },
    ]);
  });

  it('honours an environment override for a vault address', async () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    process.env.TREASURY_DEFINDEX_BLEND_VAULT_ID = 'CMAINNETVAULT';
    process.env.TREASURY_DEFINDEX_BLEND_ASSET_ID = 'CMAINNETASSET';

    const { getTreasuryVenue } = await import('../config/treasury');
    const venue = getTreasuryVenue('defindex-blend') as TreasuryVenue;

    expect(venue.vaultContractId).toBe('CMAINNETVAULT');
    expect(venue.assetContractId).toBe('CMAINNETASSET');
  });
});
