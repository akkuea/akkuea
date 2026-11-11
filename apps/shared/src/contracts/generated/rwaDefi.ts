import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Duration,
  Result,
} from "@stellar/stellar-sdk/contract";
const browserWindow = globalThis as typeof globalThis & {
  window?: { Buffer?: typeof Buffer };
};

if (browserWindow.window) {
  browserWindow.window.Buffer = browserWindow.window.Buffer || Buffer;
}

export type Role =
  | { tag: "Admin"; values: void }
  | { tag: "Pauser"; values: void }
  | { tag: "Oracle"; values: void }
  | { tag: "Verifier"; values: void }
  | { tag: "Liquidator"; values: void }
  | { tag: "EmergencyGuard"; values: void };

export type RoleKey =
  | { tag: "Admin"; values: void }
  | { tag: "Paused"; values: void }
  | { tag: "HasRole"; values: readonly [string, Role] }
  | { tag: "RoleMembers"; values: readonly [Role] }
  | { tag: "PendingAdmin"; values: void }
  | { tag: "PendingRecovery"; values: void };

export interface PendingRecoveryData {
  earliest_execution: u64;
  scheduled_at: u64;
  scheduled_by: string;
}

/**
 * Storage key types for the lending module
 */
export type LendingKey =
  | { tag: "Pool"; values: readonly [string] }
  | { tag: "PoolList"; values: void }
  | { tag: "PoolCount"; values: void }
  | { tag: "DepositPosition"; values: readonly [string, string] }
  | { tag: "BorrowPosition"; values: readonly [string, string] }
  | { tag: "UserDeposits"; values: readonly [string] }
  | { tag: "UserBorrows"; values: readonly [string] }
  | { tag: "PoolTotalDeposits"; values: readonly [string] }
  | { tag: "PoolTotalBorrows"; values: readonly [string] }
  | { tag: "PoolInterestIndex"; values: readonly [string] }
  | { tag: "PoolLastAccrual"; values: readonly [string] }
  | { tag: "PoolReserves"; values: readonly [string] }
  | { tag: "InterestRateModel"; values: readonly [string] }
  | { tag: "LendingConfig"; values: void }
  | { tag: "PoolPaused"; values: readonly [string] }
  | { tag: "Admin"; values: void }
  | { tag: "OracleAddress"; values: void }
  | { tag: "OracleMaxAge"; values: void }
  | { tag: "OracleMinPrice"; values: void };

/**
 * Lending pool configuration and state
 */
export interface LendingPool {
  /**
   * Asset symbol (e.g., "USDC")
   */
  asset: string;
  /**
   * Asset contract address
   */
  asset_address: string;
  /**
   * Close factor - max % of debt liquidatable per tx (e.g., 50% = 500000000000000000)
   */
  close_factor: i128;
  /**
   * Collateral factor (e.g., 75% = 750000000000000000)
   */
  collateral_factor: i128;
  /**
   * Pool creation timestamp
   */
  created_at: u64;
  /**
   * Unique pool identifier
   */
  id: string;
  /**
   * Whether pool is active
   */
  is_active: boolean;
  /**
   * Liquidation penalty (e.g., 5% = 50000000000000000)
   */
  liquidation_penalty: i128;
  /**
   * Liquidation threshold (e.g., 80% = 800000000000000000)
   */
  liquidation_threshold: i128;
  /**
   * Pool display name
   */
  name: string;
  /**
   * Reserve factor in basis points (e.g., 1000 = 10%)
   */
  reserve_factor: u32;
}

/**
 * Lending pool event data
 */
export interface DepositEvent {
  amount: i128;
  depositor: string;
  pool_id: string;
}

/**
 * Withdraw event data
 */
export interface WithdrawEvent {
  amount: i128;
  depositor: string;
  pool_id: string;
}

/**
 * Pool created event data
 */
export interface PoolCreatedEvent {
  admin: string;
  pool_id: string;
}

/**
 * Interest rate model parameters
 * Uses linear model: rate = base + (utilization * slope)
 */
export interface InterestRateModel {
  /**
   * Base rate (in PRECISION units, e.g., 2% = 0.02 * PRECISION)
   */
  base_rate: i128;
  /**
   * Optimal utilization rate (e.g., 80% = 0.8 * PRECISION)
   */
  optimal_utilization: i128;
  /**
   * Slope below optimal utilization
   */
  slope1: i128;
  /**
   * Slope above optimal utilization
   */
  slope2: i128;
}

/**
 * Borrow position for a user in a pool
 */
export interface BorrowPosition {
  /**
   * Timestamp of borrow
   */
  borrowed_at: u64;
  /**
   * Borrower address
   */
  borrower: string;
  /**
   * Collateral amount
   */
  collateral_amount: i128;
  /**
   * Collateral asset address
   */
  collateral_asset: string;
  /**
   * Interest index at borrow time
   */
  index_at_borrow: i128;
  /**
   * Pool ID
   */
  pool_id: string;
  /**
   * Principal borrowed
   */
  principal: i128;
}

/**
 * Deposit position for a user in a pool
 */
export interface DepositPosition {
  /**
   * Deposit amount in underlying tokens
   */
  amount: i128;
  /**
   * Timestamp of deposit
   */
  deposited_at: u64;
  /**
   * Depositor address
   */
  depositor: string;
  /**
   * Interest index at deposit time
   */
  index_at_deposit: i128;
  /**
   * Pool ID
   */
  pool_id: string;
  /**
   * Share of pool (for interest calculation)
   */
  shares: i128;
}

/**
 * Storage keys for the property tokenization contract
 *
 * This enum defines unique storage keys to prevent collisions and organize
 * contract data efficiently. Each key type corresponds to a specific data
 * structure stored on-chain.
 */
export type StorageKey =
  | { tag: "TokenConfig"; values: void }
  | { tag: "Property"; values: readonly [u64] }
  | { tag: "ShareBalance"; values: readonly [u64, string] }
  | { tag: "TotalShares"; values: readonly [u64] }
  | { tag: "Admin"; values: void }
  | { tag: "PropertyCounter"; values: void }
  | { tag: "Allowance"; values: readonly [u64, string, string] }
  | { tag: "AvailableShares"; values: readonly [u64] }
  | { tag: "PricePerShare"; values: readonly [u64] }
  | { tag: "PropertyVerified"; values: readonly [u64] };

/**
 * Token configuration for the property tokenization contract
 *
 * This structure stores global configuration for the token, including
 * metadata like symbol, name, and admin settings. Storage is optimized
 * by using a single instance per contract.
 */
export interface TokenConfig {
  /**
   * Admin address with special permissions
   */
  admin: string;
  /**
   * Number of decimal places (typically 7 for Soroban)
   */
  decimals: u32;
  /**
   * Whether the contract is initialized
   */
  initialized: boolean;
  /**
   * Token name (e.g., "Property Token")
   */
  name: string;
  /**
   * Token symbol (e.g., "PRPT")
   */
  symbol: string;
}

/**
 * Property metadata stored on-chain
 *
 * This structure contains all essential information about a tokenized property.
 * Fields are optimized for storage cost while maintaining necessary data integrity.
 */
export interface PropertyMetadata {
  /**
   * Timestamp when the property was registered
   */
  created_at: u64;
  /**
   * Detailed description of the property
   */
  description: string;
  /**
   * Whether the property is active for trading
   */
  is_active: boolean;
  /**
   * Physical location or address
   */
  location: string;
  /**
   * Property name or title
   */
  name: string;
  /**
   * Address of the property owner/creator
   */
  owner: string;
  /**
   * Unique identifier for the property
   */
  property_id: u64;
  /**
   * Total number of shares available for this property
   */
  total_shares: u64;
  /**
   * Total valuation in base currency units
   */
  valuation: i128;
}

/**
 * Asset type
 */
export type Asset =
  | { tag: "Stellar"; values: readonly [string] }
  | { tag: "Other"; values: readonly [string] };

/**
 * Price data for an asset at a specific timestamp
 */
export interface PriceData {
  price: i128;
  timestamp: u64;
}

export const Errors = {
  1: { message: "NotAdmin" },
  2: { message: "NotPendingAdmin" },
  3: { message: "AlreadyInitialized" },
  4: { message: "Unauthorized" },
  5: { message: "ContractPaused" },
  6: { message: "ContractNotPaused" },
  7: { message: "BalanceOverflow" },
  8: { message: "InsufficientBalance" },
  9: { message: "InsufficientAllowance" },
  10: { message: "BorrowRateUtilizationMulOverflow" },
  11: { message: "BorrowRateBaseAddOverflow" },
  12: { message: "BorrowRateBaseSlope1AddOverflow" },
  13: { message: "BorrowRateExcessMulOverflow" },
  14: { message: "BorrowRateRateAtOptimalAddOverflow" },
  15: { message: "SupplyRateBorrowRateMulOverflow" },
  16: { message: "NewIndexMulOverflow" },
  17: { message: "PowPrecisionOverflow" },
  18: { message: "RecoveryAlreadyScheduled" },
  19: { message: "NoRecoveryScheduled" },
  20: { message: "TimelockNotExpired" },
  21: { message: "TimelockOverflow" },
  22: { message: "StalePrice" },
  23: { message: "PriceNotAvailable" },
  24: { message: "InvalidPrice" },
  25: { message: "PriceBelowFloor" },
  26: { message: "OracleNotConfigured" },
  27: { message: "PriceScalingOverflow" },
  28: { message: "OraclePriceInFuture" },
  29: { message: "PaymentTokenMismatch" },
};

export interface Client {
  /**
   * Construct and simulate a repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  repay: (
    {
      borrower,
      pool_id,
      amount,
    }: { borrower: string; pool_id: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<BorrowPosition>>>;

  /**
   * Construct and simulate a borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  borrow: (
    {
      borrower,
      pool_id,
      amount,
      collateral_asset,
      collateral_amount,
    }: {
      borrower: string;
      pool_id: string;
      amount: i128;
      collateral_asset: string;
      collateral_amount: i128;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<BorrowPosition>>>;

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve: (
    {
      owner,
      spender,
      property_id,
      amount,
    }: { owner: string; spender: string; property_id: u64; amount: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit: (
    {
      depositor,
      pool_id,
      amount,
    }: { depositor: string; pool_id: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pool: (
    { pool_id }: { pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<LendingPool>>;

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw: (
    {
      depositor,
      pool_id,
      amount,
    }: { depositor: string; pool_id: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a set_oracle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_oracle: (
    { oracle_address, caller }: { oracle_address: string; caller: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a burn_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn_shares: (
    {
      owner,
      property_id,
      amount,
    }: { owner: string; property_id: u64; amount: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a create_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_pool: (
    {
      admin,
      pool_id,
      name,
      asset,
      asset_address,
      collateral_factor,
      liquidation_threshold,
      liquidation_penalty,
      close_factor,
      reserve_factor,
    }: {
      admin: string;
      pool_id: string;
      name: string;
      asset: string;
      asset_address: string;
      collateral_factor: i128;
      liquidation_threshold: i128;
      liquidation_penalty: i128;
      close_factor: i128;
      reserve_factor: u32;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_balance: (
    { property_id, owner }: { property_id: u64; owner: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u64>>;

  /**
   * Construct and simulate a mint_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint_shares: (
    {
      admin,
      property_id,
      recipient,
      amount,
    }: { admin: string; property_id: u64; recipient: string; amount: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_allowance: (
    {
      property_id,
      owner,
      spender,
    }: { property_id: u64; owner: string; spender: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u64>>;

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_from: (
    {
      spender,
      from,
      to,
      property_id,
      amount,
    }: {
      spender: string;
      from: string;
      to: string;
      property_id: u64;
      amount: u64;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a accrue_interest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  accrue_interest: (
    { pool_id }: { pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a cancel_recovery transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_recovery: (
    { caller }: { caller: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a emergency_pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  emergency_pause: (
    { caller }: { caller: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a purchase_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  purchase_shares: (
    {
      buyer,
      property_id,
      amount,
      payment_token,
    }: { buyer: string; property_id: u64; amount: u64; payment_token: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a transfer_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_shares: (
    {
      from,
      to,
      property_id,
      amount,
    }: { from: string; to: string; property_id: u64; amount: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a execute_recovery transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  execute_recovery: (
    { caller }: { caller: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_total_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_total_shares: (
    { property_id }: { property_id: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u64>>;

  /**
   * Construct and simulate a get_user_borrows transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_borrows: (
    { user }: { user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<string>>>;

  /**
   * Construct and simulate a get_oracle_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the current oracle guardrail parameters: `(max_age, min_price)`.
   */
  get_oracle_config: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<readonly [u64, i128]>>;

  /**
   * Construct and simulate a get_total_borrows transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_total_borrows: (
    { pool_id }: { pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_user_deposits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_deposits: (
    { user }: { user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<string>>>;

  /**
   * Construct and simulate a schedule_recovery transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  schedule_recovery: (
    { caller }: { caller: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_oracle_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Configure oracle guardrail parameters.
   *
   * * `max_age`   – maximum acceptable price age in seconds (0 = use default 3600).
   * * `min_price` – minimum normalized price (floor). Set to 0 to disable.
   */
  set_oracle_config: (
    {
      caller,
      max_age,
      min_price,
    }: { caller: string; max_age: u64; min_price: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_interest_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_interest_index: (
    { pool_id }: { pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_total_deposits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_total_deposits: (
    { pool_id }: { pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_borrow_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_borrow_position: (
    { user, pool_id }: { user: string; pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<BorrowPosition>>;

  /**
   * Construct and simulate a get_deposit_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_deposit_position: (
    { user, pool_id }: { user: string; pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<DepositPosition>>;

  /**
   * Construct and simulate a grant_emergency_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  grant_emergency_role: (
    { admin, target }: { admin: string; target: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a revoke_emergency_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke_emergency_role: (
    { admin, target }: { admin: string; target: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a list_property transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * List a property for sale and open it for `purchase_shares`. Admin-only.
   *
   * Stores the property metadata, marks it verified, and records the sale
   * parameters (price per share, shares for sale and the accepted payment
   * token) in persistent storage. Display metadata such as the name lives in
   * the API database; the chain keeps only the minimal fields this contract
   * needs, keyed by `property_id`.
   */
  list_property: (
    {
      admin,
      property_id,
      owner,
      price_per_share,
      shares_for_sale,
      payment_token,
    }: {
      admin: string;
      property_id: u64;
      owner: string;
      price_per_share: i128;
      shares_for_sale: u64;
      payment_token: string;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_property_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause or delist a property (active = false), or put it back on sale
   * (active = true). Admin-only. Delisting stops `purchase_shares` without
   * touching shares already sold.
   */
  set_property_active: (
    {
      admin,
      property_id,
      active,
    }: { admin: string; property_id: u64; active: boolean },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a liquidate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Liquidate an underwater borrow position.
   *
   * A position is eligible for liquidation when its health factor drops below 1.0
   * (i.e. `health_factor < PRECISION`). The liquidator repays `debt_to_cover`
   * of the borrower's debt and receives the equivalent collateral value plus a
   * liquidation penalty (bonus).
   *
   * # Arguments
   * * `liquidator`       – Address of the account performing the liquidation.
   * * `pool_id`          – The lending pool identifier.
   * * `borrower_address` – Address of the underwater borrower.
   * * `debt_to_cover`    – Amount of debt the liquidator wants to repay
   * (capped at the borrower's current debt).
   *
   * # Returns
   * The resulting (possibly zeroed-out) borrow position.
   */
  liquidate: (
    {
      liquidator,
      pool_id,
      borrower_address,
      debt_to_cover,
    }: {
      liquidator: string;
      pool_id: string;
      borrower_address: string;
      debt_to_cover: i128;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<BorrowPosition>>>;

  /**
   * Construct and simulate a set_close_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Configure the close factor for a pool - max % of debt liquidatable per tx.
   *
   * * `pool_id`         – The lending pool identifier.
   * * `new_close_factor` – New close factor in PRECISION units (e.g., 50% = 500_000_000_000_000_000).
   * * `caller`           – Must be the contract admin.
   */
  set_close_factor: (
    {
      caller,
      pool_id,
      new_close_factor,
    }: { caller: string; pool_id: string; new_close_factor: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate the current health factor for a borrow position.
   *
   * Returns the health factor in PRECISION units (1.0 = PRECISION).
   * A value below PRECISION means the position is underwater and eligible
   * for liquidation. This is a read-only view that does not modify state.
   */
  get_health_factor: (
    { user, pool_id }: { user: string; pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a pause_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause a single lending pool, independent of the global emergency pause.
   * Gated the same way as `emergency_pause`: admin, `Pauser`, or `EmergencyGuard`.
   */
  pause_pool: (
    { caller, pool_id }: { caller: string; pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a unpause_pool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unpause a single lending pool previously paused with `pause_pool`.
   */
  unpause_pool: (
    { caller, pool_id }: { caller: string; pool_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
}
export class Client extends ContractClient {
  static override async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { admin }: { admin: string },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      },
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ admin }, options);
  }
  constructor(public override readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAAAAAAAAAAAFcmVwYXkAAAAAAAADAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAAB3Bvb2xfaWQAAAAAEAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAfQAAAADkJvcnJvd1Bvc2l0aW9uAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAGYm9ycm93AAAAAAAFAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAAB3Bvb2xfaWQAAAAAEAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAABBjb2xsYXRlcmFsX2Fzc2V0AAAAEwAAAAAAAAARY29sbGF0ZXJhbF9hbW91bnQAAAAAAAALAAAAAQAAA+kAAAfQAAAADkJvcnJvd1Bvc2l0aW9uAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAALcHJvcGVydHlfaWQAAAAABgAAAAAAAAAGYW1vdW50AAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAHZGVwb3NpdAAAAAADAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAdwb29sX2lkAAAAABAAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAIZ2V0X3Bvb2wAAAABAAAAAAAAAAdwb29sX2lkAAAAABAAAAABAAAH0AAAAAtMZW5kaW5nUG9vbAA=",
        "AAAAAAAAAAAAAAAId2l0aGRyYXcAAAADAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAdwb29sX2lkAAAAABAAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAKc2V0X29yYWNsZQAAAAAAAgAAAAAAAAAOb3JhY2xlX2FkZHJlc3MAAAAAABMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAALYnVybl9zaGFyZXMAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAGAAAAAAAAAAZhbW91bnQAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAALY3JlYXRlX3Bvb2wAAAAACgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdwb29sX2lkAAAAABAAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAVhc3NldAAAAAAAABAAAAAAAAAADWFzc2V0X2FkZHJlc3MAAAAAAAATAAAAAAAAABFjb2xsYXRlcmFsX2ZhY3RvcgAAAAAAAAsAAAAAAAAAFWxpcXVpZGF0aW9uX3RocmVzaG9sZAAAAAAAAAsAAAAAAAAAE2xpcXVpZGF0aW9uX3BlbmFsdHkAAAAACwAAAAAAAAAMY2xvc2VfZmFjdG9yAAAACwAAAAAAAAAOcmVzZXJ2ZV9mYWN0b3IAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAALZ2V0X2JhbGFuY2UAAAAAAgAAAAAAAAALcHJvcGVydHlfaWQAAAAABgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAALbWludF9zaGFyZXMAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANZ2V0X2FsbG93YW5jZQAAAAAAAAMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAY=",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAUAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAGAAAAAAAAAAZhbW91bnQAAAAAAAYAAAAA",
        "AAAAAAAAAAAAAAAPYWNjcnVlX2ludGVyZXN0AAAAAAEAAAAAAAAAB3Bvb2xfaWQAAAAAEAAAAAEAAAPpAAAAAgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAPY2FuY2VsX3JlY292ZXJ5AAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPZW1lcmdlbmN5X3BhdXNlAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPcHVyY2hhc2Vfc2hhcmVzAAAAAAQAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAAAAAALcHJvcGVydHlfaWQAAAAABgAAAAAAAAAGYW1vdW50AAAAAAAGAAAAAAAAAA1wYXltZW50X3Rva2VuAAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAPdHJhbnNmZXJfc2hhcmVzAAAAAAQAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAALcHJvcGVydHlfaWQAAAAABgAAAAAAAAAGYW1vdW50AAAAAAAGAAAAAA==",
        "AAAAAAAAAAAAAAAQZXhlY3V0ZV9yZWNvdmVyeQAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAQZ2V0X3RvdGFsX3NoYXJlcwAAAAEAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAYAAAABAAAABg==",
        "AAAAAAAAAAAAAAAQZ2V0X3VzZXJfYm9ycm93cwAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAA+oAAAAQ",
        "AAAAAAAAAEdSZXR1cm4gdGhlIGN1cnJlbnQgb3JhY2xlIGd1YXJkcmFpbCBwYXJhbWV0ZXJzOiBgKG1heF9hZ2UsIG1pbl9wcmljZSlgLgAAAAARZ2V0X29yYWNsZV9jb25maWcAAAAAAAAAAAAAAQAAA+0AAAACAAAABgAAAAs=",
        "AAAAAAAAAAAAAAARZ2V0X3RvdGFsX2JvcnJvd3MAAAAAAAABAAAAAAAAAAdwb29sX2lkAAAAABAAAAABAAAACw==",
        "AAAAAAAAAAAAAAARZ2V0X3VzZXJfZGVwb3NpdHMAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAAEA==",
        "AAAAAAAAAAAAAAARc2NoZWR1bGVfcmVjb3ZlcnkAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAMJDb25maWd1cmUgb3JhY2xlIGd1YXJkcmFpbCBwYXJhbWV0ZXJzLgoKKiBgbWF4X2FnZWAgICDigJMgbWF4aW11bSBhY2NlcHRhYmxlIHByaWNlIGFnZSBpbiBzZWNvbmRzICgwID0gdXNlIGRlZmF1bHQgMzYwMCkuCiogYG1pbl9wcmljZWAg4oCTIG1pbmltdW0gbm9ybWFsaXplZCBwcmljZSAoZmxvb3IpLiBTZXQgdG8gMCB0byBkaXNhYmxlLgAAAAAAEXNldF9vcmFjbGVfY29uZmlnAAAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAdtYXhfYWdlAAAAAAYAAAAAAAAACW1pbl9wcmljZQAAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAASZ2V0X2ludGVyZXN0X2luZGV4AAAAAAABAAAAAAAAAAdwb29sX2lkAAAAABAAAAABAAAACw==",
        "AAAAAAAAAAAAAAASZ2V0X3RvdGFsX2RlcG9zaXRzAAAAAAABAAAAAAAAAAdwb29sX2lkAAAAABAAAAABAAAACw==",
        "AAAAAAAAAAAAAAATZ2V0X2JvcnJvd19wb3NpdGlvbgAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAQAAAAAQAAB9AAAAAOQm9ycm93UG9zaXRpb24AAA==",
        "AAAAAAAAAAAAAAAUZ2V0X2RlcG9zaXRfcG9zaXRpb24AAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAQAAAAAQAAB9AAAAAPRGVwb3NpdFBvc2l0aW9uAA==",
        "AAAAAAAAAAAAAAAUZ3JhbnRfZW1lcmdlbmN5X3JvbGUAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABnRhcmdldAAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAVcmV2b2tlX2VtZXJnZW5jeV9yb2xlAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAZ0YXJnZXQAAAAAABMAAAAA",
        "AAAAAAAAAXhMaXN0IGEgcHJvcGVydHkgZm9yIHNhbGUgYW5kIG9wZW4gaXQgZm9yIGBwdXJjaGFzZV9zaGFyZXNgLgoKU3RvcmVzIHRoZSBwcm9wZXJ0eSBtZXRhZGF0YSwgbWFya3MgaXQgdmVyaWZpZWQsIGFuZCByZWNvcmRzIHRoZSBzYWxlCnBhcmFtZXRlcnMgKHByaWNlIHBlciBzaGFyZSwgc2hhcmVzIGZvciBzYWxlIGFuZCB0aGUgYWNjZXB0ZWQgcGF5bWVudAp0b2tlbikgaW4gcGVyc2lzdGVudCBzdG9yYWdlLiBEaXNwbGF5IG1ldGFkYXRhIHN1Y2ggYXMgdGhlIG5hbWUgbGl2ZXMgaW4KdGhlIEFQSSBkYXRhYmFzZTsgdGhlIGNoYWluIGtlZXBzIG9ubHkgdGhlIG1pbmltYWwgZmllbGRzIHRoaXMgY29udHJhY3QKbmVlZHMsIGtleWVkIGJ5IGBwcm9wZXJ0eV9pZGAuAAAADWxpc3RfcHJvcGVydHkAAAAAAAAGAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAYAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAPcHJpY2VfcGVyX3NoYXJlAAAAAAsAAAAAAAAAD3NoYXJlc19mb3Jfc2FsZQAAAAAGAAAAAAAAAA1wYXltZW50X3Rva2VuAAAAAAAAEwAAAAA=",
        "AAAAAAAAAKhQYXVzZSBvciBkZWxpc3QgYSBwcm9wZXJ0eSAoYWN0aXZlID0gZmFsc2UpLCBvciBwdXQgaXQgYmFjayBvbiBzYWxlCihhY3RpdmUgPSB0cnVlKS4gQWRtaW4tb25seS4gRGVsaXN0aW5nIHN0b3BzIGBwdXJjaGFzZV9zaGFyZXNgIHdpdGhvdXQKdG91Y2hpbmcgc2hhcmVzIGFscmVhZHkgc29sZC4AAAATc2V0X3Byb3BlcnR5X2FjdGl2ZQAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAYAAAAAAAAABmFjdGl2ZQAAAAAAAQAAAAA=",
        "AAAAAAAAArtMaXF1aWRhdGUgYW4gdW5kZXJ3YXRlciBib3Jyb3cgcG9zaXRpb24uCgpBIHBvc2l0aW9uIGlzIGVsaWdpYmxlIGZvciBsaXF1aWRhdGlvbiB3aGVuIGl0cyBoZWFsdGggZmFjdG9yIGRyb3BzIGJlbG93IDEuMAooaS5lLiBgaGVhbHRoX2ZhY3RvciA8IFBSRUNJU0lPTmApLiBUaGUgbGlxdWlkYXRvciByZXBheXMgYGRlYnRfdG9fY292ZXJgCm9mIHRoZSBib3Jyb3dlcidzIGRlYnQgYW5kIHJlY2VpdmVzIHRoZSBlcXVpdmFsZW50IGNvbGxhdGVyYWwgdmFsdWUgcGx1cyBhCmxpcXVpZGF0aW9uIHBlbmFsdHkgKGJvbnVzKS4KCiMgQXJndW1lbnRzCiogYGxpcXVpZGF0b3JgICAgICAgIOKAkyBBZGRyZXNzIG9mIHRoZSBhY2NvdW50IHBlcmZvcm1pbmcgdGhlIGxpcXVpZGF0aW9uLgoqIGBwb29sX2lkYCAgICAgICAgICDigJMgVGhlIGxlbmRpbmcgcG9vbCBpZGVudGlmaWVyLgoqIGBib3Jyb3dlcl9hZGRyZXNzYCDigJMgQWRkcmVzcyBvZiB0aGUgdW5kZXJ3YXRlciBib3Jyb3dlci4KKiBgZGVidF90b19jb3ZlcmAgICAg4oCTIEFtb3VudCBvZiBkZWJ0IHRoZSBsaXF1aWRhdG9yIHdhbnRzIHRvIHJlcGF5CiAgICAgICAgICAgICAgICAgICAgICAgKGNhcHBlZCBhdCB0aGUgYm9ycm93ZXIncyBjdXJyZW50IGRlYnQpLgoKIyBSZXR1cm5zClRoZSByZXN1bHRpbmcgKHBvc3NpYmx5IHplcm9lZC1vdXQpIGJvcnJvdyBwb3NpdGlvbi4AAAAACWxpcXVpZGF0ZQAAAAAAAAQAAAAAAAAACmxpcXVpZGF0b3IAAAAAABMAAAAAAAAAB3Bvb2xfaWQAAAAAEAAAAAAAAAAQYm9ycm93ZXJfYWRkcmVzcwAAABMAAAAAAAAADWRlYnRfdG9fY292ZXIAAAAAAAALAAAAAQAAA+kAAAfQAAAADkJvcnJvd1Bvc2l0aW9uAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAARlDb25maWd1cmUgdGhlIGNsb3NlIGZhY3RvciBmb3IgYSBwb29sIC0gbWF4ICUgb2YgZGVidCBsaXF1aWRhdGFibGUgcGVyIHR4LgoKKiBgcG9vbF9pZGAgICAgICAgICDigJMgVGhlIGxlbmRpbmcgcG9vbCBpZGVudGlmaWVyLgoqIGBuZXdfY2xvc2VfZmFjdG9yYCDigJMgTmV3IGNsb3NlIGZhY3RvciBpbiBQUkVDSVNJT04gdW5pdHMgKGUuZy4sIDUwJSA9IDUwMF8wMDBfMDAwXzAwMF8wMDBfMDAwKS4KKiBgY2FsbGVyYCAgICAgICAgICAg4oCTIE11c3QgYmUgdGhlIGNvbnRyYWN0IGFkbWluLgAAAAAAABBzZXRfY2xvc2VfZmFjdG9yAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAdwb29sX2lkAAAAABAAAAAAAAAAEG5ld19jbG9zZV9mYWN0b3IAAAALAAAAAA==",
        "AAAAAAAAAQdDYWxjdWxhdGUgdGhlIGN1cnJlbnQgaGVhbHRoIGZhY3RvciBmb3IgYSBib3Jyb3cgcG9zaXRpb24uCgpSZXR1cm5zIHRoZSBoZWFsdGggZmFjdG9yIGluIFBSRUNJU0lPTiB1bml0cyAoMS4wID0gUFJFQ0lTSU9OKS4KQSB2YWx1ZSBiZWxvdyBQUkVDSVNJT04gbWVhbnMgdGhlIHBvc2l0aW9uIGlzIHVuZGVyd2F0ZXIgYW5kIGVsaWdpYmxlCmZvciBsaXF1aWRhdGlvbi4gVGhpcyBpcyBhIHJlYWQtb25seSB2aWV3IHRoYXQgZG9lcyBub3QgbW9kaWZ5IHN0YXRlLgAAAAARZ2V0X2hlYWx0aF9mYWN0b3IAAAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAQAAAAAQAAA+kAAAALAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAJZQYXVzZSBhIHNpbmdsZSBsZW5kaW5nIHBvb2wsIGluZGVwZW5kZW50IG9mIHRoZSBnbG9iYWwgZW1lcmdlbmN5IHBhdXNlLgpHYXRlZCB0aGUgc2FtZSB3YXkgYXMgYGVtZXJnZW5jeV9wYXVzZWA6IGFkbWluLCBgUGF1c2VyYCwgb3IgYEVtZXJnZW5jeUd1YXJkYC4AAAAAAApwYXVzZV9wb29sAAAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB3Bvb2xfaWQAAAAAEAAAAAA=",
        "AAAAAAAAAEJVbnBhdXNlIGEgc2luZ2xlIGxlbmRpbmcgcG9vbCBwcmV2aW91c2x5IHBhdXNlZCB3aXRoIGBwYXVzZV9wb29sYC4AAAAAAAx1bnBhdXNlX3Bvb2wAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAB3Bvb2xfaWQAAAAAEAAAAAA=",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAdAAAAAAAAAAhOb3RBZG1pbgAAAAEAAAAAAAAAD05vdFBlbmRpbmdBZG1pbgAAAAACAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAMAAAAAAAAADFVuYXV0aG9yaXplZAAAAAQAAAAAAAAADkNvbnRyYWN0UGF1c2VkAAAAAAAFAAAAAAAAABFDb250cmFjdE5vdFBhdXNlZAAAAAAAAAYAAAAAAAAAD0JhbGFuY2VPdmVyZmxvdwAAAAAHAAAAAAAAABNJbnN1ZmZpY2llbnRCYWxhbmNlAAAAAAgAAAAAAAAAFUluc3VmZmljaWVudEFsbG93YW5jZQAAAAAAAAkAAAAAAAAAIEJvcnJvd1JhdGVVdGlsaXphdGlvbk11bE92ZXJmbG93AAAACgAAAAAAAAAZQm9ycm93UmF0ZUJhc2VBZGRPdmVyZmxvdwAAAAAAAAsAAAAAAAAAH0JvcnJvd1JhdGVCYXNlU2xvcGUxQWRkT3ZlcmZsb3cAAAAADAAAAAAAAAAbQm9ycm93UmF0ZUV4Y2Vzc011bE92ZXJmbG93AAAAAA0AAAAAAAAAIkJvcnJvd1JhdGVSYXRlQXRPcHRpbWFsQWRkT3ZlcmZsb3cAAAAAAA4AAAAAAAAAH1N1cHBseVJhdGVCb3Jyb3dSYXRlTXVsT3ZlcmZsb3cAAAAADwAAAAAAAAATTmV3SW5kZXhNdWxPdmVyZmxvdwAAAAAQAAAAAAAAABRQb3dQcmVjaXNpb25PdmVyZmxvdwAAABEAAAAAAAAAGFJlY292ZXJ5QWxyZWFkeVNjaGVkdWxlZAAAABIAAAAAAAAAE05vUmVjb3ZlcnlTY2hlZHVsZWQAAAAAEwAAAAAAAAASVGltZWxvY2tOb3RFeHBpcmVkAAAAAAAUAAAAAAAAABBUaW1lbG9ja092ZXJmbG93AAAAFQAAADlPcmFjbGUgcHJpY2UgYWdlIGV4Y2VlZHMgdGhlIGNvbmZpZ3VyZWQgbWF4X2FnZSB0aHJlc2hvbGQAAAAAAAAKU3RhbGVQcmljZQAAAAAAFgAAADVPcmFjbGUgcmV0dXJuZWQgbm8gcHJpY2UgZGF0YSBmb3IgdGhlIHJlcXVlc3RlZCBhc3NldAAAAAAAABFQcmljZU5vdEF2YWlsYWJsZQAAAAAAABcAAAAgT3JhY2xlIHByaWNlIGlzIHplcm8gb3IgbmVnYXRpdmUAAAAMSW52YWxpZFByaWNlAAAAGAAAADZOb3JtYWxpemVkIHByaWNlIGlzIGJlbG93IHRoZSBjb25maWd1cmVkIG1pbmltdW0gZmxvb3IAAAAAAA9QcmljZUJlbG93Rmxvb3IAAAAAGQAAAC9PcmFjbGUgY29udHJhY3QgYWRkcmVzcyBoYXMgbm90IGJlZW4gY29uZmlndXJlZAAAAAATT3JhY2xlTm90Q29uZmlndXJlZAAAAAAaAAAAL0RlY2ltYWwgbm9ybWFsaXphdGlvbiBvdmVyZmxvd2VkIG9yIHVuZGVyZmxvd2VkAAAAABRQcmljZVNjYWxpbmdPdmVyZmxvdwAAABsAAAAvT3JhY2xlIHByaWNlIHRpbWVzdGFtcCBpcyB0b28gZmFyIGluIHRoZSBmdXR1cmUAAAAAE09yYWNsZVByaWNlSW5GdXR1cmUAAAAAHAAAADlCdXllciBvZmZlcmVkIGEgcGF5bWVudCB0b2tlbiB0aGUgbGlzdGluZyBkb2VzIG5vdCBhY2NlcHQAAAAAAAAUUGF5bWVudFRva2VuTWlzbWF0Y2gAAAAd",
        "AAAAAgAAAAAAAAAAAAAABFJvbGUAAAAGAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAZQYXVzZXIAAAAAAAAAAAAAAAAABk9yYWNsZQAAAAAAAAAAAAAAAAAIVmVyaWZpZXIAAAAAAAAAAAAAAApMaXF1aWRhdG9yAAAAAAAAAAAAAAAAAA5FbWVyZ2VuY3lHdWFyZAAA",
        "AAAAAgAAAAAAAAAAAAAAB1JvbGVLZXkAAAAABgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGUGF1c2VkAAAAAAABAAAAAAAAAAdIYXNSb2xlAAAAAAIAAAATAAAH0AAAAARSb2xlAAAAAQAAAAAAAAALUm9sZU1lbWJlcnMAAAAAAQAAB9AAAAAEUm9sZQAAAAAAAAAAAAAADFBlbmRpbmdBZG1pbgAAAAAAAAAAAAAAD1BlbmRpbmdSZWNvdmVyeQA=",
        "AAAAAQAAAAAAAAAAAAAAE1BlbmRpbmdSZWNvdmVyeURhdGEAAAAAAwAAAAAAAAASZWFybGllc3RfZXhlY3V0aW9uAAAAAAAGAAAAAAAAAAxzY2hlZHVsZWRfYXQAAAAGAAAAAAAAAAxzY2hlZHVsZWRfYnkAAAAT",
        "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",
        "AAAABQAAACxFbWl0dGVkIHdoZW4gYSBwcm9wZXJ0eSBpcyB2ZXJpZmllZCBieSBhZG1pbgAAAAAAAAAQUHJvcGVydHlWZXJpZmllZAAAAAEAAAARcHJvcGVydHlfdmVyaWZpZWQAAAAAAAADAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAQAAAAAAAAAAAAAAALdmVyaWZpZWRfYnkAAAAAEwAAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAClFbWl0dGVkIHdoZW4gYSBuZXcgcHJvcGVydHkgaXMgcmVnaXN0ZXJlZAAAAAAAAAAAAAASUHJvcGVydHlSZWdpc3RlcmVkAAAAAAABAAAAE3Byb3BlcnR5X3JlZ2lzdGVyZWQAAAAABQAAAAAAAAALcHJvcGVydHlfaWQAAAAAEAAAAAAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAAAAAAMdG90YWxfc2hhcmVzAAAACwAAAAAAAAAAAAAAD3ByaWNlX3Blcl9zaGFyZQAAAAALAAAAAAAAAAI=",
        "AAAABQAAACZFbWl0dGVkIHdoZW4gZGl2aWRlbmRzIGFyZSBkaXN0cmlidXRlZAAAAAAAAAAAABNEaXZpZGVuZERpc3RyaWJ1dGVkAAAAAAEAAAAUZGl2aWRlbmRfZGlzdHJpYnV0ZWQAAAAEAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAQAAAAAAAAAAAAAAAMdG90YWxfYW1vdW50AAAACwAAAAAAAAAAAAAAEHBlcl9zaGFyZV9hbW91bnQAAAALAAAAAAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAC",
        "AAAABQAAADpFbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHBhdXNlZCB2aWEgdGhlIGVtZXJnZW5jeSBwYXRoAAAAAAAAAAAAD0VtZXJnZW5jeVBhdXNlZAAAAAABAAAAEGVtZXJnZW5jeV9wYXVzZWQAAAACAAAAAAAAAAJieQAAAAAAEwAAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAD5FbWl0dGVkIHdoZW4gdGhlIHJlY292ZXJ5IGlzIGV4ZWN1dGVkIGFuZCB0aGUgY29udHJhY3QgcmVzdW1lcwAAAAAAAAAAABBSZWNvdmVyeUV4ZWN1dGVkAAAAAQAAABFyZWNvdmVyeV9leGVjdXRlZAAAAAAAAAIAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAC",
        "AAAABQAAAD5FbWl0dGVkIHdoZW4gYSBwZW5kaW5nIHJlY292ZXJ5IGlzIGNhbmNlbGxlZCB3aXRob3V0IHVucGF1c2luZwAAAAAAAAAAABFSZWNvdmVyeUNhbmNlbGxlZAAAAAAAAAEAAAAScmVjb3ZlcnlfY2FuY2VsbGVkAAAAAAACAAAAAAAAAAJieQAAAAAAEwAAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAAC9FbWl0dGVkIHdoZW4gYSB0aW1lbG9ja2VkIHJlY292ZXJ5IGlzIHNjaGVkdWxlZAAAAAAAAAAAEVJlY292ZXJ5U2NoZWR1bGVkAAAAAAAAAQAAABJyZWNvdmVyeV9zY2hlZHVsZWQAAAAAAAMAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAAAAAASZWFybGllc3RfZXhlY3V0aW9uAAAAAAAGAAAAAAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAC",
        "AAAAAgAAAChTdG9yYWdlIGtleSB0eXBlcyBmb3IgdGhlIGxlbmRpbmcgbW9kdWxlAAAAAAAAAApMZW5kaW5nS2V5AAAAAAATAAAAAQAAAC5MZW5kaW5nIHBvb2wgY29uZmlndXJhdGlvbgpTdG9yYWdlOiBQZXJzaXN0ZW50AAAAAAAEUG9vbAAAAAEAAAAQAAAAAAAAAChMaXN0IG9mIGFsbCBwb29sIElEcwpTdG9yYWdlOiBQZXJzaXN0ZW50AAAACFBvb2xMaXN0AAAAAAAAACdUb3RhbCBudW1iZXIgb2YgcG9vbHMKU3RvcmFnZTogSW5zdGFuY2UAAAAACVBvb2xDb3VudAAAAAAAAAEAAAA1RGVwb3NpdCBwb3NpdGlvbiBmb3IgdXNlciBpbiBwb29sClN0b3JhZ2U6IFBlcnNpc3RlbnQAAAAAAAAPRGVwb3NpdFBvc2l0aW9uAAAAAAIAAAATAAAAEAAAAAEAAAA0Qm9ycm93IHBvc2l0aW9uIGZvciB1c2VyIGluIHBvb2wKU3RvcmFnZTogUGVyc2lzdGVudAAAAA5Cb3Jyb3dQb3NpdGlvbgAAAAAAAgAAABMAAAAQAAAAAQAAADFVc2VyJ3MgZGVwb3NpdCBwb3NpdGlvbnMgbGlzdApTdG9yYWdlOiBQZXJzaXN0ZW50AAAAAAAADFVzZXJEZXBvc2l0cwAAAAEAAAATAAAAAQAAADBVc2VyJ3MgYm9ycm93IHBvc2l0aW9ucyBsaXN0ClN0b3JhZ2U6IFBlcnNpc3RlbnQAAAALVXNlckJvcnJvd3MAAAAAAQAAABMAAAABAAAAKVBvb2wncyB0b3RhbCBkZXBvc2l0cwpTdG9yYWdlOiBQZXJzaXN0ZW50AAAAAAAAEVBvb2xUb3RhbERlcG9zaXRzAAAAAAAAAQAAABAAAAABAAAAKFBvb2wncyB0b3RhbCBib3Jyb3dzClN0b3JhZ2U6IFBlcnNpc3RlbnQAAAAQUG9vbFRvdGFsQm9ycm93cwAAAAEAAAAQAAAAAQAAADVQb29sJ3MgYWNjdW11bGF0ZWQgaW50ZXJlc3QgaW5kZXgKU3RvcmFnZTogUGVyc2lzdGVudAAAAAAAABFQb29sSW50ZXJlc3RJbmRleAAAAAAAAAEAAAAQAAAAAQAAACpMYXN0IGFjY3J1YWwgdGltZXN0YW1wClN0b3JhZ2U6IFBlcnNpc3RlbnQAAAAAAA9Qb29sTGFzdEFjY3J1YWwAAAAAAQAAABAAAAABAAAALFJlc2VydmUgYmFsYW5jZSBmb3IgcG9vbApTdG9yYWdlOiBQZXJzaXN0ZW50AAAADFBvb2xSZXNlcnZlcwAAAAEAAAAQAAAAAQAAADBJbnRlcmVzdCByYXRlIG1vZGVsIHBhcmFtZXRlcnMKU3RvcmFnZTogSW5zdGFuY2UAAAARSW50ZXJlc3RSYXRlTW9kZWwAAAAAAAABAAAAEAAAAAAAAAAuR2xvYmFsIGxlbmRpbmcgY29uZmlndXJhdGlvbgpTdG9yYWdlOiBJbnN0YW5jZQAAAAAADUxlbmRpbmdDb25maWcAAAAAAAABAAAAI1Bvb2wgcGF1c2Ugc3RhdHVzClN0b3JhZ2U6IEluc3RhbmNlAAAAAApQb29sUGF1c2VkAAAAAAABAAAAEAAAAAAAAAAwQ29udHJhY3QgYWRtaW5pc3RyYXRvciBhZGRyZXNzClN0b3JhZ2U6IEluc3RhbmNlAAAABUFkbWluAAAAAAAAAAAAACBPcmFjbGUgQWRkcmVzcwpTdG9yYWdlOiBJbnN0YW5jZQAAAA1PcmFjbGVBZGRyZXNzAAAAAAAAAAAAAE1NYXhpbXVtIGFnZSAoaW4gc2Vjb25kcykgYmVmb3JlIGEgcHJpY2UgaXMgY29uc2lkZXJlZCBzdGFsZQpTdG9yYWdlOiBJbnN0YW5jZQAAAAAAAAxPcmFjbGVNYXhBZ2UAAAAAAAAAPU1pbmltdW0gYWNjZXB0YWJsZSBub3JtYWxpemVkIHByaWNlIChmbG9vcikKU3RvcmFnZTogSW5zdGFuY2UAAAAAAAAOT3JhY2xlTWluUHJpY2UAAA==",
        "AAAAAQAAACRMZW5kaW5nIHBvb2wgY29uZmlndXJhdGlvbiBhbmQgc3RhdGUAAAAAAAAAC0xlbmRpbmdQb29sAAAAAAsAAAAbQXNzZXQgc3ltYm9sIChlLmcuLCAiVVNEQyIpAAAAAAVhc3NldAAAAAAAABAAAAAWQXNzZXQgY29udHJhY3QgYWRkcmVzcwAAAAAADWFzc2V0X2FkZHJlc3MAAAAAAAATAAAAUUNsb3NlIGZhY3RvciAtIG1heCAlIG9mIGRlYnQgbGlxdWlkYXRhYmxlIHBlciB0eCAoZS5nLiwgNTAlID0gNTAwMDAwMDAwMDAwMDAwMDAwKQAAAAAAAAxjbG9zZV9mYWN0b3IAAAALAAAAMkNvbGxhdGVyYWwgZmFjdG9yIChlLmcuLCA3NSUgPSA3NTAwMDAwMDAwMDAwMDAwMDApAAAAAAARY29sbGF0ZXJhbF9mYWN0b3IAAAAAAAALAAAAF1Bvb2wgY3JlYXRpb24gdGltZXN0YW1wAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAFlVuaXF1ZSBwb29sIGlkZW50aWZpZXIAAAAAAAJpZAAAAAAAEAAAABZXaGV0aGVyIHBvb2wgaXMgYWN0aXZlAAAAAAAJaXNfYWN0aXZlAAAAAAAAAQAAADJMaXF1aWRhdGlvbiBwZW5hbHR5IChlLmcuLCA1JSA9IDUwMDAwMDAwMDAwMDAwMDAwKQAAAAAAE2xpcXVpZGF0aW9uX3BlbmFsdHkAAAAACwAAADZMaXF1aWRhdGlvbiB0aHJlc2hvbGQgKGUuZy4sIDgwJSA9IDgwMDAwMDAwMDAwMDAwMDAwMCkAAAAAABVsaXF1aWRhdGlvbl90aHJlc2hvbGQAAAAAAAALAAAAEVBvb2wgZGlzcGxheSBuYW1lAAAAAAAABG5hbWUAAAAQAAAAMVJlc2VydmUgZmFjdG9yIGluIGJhc2lzIHBvaW50cyAoZS5nLiwgMTAwMCA9IDEwJSkAAAAAAAAOcmVzZXJ2ZV9mYWN0b3IAAAAAAAQ=",
        "AAAAAQAAABdMZW5kaW5nIHBvb2wgZXZlbnQgZGF0YQAAAAAAAAAADERlcG9zaXRFdmVudAAAAAMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAQ",
        "AAAAAQAAABNXaXRoZHJhdyBldmVudCBkYXRhAAAAAAAAAAANV2l0aGRyYXdFdmVudAAAAAAAAAMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAHcG9vbF9pZAAAAAAQ",
        "AAAAAQAAABdQb29sIGNyZWF0ZWQgZXZlbnQgZGF0YQAAAAAAAAAAEFBvb2xDcmVhdGVkRXZlbnQAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAB3Bvb2xfaWQAAAAAEA==",
        "AAAAAQAAAFVJbnRlcmVzdCByYXRlIG1vZGVsIHBhcmFtZXRlcnMKVXNlcyBsaW5lYXIgbW9kZWw6IHJhdGUgPSBiYXNlICsgKHV0aWxpemF0aW9uICogc2xvcGUpAAAAAAAAAAAAABFJbnRlcmVzdFJhdGVNb2RlbAAAAAAAAAQAAAA7QmFzZSByYXRlIChpbiBQUkVDSVNJT04gdW5pdHMsIGUuZy4sIDIlID0gMC4wMiAqIFBSRUNJU0lPTikAAAAACWJhc2VfcmF0ZQAAAAAAAAsAAAA2T3B0aW1hbCB1dGlsaXphdGlvbiByYXRlIChlLmcuLCA4MCUgPSAwLjggKiBQUkVDSVNJT04pAAAAAAATb3B0aW1hbF91dGlsaXphdGlvbgAAAAALAAAAH1Nsb3BlIGJlbG93IG9wdGltYWwgdXRpbGl6YXRpb24AAAAABnNsb3BlMQAAAAAACwAAAB9TbG9wZSBhYm92ZSBvcHRpbWFsIHV0aWxpemF0aW9uAAAAAAZzbG9wZTIAAAAAAAs=",
        "AAAAAQAAACRCb3Jyb3cgcG9zaXRpb24gZm9yIGEgdXNlciBpbiBhIHBvb2wAAAAAAAAADkJvcnJvd1Bvc2l0aW9uAAAAAAAHAAAAE1RpbWVzdGFtcCBvZiBib3Jyb3cAAAAAC2JvcnJvd2VkX2F0AAAAAAYAAAAQQm9ycm93ZXIgYWRkcmVzcwAAAAhib3Jyb3dlcgAAABMAAAARQ29sbGF0ZXJhbCBhbW91bnQAAAAAAAARY29sbGF0ZXJhbF9hbW91bnQAAAAAAAALAAAAGENvbGxhdGVyYWwgYXNzZXQgYWRkcmVzcwAAABBjb2xsYXRlcmFsX2Fzc2V0AAAAEwAAAB1JbnRlcmVzdCBpbmRleCBhdCBib3Jyb3cgdGltZQAAAAAAAA9pbmRleF9hdF9ib3Jyb3cAAAAACwAAAAdQb29sIElEAAAAAAdwb29sX2lkAAAAABAAAAASUHJpbmNpcGFsIGJvcnJvd2VkAAAAAAAJcHJpbmNpcGFsAAAAAAAACw==",
        "AAAAAQAAACVEZXBvc2l0IHBvc2l0aW9uIGZvciBhIHVzZXIgaW4gYSBwb29sAAAAAAAAAAAAAA9EZXBvc2l0UG9zaXRpb24AAAAABgAAACNEZXBvc2l0IGFtb3VudCBpbiB1bmRlcmx5aW5nIHRva2VucwAAAAAGYW1vdW50AAAAAAALAAAAFFRpbWVzdGFtcCBvZiBkZXBvc2l0AAAADGRlcG9zaXRlZF9hdAAAAAYAAAARRGVwb3NpdG9yIGFkZHJlc3MAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAB5JbnRlcmVzdCBpbmRleCBhdCBkZXBvc2l0IHRpbWUAAAAAABBpbmRleF9hdF9kZXBvc2l0AAAACwAAAAdQb29sIElEAAAAAAdwb29sX2lkAAAAABAAAAAoU2hhcmUgb2YgcG9vbCAoZm9yIGludGVyZXN0IGNhbGN1bGF0aW9uKQAAAAZzaGFyZXMAAAAAAAs=",
        "AAAAAgAAAOBTdG9yYWdlIGtleXMgZm9yIHRoZSBwcm9wZXJ0eSB0b2tlbml6YXRpb24gY29udHJhY3QKClRoaXMgZW51bSBkZWZpbmVzIHVuaXF1ZSBzdG9yYWdlIGtleXMgdG8gcHJldmVudCBjb2xsaXNpb25zIGFuZCBvcmdhbml6ZQpjb250cmFjdCBkYXRhIGVmZmljaWVudGx5LiBFYWNoIGtleSB0eXBlIGNvcnJlc3BvbmRzIHRvIGEgc3BlY2lmaWMgZGF0YQpzdHJ1Y3R1cmUgc3RvcmVkIG9uLWNoYWluLgAAAAAAAAAKU3RvcmFnZUtleQAAAAAACgAAAAAAAABJVG9rZW4gY29uZmlndXJhdGlvbiAoc3ltYm9sLCBuYW1lLCBkZWNpbWFscykKU2luZ2xlIGluc3RhbmNlIHBlciBjb250cmFjdAAAAAAAAAtUb2tlbkNvbmZpZwAAAAABAAAAS1Byb3BlcnR5IG1ldGFkYXRhIGluZGV4ZWQgYnkgcHJvcGVydHkgSUQKS2V5OiBQcm9wZXJ0eU1ldGFkYXRhKHByb3BlcnR5X2lkKQAAAAAIUHJvcGVydHkAAAABAAAABgAAAAEAAABfU2hhcmUgYmFsYW5jZSBmb3IgYSBzcGVjaWZpYyBhY2NvdW50IGFuZCBwcm9wZXJ0eQpLZXk6IFNoYXJlQmFsYW5jZShwcm9wZXJ0eV9pZCwgb3duZXJfYWRkcmVzcykAAAAADFNoYXJlQmFsYW5jZQAAAAIAAAAGAAAAEwAAAAEAAABAVG90YWwgc2hhcmVzIGlzc3VlZCBmb3IgYSBwcm9wZXJ0eQpLZXk6IFRvdGFsU2hhcmVzKHByb3BlcnR5X2lkKQAAAAtUb3RhbFNoYXJlcwAAAAABAAAABgAAAAAAAABDQWRtaW4gYWRkcmVzcyB3aXRoIHNwZWNpYWwgcGVybWlzc2lvbnMKU2luZ2xlIGluc3RhbmNlIHBlciBjb250cmFjdAAAAAAFQWRtaW4AAAAAAAAAAAAATVByb3BlcnR5IGNvdW50ZXIgdG8gZ2VuZXJhdGUgdW5pcXVlIHByb3BlcnR5IElEcwpTaW5nbGUgaW5zdGFuY2UgcGVyIGNvbnRyYWN0AAAAAAAAD1Byb3BlcnR5Q291bnRlcgAAAAABAAAAZEFsbG93YW5jZSB0cmFja2luZyBmb3IgYXBwcm92ZWQgc3BlbmRlcnMKS2V5OiBBbGxvd2FuY2UocHJvcGVydHlfaWQsIG93bmVyX2FkZHJlc3MsIHNwZW5kZXJfYWRkcmVzcykAAAAJQWxsb3dhbmNlAAAAAAAAAwAAAAYAAAATAAAAEwAAAAEAAABQQXZhaWxhYmxlIHNoYXJlcyBmb3IgYSBwcm9wZXJ0eSAodG90YWwgLSBzb2xkKQpLZXk6IEF2YWlsYWJsZVNoYXJlcyhwcm9wZXJ0eV9pZCkAAAAPQXZhaWxhYmxlU2hhcmVzAAAAAAEAAAAGAAAAAQAAAD5QcmljZSBwZXIgc2hhcmUgZm9yIGEgcHJvcGVydHkKS2V5OiBQcmljZVBlclNoYXJlKHByb3BlcnR5X2lkKQAAAAAADVByaWNlUGVyU2hhcmUAAAAAAAABAAAABgAAAAEAAABBVmVyaWZpZWQgc3RhdHVzIGZvciBhIHByb3BlcnR5CktleTogUHJvcGVydHlWZXJpZmllZChwcm9wZXJ0eV9pZCkAAAAAAAAQUHJvcGVydHlWZXJpZmllZAAAAAEAAAAG",
        "AAAAAQAAAO1Ub2tlbiBjb25maWd1cmF0aW9uIGZvciB0aGUgcHJvcGVydHkgdG9rZW5pemF0aW9uIGNvbnRyYWN0CgpUaGlzIHN0cnVjdHVyZSBzdG9yZXMgZ2xvYmFsIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSB0b2tlbiwgaW5jbHVkaW5nCm1ldGFkYXRhIGxpa2Ugc3ltYm9sLCBuYW1lLCBhbmQgYWRtaW4gc2V0dGluZ3MuIFN0b3JhZ2UgaXMgb3B0aW1pemVkCmJ5IHVzaW5nIGEgc2luZ2xlIGluc3RhbmNlIHBlciBjb250cmFjdC4AAAAAAAAAAAAAC1Rva2VuQ29uZmlnAAAAAAUAAAAmQWRtaW4gYWRkcmVzcyB3aXRoIHNwZWNpYWwgcGVybWlzc2lvbnMAAAAAAAVhZG1pbgAAAAAAABMAAAAyTnVtYmVyIG9mIGRlY2ltYWwgcGxhY2VzICh0eXBpY2FsbHkgNyBmb3IgU29yb2JhbikAAAAAAAhkZWNpbWFscwAAAAQAAAAjV2hldGhlciB0aGUgY29udHJhY3QgaXMgaW5pdGlhbGl6ZWQAAAAAC2luaXRpYWxpemVkAAAAAAEAAAAjVG9rZW4gbmFtZSAoZS5nLiwgIlByb3BlcnR5IFRva2VuIikAAAAABG5hbWUAAAAQAAAAG1Rva2VuIHN5bWJvbCAoZS5nLiwgIlBSUFQiKQAAAAAGc3ltYm9sAAAAAAAQ",
        "AAAAAQAAAMJQcm9wZXJ0eSBtZXRhZGF0YSBzdG9yZWQgb24tY2hhaW4KClRoaXMgc3RydWN0dXJlIGNvbnRhaW5zIGFsbCBlc3NlbnRpYWwgaW5mb3JtYXRpb24gYWJvdXQgYSB0b2tlbml6ZWQgcHJvcGVydHkuCkZpZWxkcyBhcmUgb3B0aW1pemVkIGZvciBzdG9yYWdlIGNvc3Qgd2hpbGUgbWFpbnRhaW5pbmcgbmVjZXNzYXJ5IGRhdGEgaW50ZWdyaXR5LgAAAAAAAAAAABBQcm9wZXJ0eU1ldGFkYXRhAAAACQAAACpUaW1lc3RhbXAgd2hlbiB0aGUgcHJvcGVydHkgd2FzIHJlZ2lzdGVyZWQAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAJERldGFpbGVkIGRlc2NyaXB0aW9uIG9mIHRoZSBwcm9wZXJ0eQAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAKldoZXRoZXIgdGhlIHByb3BlcnR5IGlzIGFjdGl2ZSBmb3IgdHJhZGluZwAAAAAACWlzX2FjdGl2ZQAAAAAAAAEAAAAcUGh5c2ljYWwgbG9jYXRpb24gb3IgYWRkcmVzcwAAAAhsb2NhdGlvbgAAABAAAAAWUHJvcGVydHkgbmFtZSBvciB0aXRsZQAAAAAABG5hbWUAAAAQAAAAJUFkZHJlc3Mgb2YgdGhlIHByb3BlcnR5IG93bmVyL2NyZWF0b3IAAAAAAAAFb3duZXIAAAAAAAATAAAAIlVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgcHJvcGVydHkAAAAAAAtwcm9wZXJ0eV9pZAAAAAAGAAAAMlRvdGFsIG51bWJlciBvZiBzaGFyZXMgYXZhaWxhYmxlIGZvciB0aGlzIHByb3BlcnR5AAAAAAAMdG90YWxfc2hhcmVzAAAABgAAACZUb3RhbCB2YWx1YXRpb24gaW4gYmFzZSBjdXJyZW5jeSB1bml0cwAAAAAACXZhbHVhdGlvbgAAAAAAAAs=",
        "AAAAAgAAAApBc3NldCB0eXBlAAAAAAAAAAAABUFzc2V0AAAAAAAAAgAAAAEAAAAAAAAAB1N0ZWxsYXIAAAAAAQAAABMAAAABAAAAAAAAAAVPdGhlcgAAAAAAAAEAAAAR",
        "AAAAAQAAAC9QcmljZSBkYXRhIGZvciBhbiBhc3NldCBhdCBhIHNwZWNpZmljIHRpbWVzdGFtcAAAAAAAAAAACVByaWNlRGF0YQAAAAAAAAIAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    repay: this.txFromJSON<Result<BorrowPosition>>,
    borrow: this.txFromJSON<Result<BorrowPosition>>,
    approve: this.txFromJSON<null>,
    deposit: this.txFromJSON<Result<void>>,
    get_pool: this.txFromJSON<LendingPool>,
    withdraw: this.txFromJSON<Result<void>>,
    set_oracle: this.txFromJSON<null>,
    burn_shares: this.txFromJSON<null>,
    create_pool: this.txFromJSON<null>,
    get_balance: this.txFromJSON<u64>,
    mint_shares: this.txFromJSON<null>,
    get_allowance: this.txFromJSON<u64>,
    transfer_from: this.txFromJSON<null>,
    accrue_interest: this.txFromJSON<Result<void>>,
    cancel_recovery: this.txFromJSON<null>,
    emergency_pause: this.txFromJSON<null>,
    purchase_shares: this.txFromJSON<null>,
    transfer_shares: this.txFromJSON<null>,
    execute_recovery: this.txFromJSON<null>,
    get_total_shares: this.txFromJSON<u64>,
    get_user_borrows: this.txFromJSON<Array<string>>,
    get_oracle_config: this.txFromJSON<readonly [u64, i128]>,
    get_total_borrows: this.txFromJSON<i128>,
    get_user_deposits: this.txFromJSON<Array<string>>,
    schedule_recovery: this.txFromJSON<null>,
    set_oracle_config: this.txFromJSON<null>,
    get_interest_index: this.txFromJSON<i128>,
    get_total_deposits: this.txFromJSON<i128>,
    get_borrow_position: this.txFromJSON<BorrowPosition>,
    get_deposit_position: this.txFromJSON<DepositPosition>,
    grant_emergency_role: this.txFromJSON<null>,
    revoke_emergency_role: this.txFromJSON<null>,
    list_property: this.txFromJSON<null>,
    set_property_active: this.txFromJSON<null>,
    liquidate: this.txFromJSON<Result<BorrowPosition>>,
    set_close_factor: this.txFromJSON<null>,
    get_health_factor: this.txFromJSON<Result<i128>>,
    pause_pool: this.txFromJSON<null>,
    unpause_pool: this.txFromJSON<null>,
  };
}
