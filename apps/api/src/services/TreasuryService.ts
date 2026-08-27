import { Networks } from '@stellar/stellar-sdk';
import {
  createNodeContractSigner,
  DefindexVaultContractClient,
  DefindexVaultError,
  toDefindexVaultError,
  type CurrentAssetInvestmentAllocation,
} from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
import {
  getConfiguredTreasuryVenues,
  getStellarExpertBaseUrl,
  getTreasurySourceAccount,
  getTreasurySourcePublicKey,
  getTreasuryVenue,
  TREASURY_VENUE_IDS,
  type TreasuryVenue,
  type TreasuryVenueId,
} from '../config/treasury';
import { TreasuryRepository } from '../repositories/TreasuryRepository';
import { auditService, type AuditService } from './AuditService';
import { cacheService, type CacheService } from './CacheService';
import { logger } from './logger';

/** Default slippage floor applied to deposits and withdrawals: 0.5%. */
const DEFAULT_SLIPPAGE_BPS = 50;
/**
 * How long a position read is served from cache. The position endpoints are
 * public and unauthenticated, so without this every request would be an
 * uncached round trip to Soroban RPC.
 */
const POSITION_CACHE_TTL_SECONDS = 30;
/**
 * Minimum gap between stored snapshots for a venue. Snapshots are captured on
 * read, so this keeps a busy page from writing a row per request while still
 * building usable history.
 */
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SLIPPAGE_BPS = 1_000;
const BPS_DENOMINATOR = 10_000n;

export interface TreasuryStrategyView {
  address: string;
  /** Amount of the underlying asset this strategy currently holds. */
  amount: string;
  /**
   * A paused strategy still holds funds but accepts no new investment, and the
   * vault will not route deposits into it.
   */
  paused: boolean;
}

export interface TreasuryPosition {
  venue: TreasuryVenueId;
  label: string;
  provider: string;
  strategy: string;
  assetCode: string;
  vaultContractId: string;
  assetContractId: string;
  /** dfToken shares the platform treasury holds in this vault. */
  shares: string;
  /** What those shares are worth right now, in the underlying asset. */
  positionValue: string;
  /** Underlying asset under management in the vault across all holders. */
  vaultTotalManaged: string;
  /** Portion of the vault sitting as idle funds rather than in a strategy. */
  vaultIdleAmount: string;
  /** Portion of the vault deployed into strategies. */
  vaultInvestedAmount: string;
  strategies: TreasuryStrategyView[];
  /** True when every strategy backing this venue is paused. */
  paused: boolean;
  /** Vault performance fee and DeFindex protocol fee, in basis points. */
  fees: { vaultBps: number; protocolBps: number };
  explorer: {
    vault: string;
    asset: string;
    /** Account whose position this is; null when no treasury key is configured. */
    account: string | null;
  };
  readAt: string;
}

export interface TreasuryVenueStatus {
  venue: TreasuryVenueId;
  configured: boolean;
  label: string;
  provider: string;
  strategy: string;
}

export interface TreasuryPortfolio {
  positions: TreasuryPosition[];
  /** Venues that exist in the registry but have no address for this network. */
  unconfigured: TreasuryVenueStatus[];
  /** Read failures, so a broken venue is visible rather than silently missing. */
  unavailable: Array<{ venue: TreasuryVenueId; reason: string }>;
  sourceAccount: string | null;
  network: string;
}

export interface TreasuryMovementRequest {
  venue: TreasuryVenueId;
  /** Underlying asset amount in whole units, e.g. `25.5` USDC. */
  amount: number;
  /** Slippage tolerance in basis points. Defaults to 50 (0.5%). */
  slippageBps?: number;
  /** Identifier of the operator who triggered this, for the audit trail. */
  requestedBy: string;
}

export interface TreasuryMovementResult {
  id: string;
  venue: TreasuryVenueId;
  operation: 'deposit' | 'withdraw';
  status: 'submitted';
  amount: string;
  assetCode: string;
  txHash: string;
  explorerUrl: string;
}

/** Minimal surface TreasuryService needs from a vault, for injection in tests. */
export type VaultClient = Pick<
  DefindexVaultContractClient,
  | 'balance'
  | 'totalSupply'
  | 'fetchTotalManagedFunds'
  | 'getAssetAmountsPerShares'
  | 'getFees'
  | 'deposit'
  | 'withdraw'
>;

export type VaultClientFactory = (venue: TreasuryVenue, signerSecret?: string) => VaultClient;

/**
 * Convert a whole-unit decimal amount into the asset's smallest unit.
 *
 * Done with string arithmetic rather than `Number` so a value like `0.1` is not
 * bent by binary floating point before it reaches the contract. Throws on more
 * precision than the asset can represent instead of silently truncating funds.
 */
export function toSmallestUnit(amount: number | string, decimals: number): bigint {
  const raw = typeof amount === 'number' ? normalizeNumericAmount(amount, decimals) : amount.trim();

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw ApiError.badRequest('Amount must be a positive decimal number');
  }

  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > decimals) {
    throw ApiError.badRequest(
      `Amount has more than ${decimals} decimal places, which this asset cannot represent`,
    );
  }

  const scaled = BigInt(`${whole}${fraction.padEnd(decimals, '0')}`);
  if (scaled <= 0n) {
    throw ApiError.badRequest('Amount must be greater than zero');
  }

  return scaled;
}

/**
 * Render a JS number as plain decimal notation.
 *
 * `Number.prototype.toString` switches to exponential form below 1e-6, so a
 * legitimate seven-decimal amount like `0.0000005` arrives as `"5e-7"` and
 * would otherwise be rejected as malformed. `toFixed` gives the plain form;
 * comparing back catches a value carrying more precision than the asset can
 * represent, which is still rejected rather than quietly rounded.
 */
function normalizeNumericAmount(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || Math.abs(amount) >= 1e21) {
    throw ApiError.badRequest('Amount must be a finite decimal number');
  }

  const fixed = amount.toFixed(decimals);
  if (Number(fixed) !== amount) {
    throw ApiError.badRequest(
      `Amount has more than ${decimals} decimal places, which this asset cannot represent`,
    );
  }

  return fixed;
}

/** Render a smallest-unit integer back as a whole-unit decimal string. */
export function fromSmallestUnit(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(decimals, '0');

  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Apply a slippage floor: `value * (10000 - bps) / 10000`, rounded down. */
export function applySlippageFloor(value: bigint, slippageBps: number): bigint {
  return (value * (BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;
}

function assertSlippage(slippageBps: number): number {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) {
    throw ApiError.badRequest(`slippageBps must be an integer between 0 and ${MAX_SLIPPAGE_BPS}`);
  }
  return slippageBps;
}

/**
 * Map a contract-level failure onto an HTTP response that says what actually
 * went wrong on chain.
 *
 * The codes here are the ones a treasury movement can realistically hit, taken
 * from the deployed contracts' error enums (vault `ContractError`, DeFindex
 * `StrategyError`, and the Stellar Asset Contract codes reached through the
 * vault's `transfer` call). Anything unrecognised falls through as a 502: the
 * external venue failed in a way this service does not model, and pretending
 * otherwise would be worse than saying so.
 *
 * Note on price feeds: these two vaults are single-asset, and their deposit and
 * withdraw paths do not consult an oracle, verified by simulating a deposit
 * against the deployed testnet vault and reading the call tree, which contains
 * only balance reads, a token transfer and the strategy call. A Blend-side
 * pricing failure would surface as `ExternalError` from the strategy, which is
 * mapped below; there is no separate staleness check to make here.
 */
export function mapVaultErrorToApiError(error: DefindexVaultError): ApiError {
  const details = {
    venueError: error.errorName,
    contractErrorCode: error.errorCode ?? null,
    contractErrorSource: error.source,
  };

  switch (error.errorName) {
    // The venue is not accepting funds right now.
    case 'StrategyPaused':
    case 'StrategyPausedOrNotFound':
      return new ApiError(
        503,
        'TREASURY_VENUE_PAUSED',
        'The venue strategy is paused and is not accepting treasury movements right now',
        details,
      );

    // The venue cannot service a movement of this size.
    case 'InsufficientManagedFunds':
    case 'UnwindMoreThanAvailable':
    case 'AmountOverTotalSupply':
    case 'InsufficientLiquidity':
      return new ApiError(
        409,
        'TREASURY_INSUFFICIENT_VENUE_LIQUIDITY',
        'The venue does not currently hold enough liquidity to service this movement',
        details,
      );

    // The treasury account itself cannot fund the movement.
    case 'BalanceError':
    case 'InsufficientBalance':
      return new ApiError(
        409,
        'TREASURY_INSUFFICIENT_BALANCE',
        'The treasury account does not hold enough of this asset for the requested amount',
        details,
      );

    case 'TrustlineMissingError':
      return new ApiError(
        409,
        'TREASURY_TRUSTLINE_MISSING',
        'The treasury account has no trustline for this asset; establish one before depositing',
        details,
      );

    case 'BalanceDeauthorizedError':
      return new ApiError(
        409,
        'TREASURY_ASSET_NOT_AUTHORIZED',
        'The asset issuer has not authorized the treasury account to hold this asset',
        details,
      );

    // Amount is below what the venue will process, or slippage was not met.
    case 'AmountBelowMinDust':
    case 'InsufficientAmount':
    case 'AmountNotAllowed':
    case 'OnlyPositiveAmountAllowed':
      return new ApiError(
        422,
        'TREASURY_AMOUNT_REJECTED',
        'The venue rejected this amount as too small or otherwise not permitted',
        details,
      );

    case 'UnderlyingAmountBelowMin':
    case 'BTokensAmountBelowMin':
    case 'InsufficientOutputAmount':
      return new ApiError(
        409,
        'TREASURY_SLIPPAGE_EXCEEDED',
        'The movement would settle below the requested slippage floor; retry with a wider tolerance',
        details,
      );

    case 'DeadlineExpired':
      return new ApiError(
        409,
        'TREASURY_DEADLINE_EXPIRED',
        'The venue rejected the movement because its deadline had passed; retry',
        details,
      );

    case 'Unauthorized':
    case 'NotAuthorized':
      return new ApiError(
        403,
        'TREASURY_UNAUTHORIZED',
        'The configured treasury account is not authorized for this operation on the venue',
        details,
      );

    // The strategy's own underlying protocol (Blend) rejected the call.
    case 'ExternalError':
    case 'SupplyNotFound':
    case 'StrategyInvestError':
    case 'StrategyWithdrawError':
      return new ApiError(
        502,
        'TREASURY_VENUE_REJECTED',
        'The underlying lending protocol rejected the movement',
        details,
      );

    default:
      return new ApiError(502, 'TREASURY_VENUE_ERROR', error.message, details);
  }
}

/** Shape of the SDK's `SentTransaction` that this service depends on. */
interface SentMovement {
  sendTransactionResponse?: { hash?: string };
  getTransactionResponse?: { txHash?: string };
  result?: unknown;
}

/**
 * Pull the share delta out of a submitted movement's return value.
 *
 * `deposit` returns `(amounts, shares_minted, allocations)`; `withdraw` returns
 * the amounts withdrawn and no share count, since the caller already knows how
 * many shares it burned. Returns `null` when the value is not in the expected
 * shape, which keeps an unrecognised result from failing a landed transaction.
 */
function readSharesFromResult(
  sent: SentMovement,
  operation: 'deposit' | 'withdraw',
): bigint | null {
  if (operation !== 'deposit') {
    return null;
  }

  try {
    const raw = sent.result;
    const value =
      raw && typeof raw === 'object' && 'unwrap' in raw
        ? (raw as { unwrap(): unknown }).unwrap()
        : raw;

    if (Array.isArray(value) && typeof value[1] === 'bigint') {
      return value[1];
    }
  } catch {
    // Result parsing is a convenience, never a reason to fail a landed movement.
  }

  return null;
}

function defaultVaultClientFactory(venue: TreasuryVenue, signerSecret?: string): VaultClient {
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
  const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

  if (!signerSecret) {
    return DefindexVaultContractClient.fromConfig({
      contractId: venue.vaultContractId,
      networkPassphrase,
      rpcUrl,
      publicKey: getTreasurySourcePublicKey() ?? undefined,
    });
  }

  const signer = createNodeContractSigner(signerSecret, networkPassphrase);
  return DefindexVaultContractClient.fromConfig({
    contractId: venue.vaultContractId,
    networkPassphrase,
    rpcUrl,
    publicKey: signer.publicKey,
    signTransaction: signer.signTransaction,
  });
}

/**
 * Treasury track (roadmap Phase 1a).
 *
 * Deposits the accumulated platform fee into already-deployed, already-audited
 * DeFi venues, reads the resulting position back off chain, and keeps a local
 * record of both. Every number this service reports about a position is read
 * from the vault contract at request time, nothing here is estimated, and the
 * stored snapshots are a cache of past reads, not a substitute for them.
 */
export class TreasuryService {
  /** Last snapshot write per venue, to rate-limit read-triggered captures. */
  private readonly lastSnapshotAt = new Map<TreasuryVenueId, number>();

  constructor(
    private readonly vaultClientFactory: VaultClientFactory = defaultVaultClientFactory,
    private readonly audit: AuditService = auditService,
    private readonly cache: CacheService = cacheService,
  ) {}

  /** Every venue in the registry, with whether it is usable on this network. */
  listVenues(): TreasuryVenueStatus[] {
    return TREASURY_VENUE_IDS.map((id) => {
      const venue = getTreasuryVenue(id);
      return {
        venue: id,
        configured: venue !== null,
        label: venue?.label ?? id,
        provider: venue?.provider ?? 'unknown',
        strategy: venue?.strategy ?? 'unknown',
      };
    });
  }

  /**
   * Read the platform's position in one venue directly from the vault.
   *
   * Four contract reads are needed and they are independent, so they run
   * together: share balance, total supply, total managed funds, and fees.
   */
  async getPosition(venueId: TreasuryVenueId): Promise<TreasuryPosition> {
    const venue = this.requireVenue(venueId);
    const sourceAccount = getTreasurySourcePublicKey();
    const cacheKey = `treasury:position:${venue.id}:${venue.vaultContractId}:${sourceAccount ?? 'none'}`;

    const cached = await this.cache.get<TreasuryPosition>(cacheKey).catch(() => null);
    if (cached) {
      return cached;
    }

    const client = this.vaultClientFactory(venue);

    try {
      const [shares, managedFunds, fees] = await Promise.all([
        sourceAccount ? client.balance(sourceAccount) : Promise.resolve(0n),
        client.fetchTotalManagedFunds(),
        client.getFees(),
      ]);

      const allocation = this.selectAllocation(managedFunds, venue);
      const positionValue = shares > 0n ? await this.valueOfShares(client, shares) : 0n;

      const strategies: TreasuryStrategyView[] = allocation.strategy_allocations.map((entry) => ({
        address: entry.strategy_address,
        amount: fromSmallestUnit(entry.amount, venue.assetDecimals),
        paused: entry.paused,
      }));

      const position: TreasuryPosition = {
        venue: venue.id,
        label: venue.label,
        provider: venue.provider,
        strategy: venue.strategy,
        assetCode: venue.assetCode,
        vaultContractId: venue.vaultContractId,
        assetContractId: venue.assetContractId,
        shares: fromSmallestUnit(shares, venue.assetDecimals),
        positionValue: fromSmallestUnit(positionValue, venue.assetDecimals),
        vaultTotalManaged: fromSmallestUnit(allocation.total_amount, venue.assetDecimals),
        vaultIdleAmount: fromSmallestUnit(allocation.idle_amount, venue.assetDecimals),
        vaultInvestedAmount: fromSmallestUnit(allocation.invested_amount, venue.assetDecimals),
        strategies,
        paused: strategies.length > 0 && strategies.every((entry) => entry.paused),
        fees: { vaultBps: fees[0], protocolBps: fees[1] },
        explorer: {
          vault: this.explorerContractUrl(venue.vaultContractId),
          asset: this.explorerContractUrl(venue.assetContractId),
          account: sourceAccount ? this.explorerAccountUrl(sourceAccount) : null,
        },
        readAt: new Date().toISOString(),
      };

      // Neither the cache write nor the snapshot may fail a read that already
      // succeeded against the chain: both are conveniences layered on top of it.
      await this.cache.set(cacheKey, position, POSITION_CACHE_TTL_SECONDS).catch(() => {});

      await this.persistSnapshot(position).catch((error: unknown) => {
        logger.warn('Failed to persist treasury position snapshot', {
          venue: venue.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      return position;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  /** Positions across every configured venue, plus what could not be read. */
  async getPortfolio(): Promise<TreasuryPortfolio> {
    const configured = getConfiguredTreasuryVenues();
    const configuredIds = new Set(configured.map((venue) => venue.id));

    const results = await Promise.allSettled(configured.map((venue) => this.getPosition(venue.id)));

    const positions: TreasuryPosition[] = [];
    const unavailable: TreasuryPortfolio['unavailable'] = [];

    results.forEach((result, index) => {
      const venue = configured[index]!;
      if (result.status === 'fulfilled') {
        positions.push(result.value);
      } else {
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.warn('Treasury venue read failed', { venue: venue.id, error: reason });
        unavailable.push({ venue: venue.id, reason });
      }
    });

    return {
      positions,
      unconfigured: this.listVenues().filter((venue) => !configuredIds.has(venue.venue)),
      unavailable,
      sourceAccount: getTreasurySourcePublicKey(),
      network: process.env.STELLAR_NETWORK ?? 'testnet',
    };
  }

  /** Deposit `amount` of the venue's underlying asset into its vault. */
  async deposit(request: TreasuryMovementRequest): Promise<TreasuryMovementResult> {
    const venue = this.requireVenue(request.venue);
    const source = this.requireSourceAccount();
    const slippageBps = assertSlippage(request.slippageBps ?? DEFAULT_SLIPPAGE_BPS);
    const amount = toSmallestUnit(request.amount, venue.assetDecimals);

    const client = this.vaultClientFactory(venue, source.secret);

    return this.executeMovement({
      venue,
      operation: 'deposit',
      amount,
      requestedBy: request.requestedBy,
      sourceAccount: source.publicKey,
      metadata: { slippageBps, invest: true },
      send: async () => {
        const transaction = await client.deposit({
          amountsDesired: [amount],
          amountsMin: [applySlippageFloor(amount, slippageBps)],
          from: source.publicKey,
          invest: true,
        });
        return this.signAndSend(transaction, 'deposit');
      },
    });
  }

  /**
   * Withdraw `amount` of the venue's underlying asset back to the treasury.
   *
   * The vault burns shares, not asset amounts, so the requested amount is
   * converted using the vault's live share price, the same rule of three
   * DeFindex documents: `shares = total_supply * amount / total_managed`.
   */
  async withdraw(request: TreasuryMovementRequest): Promise<TreasuryMovementResult> {
    const venue = this.requireVenue(request.venue);
    const source = this.requireSourceAccount();
    const slippageBps = assertSlippage(request.slippageBps ?? DEFAULT_SLIPPAGE_BPS);
    const amount = toSmallestUnit(request.amount, venue.assetDecimals);

    const client = this.vaultClientFactory(venue, source.secret);

    return this.executeMovement({
      venue,
      operation: 'withdraw',
      amount,
      requestedBy: request.requestedBy,
      sourceAccount: source.publicKey,
      metadata: { slippageBps },
      send: async () => {
        const shares = await this.sharesForAmount(client, venue, amount);
        const transaction = await client.withdraw({
          withdrawShares: shares,
          minAmountsOut: [applySlippageFloor(amount, slippageBps)],
          from: source.publicKey,
        });
        const sent = await this.signAndSend(transaction, 'withdraw');
        // The caller chose the share count, so record that rather than guess.
        return { ...sent, shares };
      },
    });
  }

  /**
   * Run a movement, recording it either way.
   *
   * A failed movement is written to `treasury_transactions` with the contract
   * error before the error is re-thrown, so the history endpoint shows attempts
   * that did not land rather than only the ones that did.
   */
  private async executeMovement(params: {
    venue: TreasuryVenue;
    operation: 'deposit' | 'withdraw';
    amount: bigint;
    requestedBy: string;
    sourceAccount: string;
    metadata: Record<string, unknown>;
    send: () => Promise<{ txHash: string; shares: bigint | null }>;
  }): Promise<TreasuryMovementResult> {
    const { venue, operation, amount, requestedBy, sourceAccount, metadata } = params;
    const amountLabel = fromSmallestUnit(amount, venue.assetDecimals);

    let sent: { txHash: string; shares: bigint | null };
    try {
      sent = await params.send();
    } catch (error) {
      const apiError = this.toApiError(error);
      await this.recordFailure({
        venue,
        operation,
        amountLabel,
        requestedBy,
        sourceAccount,
        metadata,
        apiError,
      });
      throw apiError;
    }

    const { txHash, shares } = sent;
    const record = await TreasuryRepository.recordTransaction({
      venue: venue.id,
      operation,
      status: 'submitted',
      vaultContractId: venue.vaultContractId,
      sourceAccount,
      assetCode: venue.assetCode,
      amount: amountLabel,
      shares: shares === null ? null : fromSmallestUnit(shares, venue.assetDecimals),
      txHash,
      requestedBy,
      metadata,
    });

    await this.audit.logAction({
      actor: requestedBy,
      action: `treasury.${operation}`,
      entityType: 'treasury_transaction',
      entityId: record.id,
      afterValue: { venue: venue.id, amount: amountLabel, assetCode: venue.assetCode, txHash },
    });

    return {
      id: record.id,
      venue: venue.id,
      operation,
      status: 'submitted',
      amount: amountLabel,
      assetCode: venue.assetCode,
      txHash,
      explorerUrl: `${getStellarExpertBaseUrl()}/tx/${txHash}`,
    };
  }

  private async recordFailure(params: {
    venue: TreasuryVenue;
    operation: 'deposit' | 'withdraw';
    amountLabel: string;
    requestedBy: string;
    sourceAccount: string;
    metadata: Record<string, unknown>;
    apiError: ApiError;
  }): Promise<void> {
    const details = params.apiError.details as
      { venueError?: string; contractErrorCode?: number | null } | undefined;

    await TreasuryRepository.recordTransaction({
      venue: params.venue.id,
      operation: params.operation,
      status: 'failed',
      vaultContractId: params.venue.vaultContractId,
      sourceAccount: params.sourceAccount,
      assetCode: params.venue.assetCode,
      amount: params.amountLabel,
      errorName: details?.venueError ?? params.apiError.code,
      errorCode: details?.contractErrorCode != null ? String(details.contractErrorCode) : null,
      requestedBy: params.requestedBy,
      metadata: { ...params.metadata, message: params.apiError.message },
    }).catch((error: unknown) => {
      logger.error('Failed to record treasury movement failure', {
        venue: params.venue.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /** Recorded movements, newest first. */
  async getHistory(params: { venue?: TreasuryVenueId; limit: number; offset: number }) {
    const [transactions, snapshots] = await Promise.all([
      TreasuryRepository.listTransactions(params),
      TreasuryRepository.listSnapshots(params),
    ]);

    return {
      transactions: transactions.map((row) => ({
        id: row.id,
        venue: row.venue,
        operation: row.operation,
        status: row.status,
        assetCode: row.assetCode,
        amount: row.amount,
        shares: row.shares,
        txHash: row.txHash,
        explorerUrl: row.txHash ? `${getStellarExpertBaseUrl()}/tx/${row.txHash}` : null,
        errorName: row.errorName,
        errorCode: row.errorCode,
        requestedBy: row.requestedBy,
        createdAt: row.createdAt,
      })),
      snapshots: snapshots.map((row) => ({
        venue: row.venue,
        assetCode: row.assetCode,
        shares: row.shares,
        positionValue: row.positionValue,
        vaultTotalManaged: row.vaultTotalManaged,
        capturedAt: row.capturedAt,
      })),
    };
  }

  /** Underlying-asset value of a share balance, read from the vault. */
  private async valueOfShares(client: VaultClient, shares: bigint): Promise<bigint> {
    const amounts = await client.getAssetAmountsPerShares(shares);
    return amounts[0] ?? 0n;
  }

  /**
   * Shares to burn to receive `amount` of the underlying asset.
   *
   * Rounded up, because rounding down would leave the withdrawal short of the
   * requested amount and trip the caller's own slippage floor.
   */
  private async sharesForAmount(
    client: VaultClient,
    venue: TreasuryVenue,
    amount: bigint,
  ): Promise<bigint> {
    const [totalSupply, managedFunds] = await Promise.all([
      client.totalSupply(),
      client.fetchTotalManagedFunds(),
    ]);

    const allocation = this.selectAllocation(managedFunds, venue);

    if (totalSupply <= 0n || allocation.total_amount <= 0n) {
      throw new ApiError(
        409,
        'TREASURY_INSUFFICIENT_VENUE_LIQUIDITY',
        'The venue holds no funds, so there is nothing to withdraw',
      );
    }

    if (amount > allocation.total_amount) {
      throw new ApiError(
        409,
        'TREASURY_INSUFFICIENT_VENUE_LIQUIDITY',
        'The venue does not currently hold enough liquidity to service this movement',
      );
    }

    const numerator = totalSupply * amount;
    const shares = numerator / allocation.total_amount;
    return numerator % allocation.total_amount === 0n ? shares : shares + 1n;
  }

  /**
   * Pick the allocation entry for the venue's configured asset.
   *
   * These vaults are single-asset today, but selecting by address rather than
   * by index means a vault that later gains a second asset reports the right
   * one instead of silently reporting the wrong balance.
   */
  private selectAllocation(
    managedFunds: CurrentAssetInvestmentAllocation[],
    venue: TreasuryVenue,
  ): CurrentAssetInvestmentAllocation {
    const match = managedFunds.find((allocation) => allocation.asset === venue.assetContractId);

    if (!match) {
      throw new ApiError(
        502,
        'TREASURY_VENUE_ASSET_MISMATCH',
        `Vault ${venue.vaultContractId} does not manage the configured asset ${venue.assetContractId}`,
        { managedAssets: managedFunds.map((allocation) => allocation.asset) },
      );
    }

    return match;
  }

  /**
   * Submit an assembled movement and read back what the contract returned.
   *
   * The share delta is best-effort: it enriches the recorded history, so a
   * result shape this service does not recognise is left as `null` rather than
   * failing a movement that has already landed on chain.
   */
  private async signAndSend(
    transaction: {
      signAndSend: () => Promise<SentMovement>;
    },
    operation: 'deposit' | 'withdraw',
  ): Promise<{ txHash: string; shares: bigint | null }> {
    const sent = await transaction.signAndSend();
    const txHash = sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;

    if (!txHash) {
      throw new ApiError(
        502,
        'TREASURY_TX_HASH_MISSING',
        'The treasury movement was submitted but no transaction hash was returned',
      );
    }

    return { txHash, shares: readSharesFromResult(sent, operation) };
  }

  /**
   * Store a position snapshot, at most once per {@link SNAPSHOT_MIN_INTERVAL_MS}
   * per venue. Read-triggered capture is what builds the history chart, but an
   * unauthenticated endpoint must not turn page loads into unbounded writes.
   */
  private async persistSnapshot(position: TreasuryPosition): Promise<void> {
    const now = Date.now();
    const last = this.lastSnapshotAt.get(position.venue) ?? 0;
    if (now - last < SNAPSHOT_MIN_INTERVAL_MS) {
      return;
    }
    this.lastSnapshotAt.set(position.venue, now);

    await TreasuryRepository.recordSnapshot({
      venue: position.venue,
      vaultContractId: position.vaultContractId,
      assetCode: position.assetCode,
      shares: position.shares,
      positionValue: position.positionValue,
      vaultTotalManaged: position.vaultTotalManaged,
    });
  }

  private requireVenue(venueId: TreasuryVenueId): TreasuryVenue {
    const venue = getTreasuryVenue(venueId);
    if (!venue) {
      throw new ApiError(
        503,
        'TREASURY_VENUE_NOT_CONFIGURED',
        `Treasury venue '${venueId}' has no contract addresses configured for this network`,
      );
    }
    return venue;
  }

  private requireSourceAccount() {
    const source = getTreasurySourceAccount();
    if (!source) {
      throw new ApiError(
        503,
        'TREASURY_SOURCE_NOT_CONFIGURED',
        'No treasury signing key is configured; treasury movements are unavailable',
      );
    }
    return source;
  }

  private explorerContractUrl(contractId: string): string {
    return `${getStellarExpertBaseUrl()}/contract/${contractId}`;
  }

  private explorerAccountUrl(address: string): string {
    return `${getStellarExpertBaseUrl()}/account/${address}`;
  }

  private toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    const vaultError = error instanceof DefindexVaultError ? error : toDefindexVaultError(error);

    return mapVaultErrorToApiError(vaultError);
  }
}

export const treasuryService = new TreasuryService();
