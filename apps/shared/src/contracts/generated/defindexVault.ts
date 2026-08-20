/**
 * TypeScript bindings for the DeFindex Vault contract.
 *
 * GENERATED FILE — do not edit by hand. Produced with:
 *
 *   stellar contract bindings typescript \
 *     --network testnet \
 *     --contract-id CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN \
 *     --output-dir <tmp>
 *
 * The spec below is downloaded from the WASM of the DeFindex USDC/Blend vault
 * deployed on Stellar testnet, so the interface here is the interface the
 * deployed contract actually exposes — not a transcription of documentation.
 * The same vault WASM backs the CETES (Etherfuse Stablebond) vault, so one set
 * of bindings covers both treasury venues.
 *
 * Upstream source: https://github.com/paltalabs/defindex
 * Deployment registry: https://github.com/defindex-io/stellar-contracts/blob/main/public/testnet.contracts.json
 *
 * Only the header imports were adjusted from the CLI output, to drop the
 * wildcard `@stellar/stellar-sdk` re-exports that would otherwise leak into
 * this package's public API.
 */
import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";

const browserWindow = globalThis as typeof globalThis & {
  window?: { Buffer?: typeof Buffer };
};

if (browserWindow.window) {
  browserWindow.window.Buffer = browserWindow.window.Buffer || Buffer;
}

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN",
  },
} as const;

export const ContractError = {
  100: { message: "NotInitialized" },
  101: { message: "InvalidRatio" },
  102: { message: "StrategyDoesNotSupportAsset" },
  103: { message: "NoAssetAllocation" },
  104: { message: "RolesIncomplete" },
  105: { message: "MetadataIncomplete" },
  106: { message: "MaximumFeeExceeded" },
  107: { message: "DuplicatedAsset" },
  108: { message: "DuplicatedStrategy" },
  110: { message: "AmountNotAllowed" },
  111: { message: "InsufficientBalance" },
  112: { message: "WrongAmountsLength" },
  113: { message: "WrongLockedFees" },
  114: { message: "InsufficientManagedFunds" },
  115: { message: "MissingInstructionData" },
  116: { message: "UnsupportedAsset" },
  117: { message: "InsufficientAmount" },
  118: { message: "NoOptimalAmounts" },
  119: { message: "WrongInvestmentLength" },
  122: { message: "WrongAssetAddress" },
  123: { message: "WrongStrategiesLength" },
  124: { message: "AmountOverTotalSupply" },
  125: { message: "NoInstructions" },
  126: { message: "NotUpgradable" },
  128: { message: "UnwindMoreThanAvailable" },
  129: { message: "InsufficientFeesToRelease" },
  120: { message: "ArithmeticError" },
  121: { message: "Overflow" },
  127: { message: "Underflow" },
  130: { message: "Unauthorized" },
  131: { message: "RoleNotFound" },
  132: { message: "ManagerNotInQueue" },
  133: { message: "SetManagerBeforeTime" },
  134: { message: "QueueEmpty" },
  140: { message: "StrategyNotFound" },
  141: { message: "StrategyPausedOrNotFound" },
  142: { message: "StrategyWithdrawError" },
  143: { message: "StrategyInvestError" },
  144: { message: "StrategyPaused" },
  150: { message: "AssetNotFound" },
  151: { message: "NoAssetsProvided" },
  160: { message: "InsufficientOutputAmount" },
  161: { message: "ExcessiveInputAmount" },
  162: { message: "InvalidFeeBps" },
  190: { message: "LibrarySortIdenticalTokens" },
  200: { message: "SoroswapRouterError" },
  201: { message: "SwapExactInError" },
  202: { message: "SwapExactOutError" },
};

export type DataKey =
  | { tag: "Allowance"; values: readonly [AllowanceDataKey] }
  | { tag: "Balance"; values: readonly [string] }
  | { tag: "TotalSupply"; values: void };

export interface AllowanceValue {
  amount: i128;
  expiration_ledger: u32;
}

export interface AllowanceDataKey {
  from: string;
  spender: string;
}

export type RolesDataKey =
  | { tag: "EmergencyManager"; values: void }
  | { tag: "VaultFeeReceiver"; values: void }
  | { tag: "Manager"; values: void }
  | { tag: "RebalanceManager"; values: void };

export interface InvestEvent {
  asset_investments: Array<AssetInvestmentAllocation>;
  rebalance_method: string;
  report: Report;
}

export interface UnwindEvent {
  call_params: Array<readonly [string, i128, string]>;
  rebalance_method: string;
  report: Report;
}

export interface SwapExactInEvent {
  rebalance_method: string;
  swap_args: Array<any>;
}

export interface SwapExactOutEvent {
  rebalance_method: string;
  swap_args: Array<any>;
}

export interface VaultDepositEvent {
  amounts: Array<i128>;
  depositor: string;
  df_tokens_minted: i128;
  total_managed_funds_before: Array<CurrentAssetInvestmentAllocation>;
  total_supply_before: i128;
}

export interface VaultWithdrawEvent {
  amounts_withdrawn: Array<i128>;
  df_tokens_burned: i128;
  total_managed_funds_before: Array<CurrentAssetInvestmentAllocation>;
  total_supply_before: i128;
  withdrawer: string;
}

export interface ManagerChangedEvent {
  new_manager: string;
}

export interface StrategyPausedEvent {
  caller: string;
  strategy_address: string;
}

export interface FeesDistributedEvent {
  distributed_fees: Array<readonly [string, i128]>;
}

export interface StrategyUnpausedEvent {
  caller: string;
  strategy_address: string;
}

export interface EmergencyWithdrawEvent {
  amount_withdrawn: i128;
  caller: string;
  strategy_address: string;
}

export interface FeeReceiverChangedEvent {
  caller: string;
  new_fee_receiver: string;
}

export interface EmergencyManagerChangedEvent {
  new_emergency_manager: string;
}

export interface RebalanceManagerChangedEvent {
  new_rebalance_manager: string;
}

export type Instruction =
  | { tag: "Unwind"; values: readonly [string, i128] }
  | { tag: "Invest"; values: readonly [string, i128] }
  | { tag: "SwapExactIn"; values: readonly [string, string, i128, i128, u64] }
  | { tag: "SwapExactOut"; values: readonly [string, string, i128, i128, u64] };

export interface StrategyAllocation {
  amount: i128;
  paused: boolean;
  strategy_address: string;
}

export interface AssetInvestmentAllocation {
  asset: string;
  strategy_allocations: Array<Option<StrategyAllocation>>;
}

export interface CurrentAssetInvestmentAllocation {
  asset: string;
  idle_amount: i128;
  invested_amount: i128;
  strategy_allocations: Array<StrategyAllocation>;
  total_amount: i128;
}

export interface Report {
  gains_or_losses: i128;
  locked_fee: i128;
  prev_balance: i128;
}

export interface Strategy {
  address: string;
  name: string;
  paused: boolean;
}

export interface AssetStrategySet {
  address: string;
  strategies: Array<Strategy>;
}

export const StrategyError = {
  401: { message: "NotInitialized" },
  410: { message: "NegativeNotAllowed" },
  411: { message: "InvalidArgument" },
  412: { message: "InsufficientBalance" },
  413: { message: "UnderflowOverflow" },
  414: { message: "ArithmeticError" },
  415: { message: "DivisionByZero" },
  416: { message: "InvalidSharesMinted" },
  417: { message: "OnlyPositiveAmountAllowed" },
  418: { message: "NotAuthorized" },
  420: { message: "ProtocolAddressNotFound" },
  421: { message: "DeadlineExpired" },
  422: { message: "ExternalError" },
  423: { message: "SoroswapPairError" },
  451: { message: "AmountBelowMinDust" },
  452: { message: "UnderlyingAmountBelowMin" },
  453: { message: "BTokensAmountBelowMin" },
  454: { message: "InternalSwapError" },
  455: { message: "SupplyNotFound" },
};

export interface DepositEvent {
  amount: i128;
  from: string;
}

export interface HarvestEvent {
  amount: i128;
  from: string;
  price_per_share: i128;
}

export interface WithdrawEvent {
  amount: i128;
  from: string;
}

export interface TokenMetadata {
  decimal: u32;
  name: string;
  symbol: string;
}

export const SoroswapLibraryError = {
  /**
   * SoroswapLibrary: insufficient amount
   */
  301: { message: "InsufficientAmount" },
  /**
   * SoroswapLibrary: insufficient liquidity
   */
  302: { message: "InsufficientLiquidity" },
  /**
   * SoroswapLibrary: insufficient input amount
   */
  303: { message: "InsufficientInputAmount" },
  /**
   * SoroswapLibrary: insufficient output amount
   */
  304: { message: "InsufficientOutputAmount" },
  /**
   * SoroswapLibrary: invalid path
   */
  305: { message: "InvalidPath" },
  /**
   * SoroswapLibrary: token_a and token_b have identical addresses
   */
  306: { message: "SortIdenticalTokens" },
};

export interface Client {
  /**
   * Construct and simulate a report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Generates reports for all strategies in the vault, tracking their performance and fee accrual.
   *
   * This function iterates through all assets and their associated strategies to generate
   * performance reports. It updates each strategy's report with current balances and
   * calculates gains or losses since the last report.
   *
   * # Arguments
   * * `e` - The environment reference.
   *
   * # Function Flow
   * 1. **Instance Extension**:
   * - Extends contract TTL
   *
   * 2. **Asset & Strategy Retrieval**:
   * - Gets all assets and their strategies
   * - Initializes reports vector
   *
   * 3. **Report Generation**:
   * - For each asset:
   * - For each strategy:
   * - Gets current strategy balance
   * - Updates report with new balance
   * - Stores updated report
   *
   * # Returns
   * * `Result<Vec<Report>, ContractError>` - On success, returns a vector of reports
   * where each report contains performance metrics for a strategy. Returns
   * ContractError if report generation fails.
   *
   * # Note
   * Reports track:
   * - Current strategy balance
   * - Gains or losses since last report
   * - Locked fees
   * - Fee distribution status
   */
  report: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Array<Report>>>>;

  /**
   * Construct and simulate a rescue transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Executes rescue (formerly emergency withdrawal) from a specific strategy.
   *
   * This function allows the emergency manager or manager to withdraw all assets from a particular strategy
   * and store them as idle funds within the vault. It also pauses the strategy to prevent further use until
   * unpaused.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `strategy_address` - The address of the strategy to withdraw from.
   * * `caller` - The address initiating the emergency withdrawal (must be the manager or emergency manager).
   *
   * # Returns
   * * `Result<(), ContractError>` - Success (()) or ContractError if the rescue operation fails
   */
  rescue: (
    { strategy_address, caller }: { strategy_address: string; caller: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Handles user deposits into the DeFindex Vault and optionally allocates investments automatically.
   *
   * This function processes a deposit by transferring each specified asset amount from the user's address to
   * the vault and mints vault shares that represent the user's proportional share in the vault. Additionally,
   * if the `invest` parameter is set to `true`, the function will immediately generate and execute investment
   * allocations based on the vault's strategy configuration.
   *
   * # Parameters
   * * `e` - The current environment reference (`Env`), for access to the contract state and utilities.
   * * `amounts_desired` - A vector specifying the user's intended deposit amounts for each asset.
   * * `amounts_min` - A vector of minimum deposit amounts required for the transaction to proceed.
   * * `from` - The address of the user making the deposit.
   * * `invest` - A boolean flag indicating whether to immediately invest the deposited funds into the vault's strategies:
   * - `true`: Generate and execute investments after the deposit.
   * - `false`: Lea
   */
  deposit: (
    {
      amounts_desired,
      amounts_min,
      from,
      invest,
    }: {
      amounts_desired: Array<i128>;
      amounts_min: Array<i128>;
      from: string;
      invest: boolean;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<
    AssembledTransaction<
      Result<
        readonly [
          Array<i128>,
          i128,
          Option<Array<Option<AssetInvestmentAllocation>>>,
        ]
      >
    >
  >;

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrades the contract with new WebAssembly (WASM) code.
   *
   * This function updates the contract with new WASM code provided by the `new_wasm_hash`.
   *
   * # Arguments
   *
   * * `e` - The runtime environment.
   * * `new_wasm_hash` - The hash of the new WASM code to upgrade the contract to.
   *
   * # Returns
   * * `Result<(), ContractError>` - Returns Ok(()) on success, ContractError if upgrade fails
   *
   */
  upgrade: (
    { new_wasm_hash }: { new_wasm_hash: Buffer },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieves the current fee rates for the vault and the DeFindex protocol.
   *
   * This function returns the fee rates for both the vault and the DeFindex protocol.
   *
   * # Arguments
   * * `e` - The environment.
   *
   * # Returns
   * * `(u32, u32)` - A tuple containing:
   * - The vault fee rate as a percentage in basis points.
   * - The DeFindex protocol fee rate as a percentage in basis points.
   *
   */
  get_fees: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<readonly [u32, u32]>>;

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Handles user withdrawals from the DeFindex Vault by burning shares and returning assets.
   *
   * This function processes a withdrawal request by burning the specified amount of vault shares
   * and returning a proportional amount of the vault's assets to the user. It can unwind positions
   * from strategies if necessary to fulfill the withdrawal.
   *
   * ## Parameters:
   * - `e`: The contract environment (`Env`).
   * - `withdraw_shares`: The number of vault shares to withdraw.
   * - `min_amounts_out`: A vector of minimum amounts required for each asset to be withdrawn.
   * - `from`: The address initiating the withdrawal.
   *
   * ## Returns
   * * `Result<Vec<i128>, ContractError>` - On success, returns a vector of withdrawn amounts
   * where each index corresponds to the asset index in the vault's asset list.
   * Returns ContractError if the withdrawal fails.
   *
   * ## Errors:
   * - `ContractError::AmountOverTotalSupply`: If the specified shares exceed the total supply.
   * - `ContractError::ArithmeticError`: If any arithmetic operation fails during calculations.
   * - `ContractError
   */
  withdraw: (
    {
      withdraw_shares,
      min_amounts_out,
      from,
    }: { withdraw_shares: i128; min_amounts_out: Array<i128>; from: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Array<i128>>>>;

  /**
   * Construct and simulate a lock_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Locks fees for all assets and their strategies.
   *
   * Iterates through each asset and its strategies, locking fees based on `new_fee_bps` or the default vault fee.
   *
   * # Arguments
   * * `e` - The environment reference.
   * * `new_fee_bps` - Optional fee basis points to override the default.
   *
   * # Returns
   * * `Result<Vec<(Address, i128)>, ContractError>` - A vector of tuples with strategy addresses and locked fee amounts in their underlying_asset.
   */
  lock_fees: (
    { new_fee_bps }: { new_fee_bps: Option<u32> },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Array<Report>>>>;

  /**
   * Construct and simulate a rebalance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rebalances the vault by executing a series of instructions.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `instructions` - A vector of `Instruction` structs representing actions (withdraw, invest, swap, zapper) to be taken.
   *
   * # Returns:
   * * `Result<(), ContractError>` - Ok if successful, otherwise returns a ContractError.
   */
  rebalance: (
    {
      caller,
      instructions,
    }: { caller: string; instructions: Array<Instruction> },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieves the list of assets managed by the DeFindex Vault.
   *
   * # Arguments:
   * * `e` - The environment.
   *
   * # Returns:
   * * `Vec<AssetStrategySet>` - A vector of `AssetStrategySet` structs representing the assets managed by the vault.
   */
  get_assets: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Array<AssetStrategySet>>>>;

  /**
   * Construct and simulate a get_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieves the current manager address for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   *
   * # Returns:
   * * `Result<Address, ContractError>` - The manager address if successful, otherwise returns a ContractError.
   */
  get_manager: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a set_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the manager for the vault.
   *
   * This function allows the current manager to set a new manager for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `new_manager` - The new manager address.
   *
   * # Returns
   * * `Result<(), ContractError>` - Success (()) or ContractError if the manager change fails
   */
  set_manager: (
    { new_manager }: { new_manager: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a release_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Releases locked fees for a specific strategy.
   *
   * # Arguments
   * * `e` - The environment reference.
   * * `strategy` - The address of the strategy for which to release fees.
   * * `amount` - The amount of fees to release.
   *
   * # Returns
   * * `Result<Report, ContractError>` - A report of the released fees or a `ContractError` if the operation fails.
   */
  release_fees: (
    { strategy, amount }: { strategy: string; amount: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Report>>>;

  /**
   * Construct and simulate a pause_strategy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pauses a strategy to prevent it from being used in the vault.
   *
   * This function pauses a strategy by setting its `paused` field to `true`. Only the manager or emergency
   * manager can pause a strategy.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `strategy_address` - The address of the strategy to pause.
   * * `caller` - The address initiating the pause (must be the manager or emergency manager).
   *
   * # Returns
   * * `Result<(), ContractError>` - Success (()) or ContractError if the pause operation fails
   */
  pause_strategy: (
    { strategy_address, caller }: { strategy_address: string; caller: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a distribute_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Distributes the locked fees for all assets and their strategies.
   *
   * This function iterates through each asset and its strategies, calculating the fees to be distributed
   * to the vault fee receiver and the DeFindex protocol fee receiver based on their respective fee rates.
   * It ensures proper authorization and validation checks before proceeding with the distribution.
   *
   * # Arguments
   * * `e` - The environment reference.
   * * `caller` - The address initiating the fee distribution.
   *
   * # Returns
   * * `Result<Vec<(Address, i128)>, ContractError>` - A vector of tuples with asset addresses and the total distributed fee amounts.
   */
  distribute_fees: (
    { caller }: { caller: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Array<readonly [string, i128]>>>>;

  /**
   * Construct and simulate a get_fee_receiver transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieves the current fee receiver address for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   *
   * # Returns:
   * * `Result<Address, ContractError>` - The fee receiver address if successful, otherwise returns a ContractError.
   */
  get_fee_receiver: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a set_fee_receiver transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the fee receiver for the vault.
   *
   * This function allows the manager or the vault fee receiver to set a new fee receiver address for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `caller` - The address initiating the change (must be the manager or the vault fee receiver).
   * * `vault_fee_receiver` - The new fee receiver address.
   *
   * # Returns:
   * * `()` - No return value.
   */
  set_fee_receiver: (
    { caller, new_fee_receiver }: { caller: string; new_fee_receiver: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a unpause_strategy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unpauses a previously paused strategy.
   *
   * This function unpauses a strategy by setting its `paused` field to `false`, allowing it to be used
   * again in the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `strategy_address` - The address of the strategy to unpause.
   * * `caller` - The address initiating the unpause (must be the manager or emergency manager).
   *
   * # Returns:
   * * `Result<(), ContractError>` - Ok if successful, otherwise returns a ContractError.
   */
  unpause_strategy: (
    { strategy_address, caller }: { strategy_address: string; caller: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_emergency_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieves the current emergency manager address for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   *
   * # Returns:
   * * `Result<Address, ContractError>` - The emergency manager address if successful, otherwise returns a ContractError.
   */
  get_emergency_manager: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a get_rebalance_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Retrieves the current rebalance manager address for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   *
   * # Returns:
   * * `Result<Address, ContractError>` - The rebalance manager address if successful, otherwise returns a ContractError.
   */
  get_rebalance_manager: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a set_emergency_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the emergency manager for the vault.
   *
   * This function allows the current manager to set a new emergency manager for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `emergency_manager` - The new emergency manager address.
   *
   * # Returns:
   * * `()` - No return value.
   */
  set_emergency_manager: (
    { emergency_manager }: { emergency_manager: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_rebalance_manager transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets the rebalance manager for the vault.
   *
   * This function allows the current manager to set a new rebalance manager for the vault.
   *
   * # Arguments:
   * * `e` - The environment.
   * * `new_rebalance_manager` - The new rebalance manager address.
   *
   * # Returns:
   * * `()` - No return value.
   */
  set_rebalance_manager: (
    { new_rebalance_manager }: { new_rebalance_manager: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a fetch_total_managed_funds transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total managed funds of the vault, including both invested and idle funds.
   *
   * This function provides a vector of `CurrentAssetInvestmentAllocation` structs containing information
   * about each asset's current allocation, including both invested amounts in strategies and idle amounts.
   *
   * # Arguments:
   * * `e` - The environment.
   *
   * # Returns:
   * * `Result<Vec<CurrentAssetInvestmentAllocation>, ContractError>` - A vector of asset allocations or error
   */
  fetch_total_managed_funds: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<
    AssembledTransaction<Result<Array<CurrentAssetInvestmentAllocation>>>
  >;

  /**
   * Construct and simulate a get_asset_amounts_per_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * This function extends the contract's time-to-live and calculates how much of each asset corresponds
   * per the provided number of vault shares (`vault_shares`). It provides proportional allocations for each asset
   * in the vault relative to the specified shares.
   *
   * # Arguments
   * * `e` - The current environment reference.
   * * `vault_shares` - The number of vault shares for which the corresponding asset amounts are calculated.
   *
   * # Returns
   * * `Result<Vec<i128>, ContractError>` - A vector of asset amounts corresponding to the vault shares, where each index
   * matches the asset index in the vault's asset list. Returns ContractError if calculation fails.
   */
  get_asset_amounts_per_shares: (
    { vault_shares }: { vault_shares: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Array<i128>>>>;

  /**
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn: (
    { from, amount }: { from: string; amount: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  name: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve: (
    {
      from,
      spender,
      amount,
      expiration_ledger,
    }: { from: string; spender: string; amount: i128; expiration_ledger: u32 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: (
    { id }: { id: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  decimals: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer: (
    { from, to, amount }: { from: string; to: string; amount: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  allowance: (
    { from, spender }: { from: string; spender: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a burn_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn_from: (
    { spender, from, amount }: { spender: string; from: string; amount: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a total_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  total_supply: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_from: (
    {
      spender,
      from,
      to,
      amount,
    }: { spender: string; from: string; to: string; amount: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a quote transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset.
   *
   * # Arguments
   *
   * * `amount_a` - The amount of the first asset.
   * * `reserve_a` - Reserves of the first asset in the pair.
   * * `reserve_b` - Reserves of the second asset in the pair.
   *
   * # Returns
   *
   * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the calculated equivalent amount, and `Err` indicates an error such as insufficient amount or liquidity
   */
  quote: (
    {
      amount_a,
      reserve_a,
      reserve_b,
    }: { amount_a: i128; reserve_a: i128; reserve_b: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a pair_for transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculates the deterministic address for a pair without making any external calls.
   * check <https://github.com/paltalabs/deterministic-address-soroban>
   *
   * # Arguments
   *
   * * `e` - The environment.
   * * `factory` - The factory address.
   * * `token_a` - The address of the first token.
   * * `token_b` - The address of the second token.
   *
   * # Returns
   *
   * Returns `Result<Address, SoroswapLibraryError>` where `Ok` contains the deterministic address for the pair, and `Err` indicates an error such as identical tokens or an issue with sorting.
   */
  pair_for: (
    {
      factory,
      token_a,
      token_b,
    }: { factory: string; token_a: string; token_b: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a sort_tokens transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sorts two token addresses in a consistent order.
   *
   * # Arguments
   *
   * * `token_a` - The address of the first token.
   * * `token_b` - The address of the second token.
   *
   * # Returns
   *
   * Returns `Result<(Address, Address), SoroswapLibraryError>` where `Ok` contains a tuple with the sorted token addresses, and `Err` indicates an error such as identical tokens.
   */
  sort_tokens: (
    { token_a, token_b }: { token_a: string; token_b: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<readonly [string, string]>>>;

  /**
   * Construct and simulate a get_amount_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Given an output amount of an asset and pair reserves, returns a required input amount of the other asset.
   *
   * # Arguments
   *
   * * `amount_out` - The output amount of the asset.
   * * `reserve_in` - Reserves of the input asset in the pair.
   * * `reserve_out` - Reserves of the output asset in the pair.
   *
   * # Returns
   *
   * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the required input amount, and `Err` indicates an error such as insufficient output amount or liquidity.
   */
  get_amount_in: (
    {
      amount_out,
      reserve_in,
      reserve_out,
    }: { amount_out: i128; reserve_in: i128; reserve_out: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a get_amounts_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Performs chained get_amount_in calculations on any number of pairs.
   *
   * # Arguments
   *
   * * `e` - The environment.
   * * `factory` - The factory address.
   * * `amount_out` - The output amount.
   * * `path` - Vector of token addresses representing the path.
   *
   * # Returns
   *
   * Returns `Result<Vec<i128>, SoroswapLibraryError>` where `Ok` contains a vector of calculated amounts, and `Err` indicates an error such as an invalid path.
   */
  get_amounts_in: (
    {
      factory,
      amount_out,
      path,
    }: { factory: string; amount_out: i128; path: Array<string> },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Array<i128>>>>;

  /**
   * Construct and simulate a get_amount_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset.
   *
   * # Arguments
   *
   * * `amount_in` - The input amount of the asset.
   * * `reserve_in` - Reserves of the input asset in the pair.
   * * `reserve_out` - Reserves of the output asset in the pair.
   *
   * # Returns
   *
   * Returns `Result<i128, SoroswapLibraryError>` where `Ok` contains the calculated maximum output amount, and `Err` indicates an error such as insufficient input amount or liquidity.
   */
  get_amount_out: (
    {
      amount_in,
      reserve_in,
      reserve_out,
    }: { amount_in: i128; reserve_in: i128; reserve_out: i128 },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a get_amounts_out transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Performs chained get_amount_out calculations on any number of pairs.
   *
   * # Arguments
   *
   * * `e` - The environment.
   * * `factory` - The factory address.
   * * `amount_in` - The input amount.
   * * `path` - Vector of token addresses representing the path.
   *
   * # Returns
   *
   * Returns `Result<Vec<i128>, SoroswapLibraryError>` where `Ok` contains a vector of calculated amounts, and `Err` indicates an error such as an invalid path.
   */
  get_amounts_out: (
    {
      factory,
      amount_in,
      path,
    }: { factory: string; amount_in: i128; path: Array<string> },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<Array<i128>>>>;

  /**
   * Construct and simulate a get_reserves_with_pair transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fetches and sorts the reserves for a pair of tokens using the pair address.
   *
   * # Arguments
   *
   * * `e` - The environment.
   * * `pair` - The pair address.
   * * `token_a` - The address of the first token.
   * * `token_b` - The address of the second token.
   *
   * # Returns
   *
   * Returns `Result<(i128, i128), SoroswapLibraryError>` where `Ok` contains a tuple of sorted reserves, and `Err` indicates an error such as identical tokens or an issue with sorting.
   */
  get_reserves_with_pair: (
    {
      pair,
      token_a,
      token_b,
    }: { pair: string; token_a: string; token_b: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>;

  /**
   * Construct and simulate a get_reserves_with_factory transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fetches and sorts the reserves for a pair of tokens using the factory address.
   *
   * # Arguments
   *
   * * `e` - The environment.
   * * `factory` - The factory address.
   * * `token_a` - The address of the first token.
   * * `token_b` - The address of the second token.
   *
   * # Returns
   *
   * Returns `Result<(i128, i128), SoroswapLibraryError>` where `Ok` contains a tuple of sorted reserves, and `Err` indicates an error such as identical tokens or an issue with sorting.
   */
  get_reserves_with_factory: (
    {
      factory,
      token_a,
      token_b,
    }: { factory: string; token_a: string; token_b: string },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;

      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;

      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>;
}
export class Client extends ContractClient {
  static override async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      assets,
      roles,
      vault_fee,
      defindex_protocol_receiver,
      defindex_protocol_rate,
      soroswap_router,
      name_symbol,
      upgradable,
    }: {
      assets: Array<AssetStrategySet>;
      roles: Map<u32, string>;
      vault_fee: u32;
      defindex_protocol_receiver: string;
      defindex_protocol_rate: u32;
      soroswap_router: string;
      name_symbol: Map<string, string>;
      upgradable: boolean;
    },
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
    return ContractClient.deploy(
      {
        assets,
        roles,
        vault_fee,
        defindex_protocol_receiver,
        defindex_protocol_rate,
        soroswap_router,
        name_symbol,
        upgradable,
      },
      options,
    );
  }
  constructor(public override readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAAAAA/pHZW5lcmF0ZXMgcmVwb3J0cyBmb3IgYWxsIHN0cmF0ZWdpZXMgaW4gdGhlIHZhdWx0LCB0cmFja2luZyB0aGVpciBwZXJmb3JtYW5jZSBhbmQgZmVlIGFjY3J1YWwuCgpUaGlzIGZ1bmN0aW9uIGl0ZXJhdGVzIHRocm91Z2ggYWxsIGFzc2V0cyBhbmQgdGhlaXIgYXNzb2NpYXRlZCBzdHJhdGVnaWVzIHRvIGdlbmVyYXRlCnBlcmZvcm1hbmNlIHJlcG9ydHMuIEl0IHVwZGF0ZXMgZWFjaCBzdHJhdGVneSdzIHJlcG9ydCB3aXRoIGN1cnJlbnQgYmFsYW5jZXMgYW5kCmNhbGN1bGF0ZXMgZ2FpbnMgb3IgbG9zc2VzIHNpbmNlIHRoZSBsYXN0IHJlcG9ydC4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIGVudmlyb25tZW50IHJlZmVyZW5jZS4KCiMgRnVuY3Rpb24gRmxvdwoxLiAqKkluc3RhbmNlIEV4dGVuc2lvbioqOgotIEV4dGVuZHMgY29udHJhY3QgVFRMCgoyLiAqKkFzc2V0ICYgU3RyYXRlZ3kgUmV0cmlldmFsKio6Ci0gR2V0cyBhbGwgYXNzZXRzIGFuZCB0aGVpciBzdHJhdGVnaWVzCi0gSW5pdGlhbGl6ZXMgcmVwb3J0cyB2ZWN0b3IKCjMuICoqUmVwb3J0IEdlbmVyYXRpb24qKjoKLSBGb3IgZWFjaCBhc3NldDoKLSBGb3IgZWFjaCBzdHJhdGVneToKLSBHZXRzIGN1cnJlbnQgc3RyYXRlZ3kgYmFsYW5jZQotIFVwZGF0ZXMgcmVwb3J0IHdpdGggbmV3IGJhbGFuY2UKLSBTdG9yZXMgdXBkYXRlZCByZXBvcnQKCiMgUmV0dXJucwoqIGBSZXN1bHQ8VmVjPFJlcG9ydD4sIENvbnRyYWN0RXJyb3I+YCAtIE9uIHN1Y2Nlc3MsIHJldHVybnMgYSB2ZWN0b3Igb2YgcmVwb3J0cwp3aGVyZSBlYWNoIHJlcG9ydCBjb250YWlucyBwZXJmb3JtYW5jZSBtZXRyaWNzIGZvciBhIHN0cmF0ZWd5LiBSZXR1cm5zCkNvbnRyYWN0RXJyb3IgaWYgcmVwb3J0IGdlbmVyYXRpb24gZmFpbHMuCgojIE5vdGUKUmVwb3J0cyB0cmFjazoKLSBDdXJyZW50IHN0cmF0ZWd5IGJhbGFuY2UKLSBHYWlucyBvciBsb3NzZXMgc2luY2UgbGFzdCByZXBvcnQKLSBMb2NrZWQgZmVlcwotIEZlZSBkaXN0cmlidXRpb24gc3RhdHVzAAAAAAAGcmVwb3J0AAAAAAAAAAAAAQAAA+kAAAPqAAAH0AAAAAZSZXBvcnQAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAmBFeGVjdXRlcyByZXNjdWUgKGZvcm1lcmx5IGVtZXJnZW5jeSB3aXRoZHJhd2FsKSBmcm9tIGEgc3BlY2lmaWMgc3RyYXRlZ3kuCgpUaGlzIGZ1bmN0aW9uIGFsbG93cyB0aGUgZW1lcmdlbmN5IG1hbmFnZXIgb3IgbWFuYWdlciB0byB3aXRoZHJhdyBhbGwgYXNzZXRzIGZyb20gYSBwYXJ0aWN1bGFyIHN0cmF0ZWd5CmFuZCBzdG9yZSB0aGVtIGFzIGlkbGUgZnVuZHMgd2l0aGluIHRoZSB2YXVsdC4gSXQgYWxzbyBwYXVzZXMgdGhlIHN0cmF0ZWd5IHRvIHByZXZlbnQgZnVydGhlciB1c2UgdW50aWwKdW5wYXVzZWQuCgojIEFyZ3VtZW50czoKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQuCiogYHN0cmF0ZWd5X2FkZHJlc3NgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIHN0cmF0ZWd5IHRvIHdpdGhkcmF3IGZyb20uCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBpbml0aWF0aW5nIHRoZSBlbWVyZ2VuY3kgd2l0aGRyYXdhbCAobXVzdCBiZSB0aGUgbWFuYWdlciBvciBlbWVyZ2VuY3kgbWFuYWdlcikuCgojIFJldHVybnMKKiBgUmVzdWx0PCgpLCBDb250cmFjdEVycm9yPmAgLSBTdWNjZXNzICgoKSkgb3IgQ29udHJhY3RFcnJvciBpZiB0aGUgcmVzY3VlIG9wZXJhdGlvbiBmYWlscwAAAAZyZXNjdWUAAAAAAAIAAAAAAAAAEHN0cmF0ZWd5X2FkZHJlc3MAAAATAAAAAAAAAAZjYWxsZXIAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAABABIYW5kbGVzIHVzZXIgZGVwb3NpdHMgaW50byB0aGUgRGVGaW5kZXggVmF1bHQgYW5kIG9wdGlvbmFsbHkgYWxsb2NhdGVzIGludmVzdG1lbnRzIGF1dG9tYXRpY2FsbHkuCgpUaGlzIGZ1bmN0aW9uIHByb2Nlc3NlcyBhIGRlcG9zaXQgYnkgdHJhbnNmZXJyaW5nIGVhY2ggc3BlY2lmaWVkIGFzc2V0IGFtb3VudCBmcm9tIHRoZSB1c2VyJ3MgYWRkcmVzcyB0bwp0aGUgdmF1bHQgYW5kIG1pbnRzIHZhdWx0IHNoYXJlcyB0aGF0IHJlcHJlc2VudCB0aGUgdXNlcidzIHByb3BvcnRpb25hbCBzaGFyZSBpbiB0aGUgdmF1bHQuIEFkZGl0aW9uYWxseSwKaWYgdGhlIGBpbnZlc3RgIHBhcmFtZXRlciBpcyBzZXQgdG8gYHRydWVgLCB0aGUgZnVuY3Rpb24gd2lsbCBpbW1lZGlhdGVseSBnZW5lcmF0ZSBhbmQgZXhlY3V0ZSBpbnZlc3RtZW50CmFsbG9jYXRpb25zIGJhc2VkIG9uIHRoZSB2YXVsdCdzIHN0cmF0ZWd5IGNvbmZpZ3VyYXRpb24uCgojIFBhcmFtZXRlcnMKKiBgZWAgLSBUaGUgY3VycmVudCBlbnZpcm9ubWVudCByZWZlcmVuY2UgKGBFbnZgKSwgZm9yIGFjY2VzcyB0byB0aGUgY29udHJhY3Qgc3RhdGUgYW5kIHV0aWxpdGllcy4KKiBgYW1vdW50c19kZXNpcmVkYCAtIEEgdmVjdG9yIHNwZWNpZnlpbmcgdGhlIHVzZXIncyBpbnRlbmRlZCBkZXBvc2l0IGFtb3VudHMgZm9yIGVhY2ggYXNzZXQuCiogYGFtb3VudHNfbWluYCAtIEEgdmVjdG9yIG9mIG1pbmltdW0gZGVwb3NpdCBhbW91bnRzIHJlcXVpcmVkIGZvciB0aGUgdHJhbnNhY3Rpb24gdG8gcHJvY2VlZC4KKiBgZnJvbWAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgdXNlciBtYWtpbmcgdGhlIGRlcG9zaXQuCiogYGludmVzdGAgLSBBIGJvb2xlYW4gZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdG8gaW1tZWRpYXRlbHkgaW52ZXN0IHRoZSBkZXBvc2l0ZWQgZnVuZHMgaW50byB0aGUgdmF1bHQncyBzdHJhdGVnaWVzOgotIGB0cnVlYDogR2VuZXJhdGUgYW5kIGV4ZWN1dGUgaW52ZXN0bWVudHMgYWZ0ZXIgdGhlIGRlcG9zaXQuCi0gYGZhbHNlYDogTGVhAAAAB2RlcG9zaXQAAAAABAAAAAAAAAAPYW1vdW50c19kZXNpcmVkAAAAA+oAAAALAAAAAAAAAAthbW91bnRzX21pbgAAAAPqAAAACwAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmludmVzdAAAAAAAAQAAAAEAAAPpAAAD7QAAAAMAAAPqAAAACwAAAAsAAAPoAAAD6gAAA+gAAAfQAAAAGUFzc2V0SW52ZXN0bWVudEFsbG9jYXRpb24AAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAXJVcGdyYWRlcyB0aGUgY29udHJhY3Qgd2l0aCBuZXcgV2ViQXNzZW1ibHkgKFdBU00pIGNvZGUuCgpUaGlzIGZ1bmN0aW9uIHVwZGF0ZXMgdGhlIGNvbnRyYWN0IHdpdGggbmV3IFdBU00gY29kZSBwcm92aWRlZCBieSB0aGUgYG5ld193YXNtX2hhc2hgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gVGhlIHJ1bnRpbWUgZW52aXJvbm1lbnQuCiogYG5ld193YXNtX2hhc2hgIC0gVGhlIGhhc2ggb2YgdGhlIG5ldyBXQVNNIGNvZGUgdG8gdXBncmFkZSB0aGUgY29udHJhY3QgdG8uCgojIFJldHVybnMKKiBgUmVzdWx0PCgpLCBDb250cmFjdEVycm9yPmAgLSBSZXR1cm5zIE9rKCgpKSBvbiBzdWNjZXNzLCBDb250cmFjdEVycm9yIGlmIHVwZ3JhZGUgZmFpbHMKAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAWpSZXRyaWV2ZXMgdGhlIGN1cnJlbnQgZmVlIHJhdGVzIGZvciB0aGUgdmF1bHQgYW5kIHRoZSBEZUZpbmRleCBwcm90b2NvbC4KClRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgZmVlIHJhdGVzIGZvciBib3RoIHRoZSB2YXVsdCBhbmQgdGhlIERlRmluZGV4IHByb3RvY29sLgoKIyBBcmd1bWVudHMKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQuCgojIFJldHVybnMKKiBgKHUzMiwgdTMyKWAgLSBBIHR1cGxlIGNvbnRhaW5pbmc6Ci0gVGhlIHZhdWx0IGZlZSByYXRlIGFzIGEgcGVyY2VudGFnZSBpbiBiYXNpcyBwb2ludHMuCi0gVGhlIERlRmluZGV4IHByb3RvY29sIGZlZSByYXRlIGFzIGEgcGVyY2VudGFnZSBpbiBiYXNpcyBwb2ludHMuCgAAAAAACGdldF9mZWVzAAAAAAAAAAEAAAPtAAAAAgAAAAQAAAAE",
        "AAAAAAAABABIYW5kbGVzIHVzZXIgd2l0aGRyYXdhbHMgZnJvbSB0aGUgRGVGaW5kZXggVmF1bHQgYnkgYnVybmluZyBzaGFyZXMgYW5kIHJldHVybmluZyBhc3NldHMuCgpUaGlzIGZ1bmN0aW9uIHByb2Nlc3NlcyBhIHdpdGhkcmF3YWwgcmVxdWVzdCBieSBidXJuaW5nIHRoZSBzcGVjaWZpZWQgYW1vdW50IG9mIHZhdWx0IHNoYXJlcwphbmQgcmV0dXJuaW5nIGEgcHJvcG9ydGlvbmFsIGFtb3VudCBvZiB0aGUgdmF1bHQncyBhc3NldHMgdG8gdGhlIHVzZXIuIEl0IGNhbiB1bndpbmQgcG9zaXRpb25zCmZyb20gc3RyYXRlZ2llcyBpZiBuZWNlc3NhcnkgdG8gZnVsZmlsbCB0aGUgd2l0aGRyYXdhbC4KCiMjIFBhcmFtZXRlcnM6Ci0gYGVgOiBUaGUgY29udHJhY3QgZW52aXJvbm1lbnQgKGBFbnZgKS4KLSBgd2l0aGRyYXdfc2hhcmVzYDogVGhlIG51bWJlciBvZiB2YXVsdCBzaGFyZXMgdG8gd2l0aGRyYXcuCi0gYG1pbl9hbW91bnRzX291dGA6IEEgdmVjdG9yIG9mIG1pbmltdW0gYW1vdW50cyByZXF1aXJlZCBmb3IgZWFjaCBhc3NldCB0byBiZSB3aXRoZHJhd24uCi0gYGZyb21gOiBUaGUgYWRkcmVzcyBpbml0aWF0aW5nIHRoZSB3aXRoZHJhd2FsLgoKIyMgUmV0dXJucwoqIGBSZXN1bHQ8VmVjPGkxMjg+LCBDb250cmFjdEVycm9yPmAgLSBPbiBzdWNjZXNzLCByZXR1cm5zIGEgdmVjdG9yIG9mIHdpdGhkcmF3biBhbW91bnRzCndoZXJlIGVhY2ggaW5kZXggY29ycmVzcG9uZHMgdG8gdGhlIGFzc2V0IGluZGV4IGluIHRoZSB2YXVsdCdzIGFzc2V0IGxpc3QuClJldHVybnMgQ29udHJhY3RFcnJvciBpZiB0aGUgd2l0aGRyYXdhbCBmYWlscy4KCiMjIEVycm9yczoKLSBgQ29udHJhY3RFcnJvcjo6QW1vdW50T3ZlclRvdGFsU3VwcGx5YDogSWYgdGhlIHNwZWNpZmllZCBzaGFyZXMgZXhjZWVkIHRoZSB0b3RhbCBzdXBwbHkuCi0gYENvbnRyYWN0RXJyb3I6OkFyaXRobWV0aWNFcnJvcmA6IElmIGFueSBhcml0aG1ldGljIG9wZXJhdGlvbiBmYWlscyBkdXJpbmcgY2FsY3VsYXRpb25zLgotIGBDb250cmFjdEVycm9yAAAACHdpdGhkcmF3AAAAAwAAAAAAAAAPd2l0aGRyYXdfc2hhcmVzAAAAAAsAAAAAAAAAD21pbl9hbW91bnRzX291dAAAAAPqAAAACwAAAAAAAAAEZnJvbQAAABMAAAABAAAD6QAAA+oAAAALAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAa1Mb2NrcyBmZWVzIGZvciBhbGwgYXNzZXRzIGFuZCB0aGVpciBzdHJhdGVnaWVzLgoKSXRlcmF0ZXMgdGhyb3VnaCBlYWNoIGFzc2V0IGFuZCBpdHMgc3RyYXRlZ2llcywgbG9ja2luZyBmZWVzIGJhc2VkIG9uIGBuZXdfZmVlX2Jwc2Agb3IgdGhlIGRlZmF1bHQgdmF1bHQgZmVlLgoKIyBBcmd1bWVudHMKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQgcmVmZXJlbmNlLgoqIGBuZXdfZmVlX2Jwc2AgLSBPcHRpb25hbCBmZWUgYmFzaXMgcG9pbnRzIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0LgoKIyBSZXR1cm5zCiogYFJlc3VsdDxWZWM8KEFkZHJlc3MsIGkxMjgpPiwgQ29udHJhY3RFcnJvcj5gIC0gQSB2ZWN0b3Igb2YgdHVwbGVzIHdpdGggc3RyYXRlZ3kgYWRkcmVzc2VzIGFuZCBsb2NrZWQgZmVlIGFtb3VudHMgaW4gdGhlaXIgdW5kZXJseWluZ19hc3NldC4AAAAAAAAJbG9ja19mZWVzAAAAAAAAAQAAAAAAAAALbmV3X2ZlZV9icHMAAAAD6AAAAAQAAAABAAAD6QAAA+oAAAfQAAAABlJlcG9ydAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAATtSZWJhbGFuY2VzIHRoZSB2YXVsdCBieSBleGVjdXRpbmcgYSBzZXJpZXMgb2YgaW5zdHJ1Y3Rpb25zLgoKIyBBcmd1bWVudHM6CiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoqIGBpbnN0cnVjdGlvbnNgIC0gQSB2ZWN0b3Igb2YgYEluc3RydWN0aW9uYCBzdHJ1Y3RzIHJlcHJlc2VudGluZyBhY3Rpb25zICh3aXRoZHJhdywgaW52ZXN0LCBzd2FwLCB6YXBwZXIpIHRvIGJlIHRha2VuLgoKIyBSZXR1cm5zOgoqIGBSZXN1bHQ8KCksIENvbnRyYWN0RXJyb3I+YCAtIE9rIGlmIHN1Y2Nlc3NmdWwsIG90aGVyd2lzZSByZXR1cm5zIGEgQ29udHJhY3RFcnJvci4AAAAACXJlYmFsYW5jZQAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAMaW5zdHJ1Y3Rpb25zAAAD6gAAB9AAAAALSW5zdHJ1Y3Rpb24AAAAAAQAAA+kAAAPtAAAAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAN9SZXRyaWV2ZXMgdGhlIGxpc3Qgb2YgYXNzZXRzIG1hbmFnZWQgYnkgdGhlIERlRmluZGV4IFZhdWx0LgoKIyBBcmd1bWVudHM6CiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoKIyBSZXR1cm5zOgoqIGBWZWM8QXNzZXRTdHJhdGVneVNldD5gIC0gQSB2ZWN0b3Igb2YgYEFzc2V0U3RyYXRlZ3lTZXRgIHN0cnVjdHMgcmVwcmVzZW50aW5nIHRoZSBhc3NldHMgbWFuYWdlZCBieSB0aGUgdmF1bHQuAAAAAApnZXRfYXNzZXRzAAAAAAAAAAAAAQAAA+kAAAPqAAAH0AAAABBBc3NldFN0cmF0ZWd5U2V0AAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAANJSZXRyaWV2ZXMgdGhlIGN1cnJlbnQgbWFuYWdlciBhZGRyZXNzIGZvciB0aGUgdmF1bHQuCgojIEFyZ3VtZW50czoKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQuCgojIFJldHVybnM6CiogYFJlc3VsdDxBZGRyZXNzLCBDb250cmFjdEVycm9yPmAgLSBUaGUgbWFuYWdlciBhZGRyZXNzIGlmIHN1Y2Nlc3NmdWwsIG90aGVyd2lzZSByZXR1cm5zIGEgQ29udHJhY3RFcnJvci4AAAAAAAtnZXRfbWFuYWdlcgAAAAAAAAAAAQAAA+kAAAATAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAASRTZXRzIHRoZSBtYW5hZ2VyIGZvciB0aGUgdmF1bHQuCgpUaGlzIGZ1bmN0aW9uIGFsbG93cyB0aGUgY3VycmVudCBtYW5hZ2VyIHRvIHNldCBhIG5ldyBtYW5hZ2VyIGZvciB0aGUgdmF1bHQuCgojIEFyZ3VtZW50czoKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQuCiogYG5ld19tYW5hZ2VyYCAtIFRoZSBuZXcgbWFuYWdlciBhZGRyZXNzLgoKIyBSZXR1cm5zCiogYFJlc3VsdDwoKSwgQ29udHJhY3RFcnJvcj5gIC0gU3VjY2VzcyAoKCkpIG9yIENvbnRyYWN0RXJyb3IgaWYgdGhlIG1hbmFnZXIgY2hhbmdlIGZhaWxzAAAAC3NldF9tYW5hZ2VyAAAAAAEAAAAAAAAAC25ld19tYW5hZ2VyAAAAABMAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAUlSZWxlYXNlcyBsb2NrZWQgZmVlcyBmb3IgYSBzcGVjaWZpYyBzdHJhdGVneS4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIGVudmlyb25tZW50IHJlZmVyZW5jZS4KKiBgc3RyYXRlZ3lgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIHN0cmF0ZWd5IGZvciB3aGljaCB0byByZWxlYXNlIGZlZXMuCiogYGFtb3VudGAgLSBUaGUgYW1vdW50IG9mIGZlZXMgdG8gcmVsZWFzZS4KCiMgUmV0dXJucwoqIGBSZXN1bHQ8UmVwb3J0LCBDb250cmFjdEVycm9yPmAgLSBBIHJlcG9ydCBvZiB0aGUgcmVsZWFzZWQgZmVlcyBvciBhIGBDb250cmFjdEVycm9yYCBpZiB0aGUgb3BlcmF0aW9uIGZhaWxzLgAAAAAAAAxyZWxlYXNlX2ZlZXMAAAACAAAAAAAAAAhzdHJhdGVneQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAH0AAAAAZSZXBvcnQAAAAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAABABJbml0aWFsaXplcyB0aGUgRGVGaW5kZXggVmF1bHQgY29udHJhY3Qgd2l0aCB0aGUgcmVxdWlyZWQgcGFyYW1ldGVycy4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIGVudmlyb25tZW50IHJlZmVyZW5jZS4KKiBgYXNzZXRzYCAtIExpc3Qgb2YgYXNzZXQgYWxsb2NhdGlvbnMgZm9yIHRoZSB2YXVsdCwgaW5jbHVkaW5nIHN0cmF0ZWdpZXMgZm9yIGVhY2ggYXNzZXQuCiogYHJvbGVzYCAtIE1hcCBvZiByb2xlIElEcyB0byBhZGRyZXNzZXMgY29udGFpbmluZzoKLSBFbWVyZ2VuY3kgTWFuYWdlcjogRm9yIGVtZXJnZW5jeSBjb250cm9sCi0gVmF1bHQgRmVlIFJlY2VpdmVyOiBGb3IgcmVjZWl2aW5nIHZhdWx0IGZlZXMKLSBNYW5hZ2VyOiBGb3IgcHJpbWFyeSB2YXVsdCBjb250cm9sCi0gUmViYWxhbmNlIE1hbmFnZXI6IEZvciByZWJhbGFuY2luZyBvcGVyYXRpb25zCiogYHZhdWx0X2ZlZWAgLSBWYXVsdC1zcGVjaWZpYyBmZWUgaW4gYmFzaXMgcG9pbnRzICgwXzIwMDAgZm9yIDAuMjAlKQoqIGBkZWZpbmRleF9wcm90b2NvbF9yZWNlaXZlcmAgLSBBZGRyZXNzIHJlY2VpdmluZyBwcm90b2NvbCBmZWVzCiogYGRlZmluZGV4X3Byb3RvY29sX3JhdGVgIC0gUHJvdG9jb2wgZmVlIHJhdGUgaW4gYmFzaXMgcG9pbnRzICgwLTkwMDAgZm9yIDAtOTAlKQoqIGBzb3Jvc3dhcF9yb3V0ZXJgIC0gU29yb3N3YXAgcm91dGVyIGFkZHJlc3MKKiBgbmFtZV9zeW1ib2xgIC0gTWFwIGNvbnRhaW5pbmc6Ci0gIm5hbWUiOiBWYXVsdCB0b2tlbiBuYW1lCi0gInN5bWJvbCI6IFZhdWx0IHRva2VuIHN5bWJvbAoqIGB1cGdyYWRhYmxlYCAtIEJvb2xlYW4gZmxhZyBmb3IgY29udHJhY3QgdXBncmFkZWFiaWxpdHkKCiMgRnVuY3Rpb24gRmxvdwoxLiAqKlJvbGUgQXNzaWdubWVudCoqOgotIFNldHMgRW1lcmdlbmN5IE1hbmFnZXIKLSBTZXRzIFZhdWx0IEZlZSBSZWNlaXZlcgotIFNldHMgTWFuYWdlcgotIFNldHMgUmViYWxhbmNlIE1hbmFnZXIKCjIuICoqRmVlIENvbmZpZ3VyYXRpb24qKjoKLSBTZXRzIHZhdWx0IGZlAAAADV9fY29uc3RydWN0b3IAAAAAAAAIAAAAAAAAAAZhc3NldHMAAAAAA+oAAAfQAAAAEEFzc2V0U3RyYXRlZ3lTZXQAAAAAAAAABXJvbGVzAAAAAAAD7AAAAAQAAAATAAAAAAAAAAl2YXVsdF9mZWUAAAAAAAAEAAAAAAAAABpkZWZpbmRleF9wcm90b2NvbF9yZWNlaXZlcgAAAAAAEwAAAAAAAAAWZGVmaW5kZXhfcHJvdG9jb2xfcmF0ZQAAAAAABAAAAAAAAAAPc29yb3N3YXBfcm91dGVyAAAAABMAAAAAAAAAC25hbWVfc3ltYm9sAAAAA+wAAAAQAAAAEAAAAAAAAAAKdXBncmFkYWJsZQAAAAAAAQAAAAA=",
        "AAAAAAAAAedQYXVzZXMgYSBzdHJhdGVneSB0byBwcmV2ZW50IGl0IGZyb20gYmVpbmcgdXNlZCBpbiB0aGUgdmF1bHQuCgpUaGlzIGZ1bmN0aW9uIHBhdXNlcyBhIHN0cmF0ZWd5IGJ5IHNldHRpbmcgaXRzIGBwYXVzZWRgIGZpZWxkIHRvIGB0cnVlYC4gT25seSB0aGUgbWFuYWdlciBvciBlbWVyZ2VuY3kKbWFuYWdlciBjYW4gcGF1c2UgYSBzdHJhdGVneS4KCiMgQXJndW1lbnRzOgoqIGBlYCAtIFRoZSBlbnZpcm9ubWVudC4KKiBgc3RyYXRlZ3lfYWRkcmVzc2AgLSBUaGUgYWRkcmVzcyBvZiB0aGUgc3RyYXRlZ3kgdG8gcGF1c2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBpbml0aWF0aW5nIHRoZSBwYXVzZSAobXVzdCBiZSB0aGUgbWFuYWdlciBvciBlbWVyZ2VuY3kgbWFuYWdlcikuCgojIFJldHVybnMKKiBgUmVzdWx0PCgpLCBDb250cmFjdEVycm9yPmAgLSBTdWNjZXNzICgoKSkgb3IgQ29udHJhY3RFcnJvciBpZiB0aGUgcGF1c2Ugb3BlcmF0aW9uIGZhaWxzAAAAAA5wYXVzZV9zdHJhdGVneQAAAAAAAgAAAAAAAAAQc3RyYXRlZ3lfYWRkcmVzcwAAABMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAmFEaXN0cmlidXRlcyB0aGUgbG9ja2VkIGZlZXMgZm9yIGFsbCBhc3NldHMgYW5kIHRoZWlyIHN0cmF0ZWdpZXMuCgpUaGlzIGZ1bmN0aW9uIGl0ZXJhdGVzIHRocm91Z2ggZWFjaCBhc3NldCBhbmQgaXRzIHN0cmF0ZWdpZXMsIGNhbGN1bGF0aW5nIHRoZSBmZWVzIHRvIGJlIGRpc3RyaWJ1dGVkCnRvIHRoZSB2YXVsdCBmZWUgcmVjZWl2ZXIgYW5kIHRoZSBEZUZpbmRleCBwcm90b2NvbCBmZWUgcmVjZWl2ZXIgYmFzZWQgb24gdGhlaXIgcmVzcGVjdGl2ZSBmZWUgcmF0ZXMuCkl0IGVuc3VyZXMgcHJvcGVyIGF1dGhvcml6YXRpb24gYW5kIHZhbGlkYXRpb24gY2hlY2tzIGJlZm9yZSBwcm9jZWVkaW5nIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi4KCiMgQXJndW1lbnRzCiogYGVgIC0gVGhlIGVudmlyb25tZW50IHJlZmVyZW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIGluaXRpYXRpbmcgdGhlIGZlZSBkaXN0cmlidXRpb24uCgojIFJldHVybnMKKiBgUmVzdWx0PFZlYzwoQWRkcmVzcywgaTEyOCk+LCBDb250cmFjdEVycm9yPmAgLSBBIHZlY3RvciBvZiB0dXBsZXMgd2l0aCBhc3NldCBhZGRyZXNzZXMgYW5kIHRoZSB0b3RhbCBkaXN0cmlidXRlZCBmZWUgYW1vdW50cy4AAAAAAAAPZGlzdHJpYnV0ZV9mZWVzAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD6gAAA+0AAAACAAAAEwAAAAsAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAANxSZXRyaWV2ZXMgdGhlIGN1cnJlbnQgZmVlIHJlY2VpdmVyIGFkZHJlc3MgZm9yIHRoZSB2YXVsdC4KCiMgQXJndW1lbnRzOgoqIGBlYCAtIFRoZSBlbnZpcm9ubWVudC4KCiMgUmV0dXJuczoKKiBgUmVzdWx0PEFkZHJlc3MsIENvbnRyYWN0RXJyb3I+YCAtIFRoZSBmZWUgcmVjZWl2ZXIgYWRkcmVzcyBpZiBzdWNjZXNzZnVsLCBvdGhlcndpc2UgcmV0dXJucyBhIENvbnRyYWN0RXJyb3IuAAAAEGdldF9mZWVfcmVjZWl2ZXIAAAAAAAAAAQAAA+kAAAATAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAAAAAAAXVTZXRzIHRoZSBmZWUgcmVjZWl2ZXIgZm9yIHRoZSB2YXVsdC4KClRoaXMgZnVuY3Rpb24gYWxsb3dzIHRoZSBtYW5hZ2VyIG9yIHRoZSB2YXVsdCBmZWUgcmVjZWl2ZXIgdG8gc2V0IGEgbmV3IGZlZSByZWNlaXZlciBhZGRyZXNzIGZvciB0aGUgdmF1bHQuCgojIEFyZ3VtZW50czoKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBpbml0aWF0aW5nIHRoZSBjaGFuZ2UgKG11c3QgYmUgdGhlIG1hbmFnZXIgb3IgdGhlIHZhdWx0IGZlZSByZWNlaXZlcikuCiogYHZhdWx0X2ZlZV9yZWNlaXZlcmAgLSBUaGUgbmV3IGZlZSByZWNlaXZlciBhZGRyZXNzLgoKIyBSZXR1cm5zOgoqIGAoKWAgLSBObyByZXR1cm4gdmFsdWUuAAAAAAAAEHNldF9mZWVfcmVjZWl2ZXIAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAEG5ld19mZWVfcmVjZWl2ZXIAAAATAAAAAA==",
        "AAAAAAAAAcFVbnBhdXNlcyBhIHByZXZpb3VzbHkgcGF1c2VkIHN0cmF0ZWd5LgoKVGhpcyBmdW5jdGlvbiB1bnBhdXNlcyBhIHN0cmF0ZWd5IGJ5IHNldHRpbmcgaXRzIGBwYXVzZWRgIGZpZWxkIHRvIGBmYWxzZWAsIGFsbG93aW5nIGl0IHRvIGJlIHVzZWQKYWdhaW4gaW4gdGhlIHZhdWx0LgoKIyBBcmd1bWVudHM6CiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoqIGBzdHJhdGVneV9hZGRyZXNzYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBzdHJhdGVneSB0byB1bnBhdXNlLgoqIGBjYWxsZXJgIC0gVGhlIGFkZHJlc3MgaW5pdGlhdGluZyB0aGUgdW5wYXVzZSAobXVzdCBiZSB0aGUgbWFuYWdlciBvciBlbWVyZ2VuY3kgbWFuYWdlcikuCgojIFJldHVybnM6CiogYFJlc3VsdDwoKSwgQ29udHJhY3RFcnJvcj5gIC0gT2sgaWYgc3VjY2Vzc2Z1bCwgb3RoZXJ3aXNlIHJldHVybnMgYSBDb250cmFjdEVycm9yLgAAAAAAABB1bnBhdXNlX3N0cmF0ZWd5AAAAAgAAAAAAAAAQc3RyYXRlZ3lfYWRkcmVzcwAAABMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAOZSZXRyaWV2ZXMgdGhlIGN1cnJlbnQgZW1lcmdlbmN5IG1hbmFnZXIgYWRkcmVzcyBmb3IgdGhlIHZhdWx0LgoKIyBBcmd1bWVudHM6CiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoKIyBSZXR1cm5zOgoqIGBSZXN1bHQ8QWRkcmVzcywgQ29udHJhY3RFcnJvcj5gIC0gVGhlIGVtZXJnZW5jeSBtYW5hZ2VyIGFkZHJlc3MgaWYgc3VjY2Vzc2Z1bCwgb3RoZXJ3aXNlIHJldHVybnMgYSBDb250cmFjdEVycm9yLgAAAAAAFWdldF9lbWVyZ2VuY3lfbWFuYWdlcgAAAAAAAAAAAAABAAAD6QAAABMAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAOZSZXRyaWV2ZXMgdGhlIGN1cnJlbnQgcmViYWxhbmNlIG1hbmFnZXIgYWRkcmVzcyBmb3IgdGhlIHZhdWx0LgoKIyBBcmd1bWVudHM6CiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoKIyBSZXR1cm5zOgoqIGBSZXN1bHQ8QWRkcmVzcywgQ29udHJhY3RFcnJvcj5gIC0gVGhlIHJlYmFsYW5jZSBtYW5hZ2VyIGFkZHJlc3MgaWYgc3VjY2Vzc2Z1bCwgb3RoZXJ3aXNlIHJldHVybnMgYSBDb250cmFjdEVycm9yLgAAAAAAFWdldF9yZWJhbGFuY2VfbWFuYWdlcgAAAAAAAAAAAAABAAAD6QAAABMAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAAAAAQlTZXRzIHRoZSBlbWVyZ2VuY3kgbWFuYWdlciBmb3IgdGhlIHZhdWx0LgoKVGhpcyBmdW5jdGlvbiBhbGxvd3MgdGhlIGN1cnJlbnQgbWFuYWdlciB0byBzZXQgYSBuZXcgZW1lcmdlbmN5IG1hbmFnZXIgZm9yIHRoZSB2YXVsdC4KCiMgQXJndW1lbnRzOgoqIGBlYCAtIFRoZSBlbnZpcm9ubWVudC4KKiBgZW1lcmdlbmN5X21hbmFnZXJgIC0gVGhlIG5ldyBlbWVyZ2VuY3kgbWFuYWdlciBhZGRyZXNzLgoKIyBSZXR1cm5zOgoqIGAoKWAgLSBObyByZXR1cm4gdmFsdWUuAAAAAAAAFXNldF9lbWVyZ2VuY3lfbWFuYWdlcgAAAAAAAAEAAAAAAAAAEWVtZXJnZW5jeV9tYW5hZ2VyAAAAAAAAEwAAAAA=",
        "AAAAAAAAAQ1TZXRzIHRoZSByZWJhbGFuY2UgbWFuYWdlciBmb3IgdGhlIHZhdWx0LgoKVGhpcyBmdW5jdGlvbiBhbGxvd3MgdGhlIGN1cnJlbnQgbWFuYWdlciB0byBzZXQgYSBuZXcgcmViYWxhbmNlIG1hbmFnZXIgZm9yIHRoZSB2YXVsdC4KCiMgQXJndW1lbnRzOgoqIGBlYCAtIFRoZSBlbnZpcm9ubWVudC4KKiBgbmV3X3JlYmFsYW5jZV9tYW5hZ2VyYCAtIFRoZSBuZXcgcmViYWxhbmNlIG1hbmFnZXIgYWRkcmVzcy4KCiMgUmV0dXJuczoKKiBgKClgIC0gTm8gcmV0dXJuIHZhbHVlLgAAAAAAABVzZXRfcmViYWxhbmNlX21hbmFnZXIAAAAAAAABAAAAAAAAABVuZXdfcmViYWxhbmNlX21hbmFnZXIAAAAAAAATAAAAAA==",
        "AAAAAAAAAb9SZXR1cm5zIHRoZSB0b3RhbCBtYW5hZ2VkIGZ1bmRzIG9mIHRoZSB2YXVsdCwgaW5jbHVkaW5nIGJvdGggaW52ZXN0ZWQgYW5kIGlkbGUgZnVuZHMuCgpUaGlzIGZ1bmN0aW9uIHByb3ZpZGVzIGEgdmVjdG9yIG9mIGBDdXJyZW50QXNzZXRJbnZlc3RtZW50QWxsb2NhdGlvbmAgc3RydWN0cyBjb250YWluaW5nIGluZm9ybWF0aW9uCmFib3V0IGVhY2ggYXNzZXQncyBjdXJyZW50IGFsbG9jYXRpb24sIGluY2x1ZGluZyBib3RoIGludmVzdGVkIGFtb3VudHMgaW4gc3RyYXRlZ2llcyBhbmQgaWRsZSBhbW91bnRzLgoKIyBBcmd1bWVudHM6CiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoKIyBSZXR1cm5zOgoqIGBSZXN1bHQ8VmVjPEN1cnJlbnRBc3NldEludmVzdG1lbnRBbGxvY2F0aW9uPiwgQ29udHJhY3RFcnJvcj5gIC0gQSB2ZWN0b3Igb2YgYXNzZXQgYWxsb2NhdGlvbnMgb3IgZXJyb3IAAAAAGWZldGNoX3RvdGFsX21hbmFnZWRfZnVuZHMAAAAAAAAAAAAAAQAAA+kAAAPqAAAH0AAAACBDdXJyZW50QXNzZXRJbnZlc3RtZW50QWxsb2NhdGlvbgAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAn9UaGlzIGZ1bmN0aW9uIGV4dGVuZHMgdGhlIGNvbnRyYWN0J3MgdGltZS10by1saXZlIGFuZCBjYWxjdWxhdGVzIGhvdyBtdWNoIG9mIGVhY2ggYXNzZXQgY29ycmVzcG9uZHMKcGVyIHRoZSBwcm92aWRlZCBudW1iZXIgb2YgdmF1bHQgc2hhcmVzIChgdmF1bHRfc2hhcmVzYCkuIEl0IHByb3ZpZGVzIHByb3BvcnRpb25hbCBhbGxvY2F0aW9ucyBmb3IgZWFjaCBhc3NldAppbiB0aGUgdmF1bHQgcmVsYXRpdmUgdG8gdGhlIHNwZWNpZmllZCBzaGFyZXMuCgojIEFyZ3VtZW50cwoqIGBlYCAtIFRoZSBjdXJyZW50IGVudmlyb25tZW50IHJlZmVyZW5jZS4KKiBgdmF1bHRfc2hhcmVzYCAtIFRoZSBudW1iZXIgb2YgdmF1bHQgc2hhcmVzIGZvciB3aGljaCB0aGUgY29ycmVzcG9uZGluZyBhc3NldCBhbW91bnRzIGFyZSBjYWxjdWxhdGVkLgoKIyBSZXR1cm5zCiogYFJlc3VsdDxWZWM8aTEyOD4sIENvbnRyYWN0RXJyb3I+YCAtIEEgdmVjdG9yIG9mIGFzc2V0IGFtb3VudHMgY29ycmVzcG9uZGluZyB0byB0aGUgdmF1bHQgc2hhcmVzLCB3aGVyZSBlYWNoIGluZGV4Cm1hdGNoZXMgdGhlIGFzc2V0IGluZGV4IGluIHRoZSB2YXVsdCdzIGFzc2V0IGxpc3QuIFJldHVybnMgQ29udHJhY3RFcnJvciBpZiBjYWxjdWxhdGlvbiBmYWlscy4AAAAAHGdldF9hc3NldF9hbW91bnRzX3Blcl9zaGFyZXMAAAABAAAAAAAAAAx2YXVsdF9zaGFyZXMAAAALAAAAAQAAA+kAAAPqAAAACwAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAwAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAZAAAAAAAAAAMSW52YWxpZFJhdGlvAAAAZQAAAAAAAAAbU3RyYXRlZ3lEb2VzTm90U3VwcG9ydEFzc2V0AAAAAGYAAAAAAAAAEU5vQXNzZXRBbGxvY2F0aW9uAAAAAAAAZwAAAAAAAAAPUm9sZXNJbmNvbXBsZXRlAAAAAGgAAAAAAAAAEk1ldGFkYXRhSW5jb21wbGV0ZQAAAAAAaQAAAAAAAAASTWF4aW11bUZlZUV4Y2VlZGVkAAAAAABqAAAAAAAAAA9EdXBsaWNhdGVkQXNzZXQAAAAAawAAAAAAAAASRHVwbGljYXRlZFN0cmF0ZWd5AAAAAABsAAAAAAAAABBBbW91bnROb3RBbGxvd2VkAAAAbgAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAABvAAAAAAAAABJXcm9uZ0Ftb3VudHNMZW5ndGgAAAAAAHAAAAAAAAAAD1dyb25nTG9ja2VkRmVlcwAAAABxAAAAAAAAABhJbnN1ZmZpY2llbnRNYW5hZ2VkRnVuZHMAAAByAAAAAAAAABZNaXNzaW5nSW5zdHJ1Y3Rpb25EYXRhAAAAAABzAAAAAAAAABBVbnN1cHBvcnRlZEFzc2V0AAAAdAAAAAAAAAASSW5zdWZmaWNpZW50QW1vdW50AAAAAAB1AAAAAAAAABBOb09wdGltYWxBbW91bnRzAAAAdgAAAAAAAAAVV3JvbmdJbnZlc3RtZW50TGVuZ3RoAAAAAAAAdwAAAAAAAAARV3JvbmdBc3NldEFkZHJlc3MAAAAAAAB6AAAAAAAAABVXcm9uZ1N0cmF0ZWdpZXNMZW5ndGgAAAAAAAB7AAAAAAAAABVBbW91bnRPdmVyVG90YWxTdXBwbHkAAAAAAAB8AAAAAAAAAA5Ob0luc3RydWN0aW9ucwAAAAAAfQAAAAAAAAANTm90VXBncmFkYWJsZQAAAAAAAH4AAAAAAAAAF1Vud2luZE1vcmVUaGFuQXZhaWxhYmxlAAAAAIAAAAAAAAAAGUluc3VmZmljaWVudEZlZXNUb1JlbGVhc2UAAAAAAACBAAAAAAAAAA9Bcml0aG1ldGljRXJyb3IAAAAAeAAAAAAAAAAIT3ZlcmZsb3cAAAB5AAAAAAAAAAlVbmRlcmZsb3cAAAAAAAB/AAAAAAAAAAxVbmF1dGhvcml6ZWQAAACCAAAAAAAAAAxSb2xlTm90Rm91bmQAAACDAAAAAAAAABFNYW5hZ2VyTm90SW5RdWV1ZQAAAAAAAIQAAAAAAAAAFFNldE1hbmFnZXJCZWZvcmVUaW1lAAAAhQAAAAAAAAAKUXVldWVFbXB0eQAAAAAAhgAAAAAAAAAQU3RyYXRlZ3lOb3RGb3VuZAAAAIwAAAAAAAAAGFN0cmF0ZWd5UGF1c2VkT3JOb3RGb3VuZAAAAI0AAAAAAAAAFVN0cmF0ZWd5V2l0aGRyYXdFcnJvcgAAAAAAAI4AAAAAAAAAE1N0cmF0ZWd5SW52ZXN0RXJyb3IAAAAAjwAAAAAAAAAOU3RyYXRlZ3lQYXVzZWQAAAAAAJAAAAAAAAAADUFzc2V0Tm90Rm91bmQAAAAAAACWAAAAAAAAABBOb0Fzc2V0c1Byb3ZpZGVkAAAAlwAAAAAAAAAYSW5zdWZmaWNpZW50T3V0cHV0QW1vdW50AAAAoAAAAAAAAAAURXhjZXNzaXZlSW5wdXRBbW91bnQAAAChAAAAAAAAAA1JbnZhbGlkRmVlQnBzAAAAAAAAogAAAAAAAAAaTGlicmFyeVNvcnRJZGVudGljYWxUb2tlbnMAAAAAAL4AAAAAAAAAE1Nvcm9zd2FwUm91dGVyRXJyb3IAAAAAyAAAAAAAAAAQU3dhcEV4YWN0SW5FcnJvcgAAAMkAAAAAAAAAEVN3YXBFeGFjdE91dEVycm9yAAAAAAAAyg==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAEAAAAAAAAACUFsbG93YW5jZQAAAAAAAAEAAAfQAAAAEEFsbG93YW5jZURhdGFLZXkAAAABAAAAAAAAAAdCYWxhbmNlAAAAAAEAAAATAAAAAAAAAAAAAAALVG90YWxTdXBwbHkA",
        "AAAAAQAAAAAAAAAAAAAADkFsbG93YW5jZVZhbHVlAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAAEEFsbG93YW5jZURhdGFLZXkAAAACAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAAT",
        "AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==",
        "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAMdG90YWxfc3VwcGx5AAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAgAAAAAAAAAAAAAADFJvbGVzRGF0YUtleQAAAAQAAAAAAAAAAAAAABBFbWVyZ2VuY3lNYW5hZ2VyAAAAAAAAAAAAAAAQVmF1bHRGZWVSZWNlaXZlcgAAAAAAAAAAAAAAB01hbmFnZXIAAAAAAAAAAAAAAAAQUmViYWxhbmNlTWFuYWdlcg==",
        "AAAAAQAAAAAAAAAAAAAAC0ludmVzdEV2ZW50AAAAAAMAAAAAAAAAEWFzc2V0X2ludmVzdG1lbnRzAAAAAAAD6gAAB9AAAAAZQXNzZXRJbnZlc3RtZW50QWxsb2NhdGlvbgAAAAAAAAAAAAAQcmViYWxhbmNlX21ldGhvZAAAABEAAAAAAAAABnJlcG9ydAAAAAAH0AAAAAZSZXBvcnQAAA==",
        "AAAAAQAAAAAAAAAAAAAAC1Vud2luZEV2ZW50AAAAAAMAAAAAAAAAC2NhbGxfcGFyYW1zAAAAA+oAAAPtAAAAAwAAABMAAAALAAAAEwAAAAAAAAAQcmViYWxhbmNlX21ldGhvZAAAABEAAAAAAAAABnJlcG9ydAAAAAAH0AAAAAZSZXBvcnQAAA==",
        "AAAAAQAAAAAAAAAAAAAAEFN3YXBFeGFjdEluRXZlbnQAAAACAAAAAAAAABByZWJhbGFuY2VfbWV0aG9kAAAAEQAAAAAAAAAJc3dhcF9hcmdzAAAAAAAD6gAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEVN3YXBFeGFjdE91dEV2ZW50AAAAAAAAAgAAAAAAAAAQcmViYWxhbmNlX21ldGhvZAAAABEAAAAAAAAACXN3YXBfYXJncwAAAAAAA+oAAAAA",
        "AAAAAQAAAAAAAAAAAAAAEVZhdWx0RGVwb3NpdEV2ZW50AAAAAAAABQAAAAAAAAAHYW1vdW50cwAAAAPqAAAACwAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAQZGZfdG9rZW5zX21pbnRlZAAAAAsAAAAAAAAAGnRvdGFsX21hbmFnZWRfZnVuZHNfYmVmb3JlAAAAAAPqAAAH0AAAACBDdXJyZW50QXNzZXRJbnZlc3RtZW50QWxsb2NhdGlvbgAAAAAAAAATdG90YWxfc3VwcGx5X2JlZm9yZQAAAAAL",
        "AAAAAQAAAAAAAAAAAAAAElZhdWx0V2l0aGRyYXdFdmVudAAAAAAABQAAAAAAAAARYW1vdW50c193aXRoZHJhd24AAAAAAAPqAAAACwAAAAAAAAAQZGZfdG9rZW5zX2J1cm5lZAAAAAsAAAAAAAAAGnRvdGFsX21hbmFnZWRfZnVuZHNfYmVmb3JlAAAAAAPqAAAH0AAAACBDdXJyZW50QXNzZXRJbnZlc3RtZW50QWxsb2NhdGlvbgAAAAAAAAATdG90YWxfc3VwcGx5X2JlZm9yZQAAAAALAAAAAAAAAAp3aXRoZHJhd2VyAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAAE01hbmFnZXJDaGFuZ2VkRXZlbnQAAAAAAQAAAAAAAAALbmV3X21hbmFnZXIAAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAE1N0cmF0ZWd5UGF1c2VkRXZlbnQAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAABBzdHJhdGVneV9hZGRyZXNzAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAFEZlZXNEaXN0cmlidXRlZEV2ZW50AAAAAQAAAAAAAAAQZGlzdHJpYnV0ZWRfZmVlcwAAA+oAAAPtAAAAAgAAABMAAAAL",
        "AAAAAQAAAAAAAAAAAAAAFVN0cmF0ZWd5VW5wYXVzZWRFdmVudAAAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAQc3RyYXRlZ3lfYWRkcmVzcwAAABM=",
        "AAAAAQAAAAAAAAAAAAAAFkVtZXJnZW5jeVdpdGhkcmF3RXZlbnQAAAAAAAMAAAAAAAAAEGFtb3VudF93aXRoZHJhd24AAAALAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAEHN0cmF0ZWd5X2FkZHJlc3MAAAAT",
        "AAAAAQAAAAAAAAAAAAAAF0ZlZVJlY2VpdmVyQ2hhbmdlZEV2ZW50AAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAQbmV3X2ZlZV9yZWNlaXZlcgAAABM=",
        "AAAAAQAAAAAAAAAAAAAAHEVtZXJnZW5jeU1hbmFnZXJDaGFuZ2VkRXZlbnQAAAABAAAAAAAAABVuZXdfZW1lcmdlbmN5X21hbmFnZXIAAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAAHFJlYmFsYW5jZU1hbmFnZXJDaGFuZ2VkRXZlbnQAAAABAAAAAAAAABVuZXdfcmViYWxhbmNlX21hbmFnZXIAAAAAAAAT",
        "AAAAAgAAAAAAAAAAAAAAC0luc3RydWN0aW9uAAAAAAQAAAABAAAAH1dpdGhkcmF3IGZ1bmRzIGZyb20gYSBzdHJhdGVneS4AAAAABlVud2luZAAAAAAAAgAAABMAAAALAAAAAQAAAB1JbnZlc3QgZnVuZHMgaW50byBhIHN0cmF0ZWd5LgAAAAAAAAZJbnZlc3QAAAAAAAIAAAATAAAACwAAAAEAAAAqUGVyZm9ybSBhIHN3YXAgd2l0aCBhbiBleGFjdCBpbnB1dCBhbW91bnQuAAAAAAALU3dhcEV4YWN0SW4AAAAABQAAABMAAAATAAAACwAAAAsAAAAGAAAAAQAAACtQZXJmb3JtIGEgc3dhcCB3aXRoIGFuIGV4YWN0IG91dHB1dCBhbW91bnQuAAAAAAxTd2FwRXhhY3RPdXQAAAAFAAAAEwAAABMAAAALAAAACwAAAAY=",
        "AAAAAQAAAAAAAAAAAAAAElN0cmF0ZWd5QWxsb2NhdGlvbgAAAAAAAwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAZwYXVzZWQAAAAAAAEAAAAAAAAAEHN0cmF0ZWd5X2FkZHJlc3MAAAAT",
        "AAAAAQAAAAAAAAAAAAAAGUFzc2V0SW52ZXN0bWVudEFsbG9jYXRpb24AAAAAAAACAAAAAAAAAAVhc3NldAAAAAAAABMAAAAAAAAAFHN0cmF0ZWd5X2FsbG9jYXRpb25zAAAD6gAAA+gAAAfQAAAAElN0cmF0ZWd5QWxsb2NhdGlvbgAA",
        "AAAAAQAAAAAAAAAAAAAAIEN1cnJlbnRBc3NldEludmVzdG1lbnRBbGxvY2F0aW9uAAAABQAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAtpZGxlX2Ftb3VudAAAAAALAAAAAAAAAA9pbnZlc3RlZF9hbW91bnQAAAAACwAAAAAAAAAUc3RyYXRlZ3lfYWxsb2NhdGlvbnMAAAPqAAAH0AAAABJTdHJhdGVneUFsbG9jYXRpb24AAAAAAAAAAAAMdG90YWxfYW1vdW50AAAACw==",
        "AAAAAQAAAAAAAAAAAAAABlJlcG9ydAAAAAAAAwAAAAAAAAAPZ2FpbnNfb3JfbG9zc2VzAAAAAAsAAAAAAAAACmxvY2tlZF9mZWUAAAAAAAsAAAAAAAAADHByZXZfYmFsYW5jZQAAAAs=",
        "AAAAAQAAAAAAAAAAAAAACFN0cmF0ZWd5AAAAAwAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGcGF1c2VkAAAAAAAB",
        "AAAAAQAAAAAAAAAAAAAAEEFzc2V0U3RyYXRlZ3lTZXQAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAACnN0cmF0ZWdpZXMAAAAAA+oAAAfQAAAACFN0cmF0ZWd5",
        "AAAABAAAAAAAAAAAAAAADVN0cmF0ZWd5RXJyb3IAAAAAAAATAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAABkQAAAAAAAAASTmVnYXRpdmVOb3RBbGxvd2VkAAAAAAGaAAAAAAAAAA9JbnZhbGlkQXJndW1lbnQAAAABmwAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAGcAAAAAAAAABFVbmRlcmZsb3dPdmVyZmxvdwAAAAAAAZ0AAAAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAGeAAAAAAAAAA5EaXZpc2lvbkJ5WmVybwAAAAABnwAAAAAAAAATSW52YWxpZFNoYXJlc01pbnRlZAAAAAGgAAAAAAAAABlPbmx5UG9zaXRpdmVBbW91bnRBbGxvd2VkAAAAAAABoQAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAaIAAAAAAAAAF1Byb3RvY29sQWRkcmVzc05vdEZvdW5kAAAAAaQAAAAAAAAAD0RlYWRsaW5lRXhwaXJlZAAAAAGlAAAAAAAAAA1FeHRlcm5hbEVycm9yAAAAAAABpgAAAAAAAAARU29yb3N3YXBQYWlyRXJyb3IAAAAAAAGnAAAAAAAAABJBbW91bnRCZWxvd01pbkR1c3QAAAAAAcMAAAAAAAAAGFVuZGVybHlpbmdBbW91bnRCZWxvd01pbgAAAcQAAAAAAAAAFUJUb2tlbnNBbW91bnRCZWxvd01pbgAAAAAAAcUAAAAAAAAAEUludGVybmFsU3dhcEVycm9yAAAAAAABxgAAAAAAAAAOU3VwcGx5Tm90Rm91bmQAAAAAAcc=",
        "AAAAAQAAAAAAAAAAAAAADERlcG9zaXRFdmVudAAAAAIAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAEZnJvbQAAABM=",
        "AAAAAQAAAAAAAAAAAAAADEhhcnZlc3RFdmVudAAAAAMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAD3ByaWNlX3Blcl9zaGFyZQAAAAAL",
        "AAAAAQAAAAAAAAAAAAAADVdpdGhkcmF3RXZlbnQAAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAABGZyb20AAAAT",
        "AAAAAQAAAAAAAAAAAAAADVRva2VuTWV0YWRhdGEAAAAAAAADAAAAAAAAAAdkZWNpbWFsAAAAAAQAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAZzeW1ib2wAAAAAABA=",
        "AAAAAAAAAcVHaXZlbiBzb21lIGFtb3VudCBvZiBhbiBhc3NldCBhbmQgcGFpciByZXNlcnZlcywgcmV0dXJucyBhbiBlcXVpdmFsZW50IGFtb3VudCBvZiB0aGUgb3RoZXIgYXNzZXQuCgojIEFyZ3VtZW50cwoKKiBgYW1vdW50X2FgIC0gVGhlIGFtb3VudCBvZiB0aGUgZmlyc3QgYXNzZXQuCiogYHJlc2VydmVfYWAgLSBSZXNlcnZlcyBvZiB0aGUgZmlyc3QgYXNzZXQgaW4gdGhlIHBhaXIuCiogYHJlc2VydmVfYmAgLSBSZXNlcnZlcyBvZiB0aGUgc2Vjb25kIGFzc2V0IGluIHRoZSBwYWlyLgoKIyBSZXR1cm5zCgpSZXR1cm5zIGBSZXN1bHQ8aTEyOCwgU29yb3N3YXBMaWJyYXJ5RXJyb3I+YCB3aGVyZSBgT2tgIGNvbnRhaW5zIHRoZSBjYWxjdWxhdGVkIGVxdWl2YWxlbnQgYW1vdW50LCBhbmQgYEVycmAgaW5kaWNhdGVzIGFuIGVycm9yIHN1Y2ggYXMgaW5zdWZmaWNpZW50IGFtb3VudCBvciBsaXF1aWRpdHkAAAAAAAAFcXVvdGUAAAAAAAADAAAAAAAAAAhhbW91bnRfYQAAAAsAAAAAAAAACXJlc2VydmVfYQAAAAAAAAsAAAAAAAAACXJlc2VydmVfYgAAAAAAAAsAAAABAAAD6QAAAAsAAAfQAAAAFFNvcm9zd2FwTGlicmFyeUVycm9y",
        "AAAAAAAAAgRDYWxjdWxhdGVzIHRoZSBkZXRlcm1pbmlzdGljIGFkZHJlc3MgZm9yIGEgcGFpciB3aXRob3V0IG1ha2luZyBhbnkgZXh0ZXJuYWwgY2FsbHMuCmNoZWNrIDxodHRwczovL2dpdGh1Yi5jb20vcGFsdGFsYWJzL2RldGVybWluaXN0aWMtYWRkcmVzcy1zb3JvYmFuPgoKIyBBcmd1bWVudHMKCiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoqIGBmYWN0b3J5YCAtIFRoZSBmYWN0b3J5IGFkZHJlc3MuCiogYHRva2VuX2FgIC0gVGhlIGFkZHJlc3Mgb2YgdGhlIGZpcnN0IHRva2VuLgoqIGB0b2tlbl9iYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBzZWNvbmQgdG9rZW4uCgojIFJldHVybnMKClJldHVybnMgYFJlc3VsdDxBZGRyZXNzLCBTb3Jvc3dhcExpYnJhcnlFcnJvcj5gIHdoZXJlIGBPa2AgY29udGFpbnMgdGhlIGRldGVybWluaXN0aWMgYWRkcmVzcyBmb3IgdGhlIHBhaXIsIGFuZCBgRXJyYCBpbmRpY2F0ZXMgYW4gZXJyb3Igc3VjaCBhcyBpZGVudGljYWwgdG9rZW5zIG9yIGFuIGlzc3VlIHdpdGggc29ydGluZy4AAAAIcGFpcl9mb3IAAAADAAAAAAAAAAdmYWN0b3J5AAAAABMAAAAAAAAAB3Rva2VuX2EAAAAAEwAAAAAAAAAHdG9rZW5fYgAAAAATAAAAAQAAA+kAAAATAAAH0AAAABRTb3Jvc3dhcExpYnJhcnlFcnJvcg==",
        "AAAAAAAAAVZTb3J0cyB0d28gdG9rZW4gYWRkcmVzc2VzIGluIGEgY29uc2lzdGVudCBvcmRlci4KCiMgQXJndW1lbnRzCgoqIGB0b2tlbl9hYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBmaXJzdCB0b2tlbi4KKiBgdG9rZW5fYmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgc2Vjb25kIHRva2VuLgoKIyBSZXR1cm5zCgpSZXR1cm5zIGBSZXN1bHQ8KEFkZHJlc3MsIEFkZHJlc3MpLCBTb3Jvc3dhcExpYnJhcnlFcnJvcj5gIHdoZXJlIGBPa2AgY29udGFpbnMgYSB0dXBsZSB3aXRoIHRoZSBzb3J0ZWQgdG9rZW4gYWRkcmVzc2VzLCBhbmQgYEVycmAgaW5kaWNhdGVzIGFuIGVycm9yIHN1Y2ggYXMgaWRlbnRpY2FsIHRva2Vucy4AAAAAAAtzb3J0X3Rva2VucwAAAAACAAAAAAAAAAd0b2tlbl9hAAAAABMAAAAAAAAAB3Rva2VuX2IAAAAAEwAAAAEAAAPpAAAD7QAAAAIAAAATAAAAEwAAB9AAAAAUU29yb3N3YXBMaWJyYXJ5RXJyb3I=",
        "AAAAAAAAAdRHaXZlbiBhbiBvdXRwdXQgYW1vdW50IG9mIGFuIGFzc2V0IGFuZCBwYWlyIHJlc2VydmVzLCByZXR1cm5zIGEgcmVxdWlyZWQgaW5wdXQgYW1vdW50IG9mIHRoZSBvdGhlciBhc3NldC4KCiMgQXJndW1lbnRzCgoqIGBhbW91bnRfb3V0YCAtIFRoZSBvdXRwdXQgYW1vdW50IG9mIHRoZSBhc3NldC4KKiBgcmVzZXJ2ZV9pbmAgLSBSZXNlcnZlcyBvZiB0aGUgaW5wdXQgYXNzZXQgaW4gdGhlIHBhaXIuCiogYHJlc2VydmVfb3V0YCAtIFJlc2VydmVzIG9mIHRoZSBvdXRwdXQgYXNzZXQgaW4gdGhlIHBhaXIuCgojIFJldHVybnMKClJldHVybnMgYFJlc3VsdDxpMTI4LCBTb3Jvc3dhcExpYnJhcnlFcnJvcj5gIHdoZXJlIGBPa2AgY29udGFpbnMgdGhlIHJlcXVpcmVkIGlucHV0IGFtb3VudCwgYW5kIGBFcnJgIGluZGljYXRlcyBhbiBlcnJvciBzdWNoIGFzIGluc3VmZmljaWVudCBvdXRwdXQgYW1vdW50IG9yIGxpcXVpZGl0eS4AAAANZ2V0X2Ftb3VudF9pbgAAAAAAAAMAAAAAAAAACmFtb3VudF9vdXQAAAAAAAsAAAAAAAAACnJlc2VydmVfaW4AAAAAAAsAAAAAAAAAC3Jlc2VydmVfb3V0AAAAAAsAAAABAAAD6QAAAAsAAAfQAAAAFFNvcm9zd2FwTGlicmFyeUVycm9y",
        "AAAAAAAAAZVQZXJmb3JtcyBjaGFpbmVkIGdldF9hbW91bnRfaW4gY2FsY3VsYXRpb25zIG9uIGFueSBudW1iZXIgb2YgcGFpcnMuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBUaGUgZW52aXJvbm1lbnQuCiogYGZhY3RvcnlgIC0gVGhlIGZhY3RvcnkgYWRkcmVzcy4KKiBgYW1vdW50X291dGAgLSBUaGUgb3V0cHV0IGFtb3VudC4KKiBgcGF0aGAgLSBWZWN0b3Igb2YgdG9rZW4gYWRkcmVzc2VzIHJlcHJlc2VudGluZyB0aGUgcGF0aC4KCiMgUmV0dXJucwoKUmV0dXJucyBgUmVzdWx0PFZlYzxpMTI4PiwgU29yb3N3YXBMaWJyYXJ5RXJyb3I+YCB3aGVyZSBgT2tgIGNvbnRhaW5zIGEgdmVjdG9yIG9mIGNhbGN1bGF0ZWQgYW1vdW50cywgYW5kIGBFcnJgIGluZGljYXRlcyBhbiBlcnJvciBzdWNoIGFzIGFuIGludmFsaWQgcGF0aC4AAAAAAAAOZ2V0X2Ftb3VudHNfaW4AAAAAAAMAAAAAAAAAB2ZhY3RvcnkAAAAAEwAAAAAAAAAKYW1vdW50X291dAAAAAAACwAAAAAAAAAEcGF0aAAAA+oAAAATAAAAAQAAA+kAAAPqAAAACwAAB9AAAAAUU29yb3N3YXBMaWJyYXJ5RXJyb3I=",
        "AAAAAAAAAd1HaXZlbiBhbiBpbnB1dCBhbW91bnQgb2YgYW4gYXNzZXQgYW5kIHBhaXIgcmVzZXJ2ZXMsIHJldHVybnMgdGhlIG1heGltdW0gb3V0cHV0IGFtb3VudCBvZiB0aGUgb3RoZXIgYXNzZXQuCgojIEFyZ3VtZW50cwoKKiBgYW1vdW50X2luYCAtIFRoZSBpbnB1dCBhbW91bnQgb2YgdGhlIGFzc2V0LgoqIGByZXNlcnZlX2luYCAtIFJlc2VydmVzIG9mIHRoZSBpbnB1dCBhc3NldCBpbiB0aGUgcGFpci4KKiBgcmVzZXJ2ZV9vdXRgIC0gUmVzZXJ2ZXMgb2YgdGhlIG91dHB1dCBhc3NldCBpbiB0aGUgcGFpci4KCiMgUmV0dXJucwoKUmV0dXJucyBgUmVzdWx0PGkxMjgsIFNvcm9zd2FwTGlicmFyeUVycm9yPmAgd2hlcmUgYE9rYCBjb250YWlucyB0aGUgY2FsY3VsYXRlZCBtYXhpbXVtIG91dHB1dCBhbW91bnQsIGFuZCBgRXJyYCBpbmRpY2F0ZXMgYW4gZXJyb3Igc3VjaCBhcyBpbnN1ZmZpY2llbnQgaW5wdXQgYW1vdW50IG9yIGxpcXVpZGl0eS4AAAAAAAAOZ2V0X2Ftb3VudF9vdXQAAAAAAAMAAAAAAAAACWFtb3VudF9pbgAAAAAAAAsAAAAAAAAACnJlc2VydmVfaW4AAAAAAAsAAAAAAAAAC3Jlc2VydmVfb3V0AAAAAAsAAAABAAAD6QAAAAsAAAfQAAAAFFNvcm9zd2FwTGlicmFyeUVycm9y",
        "AAAAAAAAAZRQZXJmb3JtcyBjaGFpbmVkIGdldF9hbW91bnRfb3V0IGNhbGN1bGF0aW9ucyBvbiBhbnkgbnVtYmVyIG9mIHBhaXJzLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gVGhlIGVudmlyb25tZW50LgoqIGBmYWN0b3J5YCAtIFRoZSBmYWN0b3J5IGFkZHJlc3MuCiogYGFtb3VudF9pbmAgLSBUaGUgaW5wdXQgYW1vdW50LgoqIGBwYXRoYCAtIFZlY3RvciBvZiB0b2tlbiBhZGRyZXNzZXMgcmVwcmVzZW50aW5nIHRoZSBwYXRoLgoKIyBSZXR1cm5zCgpSZXR1cm5zIGBSZXN1bHQ8VmVjPGkxMjg+LCBTb3Jvc3dhcExpYnJhcnlFcnJvcj5gIHdoZXJlIGBPa2AgY29udGFpbnMgYSB2ZWN0b3Igb2YgY2FsY3VsYXRlZCBhbW91bnRzLCBhbmQgYEVycmAgaW5kaWNhdGVzIGFuIGVycm9yIHN1Y2ggYXMgYW4gaW52YWxpZCBwYXRoLgAAAA9nZXRfYW1vdW50c19vdXQAAAAAAwAAAAAAAAAHZmFjdG9yeQAAAAATAAAAAAAAAAlhbW91bnRfaW4AAAAAAAALAAAAAAAAAARwYXRoAAAD6gAAABMAAAABAAAD6QAAA+oAAAALAAAH0AAAABRTb3Jvc3dhcExpYnJhcnlFcnJvcg==",
        "AAAAAAAAAa1GZXRjaGVzIGFuZCBzb3J0cyB0aGUgcmVzZXJ2ZXMgZm9yIGEgcGFpciBvZiB0b2tlbnMgdXNpbmcgdGhlIHBhaXIgYWRkcmVzcy4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIFRoZSBlbnZpcm9ubWVudC4KKiBgcGFpcmAgLSBUaGUgcGFpciBhZGRyZXNzLgoqIGB0b2tlbl9hYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBmaXJzdCB0b2tlbi4KKiBgdG9rZW5fYmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgc2Vjb25kIHRva2VuLgoKIyBSZXR1cm5zCgpSZXR1cm5zIGBSZXN1bHQ8KGkxMjgsIGkxMjgpLCBTb3Jvc3dhcExpYnJhcnlFcnJvcj5gIHdoZXJlIGBPa2AgY29udGFpbnMgYSB0dXBsZSBvZiBzb3J0ZWQgcmVzZXJ2ZXMsIGFuZCBgRXJyYCBpbmRpY2F0ZXMgYW4gZXJyb3Igc3VjaCBhcyBpZGVudGljYWwgdG9rZW5zIG9yIGFuIGlzc3VlIHdpdGggc29ydGluZy4AAAAAAAAWZ2V0X3Jlc2VydmVzX3dpdGhfcGFpcgAAAAAAAwAAAAAAAAAEcGFpcgAAABMAAAAAAAAAB3Rva2VuX2EAAAAAEwAAAAAAAAAHdG9rZW5fYgAAAAATAAAAAQAAA+kAAAPtAAAAAgAAAAsAAAALAAAH0AAAABRTb3Jvc3dhcExpYnJhcnlFcnJvcg==",
        "AAAAAAAAAbZGZXRjaGVzIGFuZCBzb3J0cyB0aGUgcmVzZXJ2ZXMgZm9yIGEgcGFpciBvZiB0b2tlbnMgdXNpbmcgdGhlIGZhY3RvcnkgYWRkcmVzcy4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIFRoZSBlbnZpcm9ubWVudC4KKiBgZmFjdG9yeWAgLSBUaGUgZmFjdG9yeSBhZGRyZXNzLgoqIGB0b2tlbl9hYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBmaXJzdCB0b2tlbi4KKiBgdG9rZW5fYmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgc2Vjb25kIHRva2VuLgoKIyBSZXR1cm5zCgpSZXR1cm5zIGBSZXN1bHQ8KGkxMjgsIGkxMjgpLCBTb3Jvc3dhcExpYnJhcnlFcnJvcj5gIHdoZXJlIGBPa2AgY29udGFpbnMgYSB0dXBsZSBvZiBzb3J0ZWQgcmVzZXJ2ZXMsIGFuZCBgRXJyYCBpbmRpY2F0ZXMgYW4gZXJyb3Igc3VjaCBhcyBpZGVudGljYWwgdG9rZW5zIG9yIGFuIGlzc3VlIHdpdGggc29ydGluZy4AAAAAABlnZXRfcmVzZXJ2ZXNfd2l0aF9mYWN0b3J5AAAAAAAAAwAAAAAAAAAHZmFjdG9yeQAAAAATAAAAAAAAAAd0b2tlbl9hAAAAABMAAAAAAAAAB3Rva2VuX2IAAAAAEwAAAAEAAAPpAAAD7QAAAAIAAAALAAAACwAAB9AAAAAUU29yb3N3YXBMaWJyYXJ5RXJyb3I=",
        "AAAABAAAAAAAAAAAAAAAFFNvcm9zd2FwTGlicmFyeUVycm9yAAAABgAAACRTb3Jvc3dhcExpYnJhcnk6IGluc3VmZmljaWVudCBhbW91bnQAAAASSW5zdWZmaWNpZW50QW1vdW50AAAAAAEtAAAAJ1Nvcm9zd2FwTGlicmFyeTogaW5zdWZmaWNpZW50IGxpcXVpZGl0eQAAAAAVSW5zdWZmaWNpZW50TGlxdWlkaXR5AAAAAAABLgAAACpTb3Jvc3dhcExpYnJhcnk6IGluc3VmZmljaWVudCBpbnB1dCBhbW91bnQAAAAAABdJbnN1ZmZpY2llbnRJbnB1dEFtb3VudAAAAAEvAAAAK1Nvcm9zd2FwTGlicmFyeTogaW5zdWZmaWNpZW50IG91dHB1dCBhbW91bnQAAAAAGEluc3VmZmljaWVudE91dHB1dEFtb3VudAAAATAAAAAdU29yb3N3YXBMaWJyYXJ5OiBpbnZhbGlkIHBhdGgAAAAAAAALSW52YWxpZFBhdGgAAAABMQAAAD1Tb3Jvc3dhcExpYnJhcnk6IHRva2VuX2EgYW5kIHRva2VuX2IgaGF2ZSBpZGVudGljYWwgYWRkcmVzc2VzAAAAAAAAE1NvcnRJZGVudGljYWxUb2tlbnMAAAABMg==",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    report: this.txFromJSON<Result<Array<Report>>>,
    rescue: this.txFromJSON<Result<void>>,
    deposit: this.txFromJSON<
      Result<
        readonly [
          Array<i128>,
          i128,
          Option<Array<Option<AssetInvestmentAllocation>>>,
        ]
      >
    >,
    upgrade: this.txFromJSON<Result<void>>,
    get_fees: this.txFromJSON<readonly [u32, u32]>,
    withdraw: this.txFromJSON<Result<Array<i128>>>,
    lock_fees: this.txFromJSON<Result<Array<Report>>>,
    rebalance: this.txFromJSON<Result<void>>,
    get_assets: this.txFromJSON<Result<Array<AssetStrategySet>>>,
    get_manager: this.txFromJSON<Result<string>>,
    set_manager: this.txFromJSON<Result<void>>,
    release_fees: this.txFromJSON<Result<Report>>,
    pause_strategy: this.txFromJSON<Result<void>>,
    distribute_fees: this.txFromJSON<Result<Array<readonly [string, i128]>>>,
    get_fee_receiver: this.txFromJSON<Result<string>>,
    set_fee_receiver: this.txFromJSON<null>,
    unpause_strategy: this.txFromJSON<Result<void>>,
    get_emergency_manager: this.txFromJSON<Result<string>>,
    get_rebalance_manager: this.txFromJSON<Result<string>>,
    set_emergency_manager: this.txFromJSON<null>,
    set_rebalance_manager: this.txFromJSON<null>,
    fetch_total_managed_funds: this.txFromJSON<
      Result<Array<CurrentAssetInvestmentAllocation>>
    >,
    get_asset_amounts_per_shares: this.txFromJSON<Result<Array<i128>>>,
    burn: this.txFromJSON<null>,
    name: this.txFromJSON<string>,
    symbol: this.txFromJSON<string>,
    approve: this.txFromJSON<null>,
    balance: this.txFromJSON<i128>,
    decimals: this.txFromJSON<u32>,
    transfer: this.txFromJSON<null>,
    allowance: this.txFromJSON<i128>,
    burn_from: this.txFromJSON<null>,
    total_supply: this.txFromJSON<i128>,
    transfer_from: this.txFromJSON<null>,
    quote: this.txFromJSON<Result<i128>>,
    pair_for: this.txFromJSON<Result<string>>,
    sort_tokens: this.txFromJSON<Result<readonly [string, string]>>,
    get_amount_in: this.txFromJSON<Result<i128>>,
    get_amounts_in: this.txFromJSON<Result<Array<i128>>>,
    get_amount_out: this.txFromJSON<Result<i128>>,
    get_amounts_out: this.txFromJSON<Result<Array<i128>>>,
    get_reserves_with_pair: this.txFromJSON<Result<readonly [i128, i128]>>,
    get_reserves_with_factory: this.txFromJSON<Result<readonly [i128, i128]>>,
  };
}
