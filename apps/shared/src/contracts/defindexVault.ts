import type { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import {
  Client as GeneratedDefindexVaultClient,
  ContractError as VAULT_CONTRACT_ERRORS,
  StrategyError as VAULT_STRATEGY_ERRORS,
  type AssetStrategySet,
  type CurrentAssetInvestmentAllocation,
} from "./generated/defindexVault";
import {
  buildContractClientOptions,
  type SorobanClientConfig,
} from "./clientConfig";

export type {
  AssetStrategySet,
  CurrentAssetInvestmentAllocation,
  StrategyAllocation,
} from "./generated/defindexVault";

/**
 * Per-call transaction knobs accepted by the generated bindings. Declared here
 * rather than reusing the SDK's `MethodOptions` because the bindings type `fee`
 * as a number, while `MethodOptions` types it as a string.
 */
export interface VaultMethodOptions {
  /** Max fee to pay, in stroops. */
  fee?: number;
  /** How long the transaction stays valid for, in seconds. */
  timeoutInSeconds?: number;
  /** Set `false` to assemble without simulating. */
  simulate?: boolean;
}

export interface VaultDepositArgs {
  /** Desired amount of each underlying asset, in the asset's smallest unit. */
  amountsDesired: bigint[];
  /** Slippage floor per asset; the vault reverts if it can't transfer this much. */
  amountsMin: bigint[];
  /** Address the assets are pulled from, and that receives the dfTokens. */
  from: string;
  /**
   * `true` routes the deposit straight into the vault's strategies.
   * `false` leaves it as idle funds inside the vault.
   */
  invest: boolean;
}

export interface VaultWithdrawArgs {
  /** Number of dfToken shares to burn. */
  withdrawShares: bigint;
  /** Minimum amount of each underlying asset the caller will accept. */
  minAmountsOut: bigint[];
  /** Address burning the shares and receiving the underlying assets. */
  from: string;
}

/**
 * A vault call that failed inside the contract, with the on-chain error code
 * resolved to its declared name where possible.
 *
 * Soroban surfaces two shapes of failure through the JS SDK:
 *   - a declared `Result::Err`, which the bindings hand back as an `Err` value;
 *   - a host trap (`Error(Contract, #N)`), thrown from `simulate`/`signAndSend`,
 *     which is what a nested call — a strategy, or the underlying token — does
 *     when it fails.
 *
 * Both end up here so callers only have to handle one thing.
 */
export class DefindexVaultError extends Error {
  constructor(
    /** Declared error name (`StrategyPaused`, `InsufficientBalance`, …) or `Unknown`. */
    public readonly errorName: string,
    /** Raw contract error code, when one could be parsed out. */
    public readonly errorCode: number | undefined,
    /** Which contract the code belongs to. */
    public readonly source: "vault" | "strategy" | "token" | "unknown",
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DefindexVaultError";
    Object.setPrototypeOf(this, DefindexVaultError.prototype);
  }
}

/**
 * Stellar Asset Contract error codes. Deposits and withdrawals bottom out in a
 * SAC `transfer`, so these are the codes a treasury deposit actually trips on
 * before it ever reaches vault logic.
 *
 * Source: soroban-env-host `ContractError` for the built-in token contract.
 */
const TOKEN_CONTRACT_ERRORS: Record<number, string> = {
  8: "InternalError",
  9: "OperationNotSupported",
  10: "BalanceError",
  11: "BalanceDeauthorizedError",
  12: "OverflowError",
  13: "TrustlineMissingError",
};

/** Vault error codes start at 100; strategy codes at 401; SAC codes below 100. */
function classifyErrorCode(code: number): {
  errorName: string;
  source: DefindexVaultError["source"];
} {
  const vaultName = (
    VAULT_CONTRACT_ERRORS as Record<number, { message: string }>
  )[code]?.message;
  if (vaultName) {
    return { errorName: vaultName, source: "vault" };
  }

  const strategyName = (
    VAULT_STRATEGY_ERRORS as Record<number, { message: string }>
  )[code]?.message;
  if (strategyName) {
    return { errorName: strategyName, source: "strategy" };
  }

  const tokenName = TOKEN_CONTRACT_ERRORS[code];
  if (tokenName) {
    return { errorName: tokenName, source: "token" };
  }

  return { errorName: "Unknown", source: "unknown" };
}

/**
 * Turn anything thrown by a vault call into a {@link DefindexVaultError}.
 *
 * Host traps arrive as an `Error` whose message embeds `Error(Contract, #N)`;
 * that code is the only machine-readable part, so it is what we key on.
 */
export function toDefindexVaultError(error: unknown): DefindexVaultError {
  if (error instanceof DefindexVaultError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  const codeMatch = /Error\(Contract,\s*#(\d+)\)/.exec(message);

  if (!codeMatch) {
    return new DefindexVaultError(
      "Unknown",
      undefined,
      "unknown",
      message,
      error,
    );
  }

  const code = Number(codeMatch[1]);
  const { errorName, source } = classifyErrorCode(code);

  return new DefindexVaultError(
    errorName,
    code,
    source,
    `DeFindex vault call failed with ${source} error #${code} (${errorName})`,
    error,
  );
}

/**
 * Typed client for a DeFindex Vault (the `dfToken` contract).
 *
 * Wraps the generated bindings the way {@link DefiLendingContractClient} wraps
 * the platform's own lending contract: camelCase args, `bigint` amounts, and
 * read helpers that simulate and hand back plain values instead of an
 * `AssembledTransaction`.
 */
export class DefindexVaultContractClient {
  constructor(private readonly client: GeneratedDefindexVaultClient) {}

  static fromConfig(config: SorobanClientConfig): DefindexVaultContractClient {
    return new DefindexVaultContractClient(
      new GeneratedDefindexVaultClient(buildContractClientOptions(config)),
    );
  }

  /**
   * Build a `deposit` transaction, already simulated.
   *
   * A vault that would reject the deposit fails here rather than at submit
   * time, so the caller never signs a transaction that cannot land.
   */
  async deposit(
    args: VaultDepositArgs,
    options?: VaultMethodOptions,
  ): Promise<AssembledTransaction<unknown>> {
    return this.assemble(() =>
      this.client.deposit(
        {
          amounts_desired: args.amountsDesired,
          amounts_min: args.amountsMin,
          from: args.from,
          invest: args.invest,
        },
        options,
      ),
    );
  }

  /** Build a simulated `withdraw` transaction that burns `withdrawShares` dfTokens. */
  async withdraw(
    args: VaultWithdrawArgs,
    options?: VaultMethodOptions,
  ): Promise<AssembledTransaction<unknown>> {
    return this.assemble(() =>
      this.client.withdraw(
        {
          withdraw_shares: args.withdrawShares,
          min_amounts_out: args.minAmountsOut,
          from: args.from,
        },
        options,
      ),
    );
  }

  /**
   * Assemble a write call and surface a failed simulation immediately.
   *
   * The SDK builds the transaction without throwing when simulation fails; the
   * error only appears when `simulationData` is read, which for an unwary
   * caller is at `signAndSend`. Reading it here moves a contract rejection —
   * a paused strategy, an unfunded treasury account — to the point where the
   * call is made, where it can still be handled.
   */
  private async assemble(
    call: () => Promise<AssembledTransaction<unknown>>,
  ): Promise<AssembledTransaction<unknown>> {
    try {
      const transaction = await call();
      void transaction.simulationData;
      return transaction;
    } catch (error) {
      throw toDefindexVaultError(error);
    }
  }

  /** dfToken (share) balance held by `address`. */
  async balance(address: string): Promise<bigint> {
    return this.read(() => this.client.balance({ id: address }));
  }

  /** Total dfToken supply across every holder. */
  async totalSupply(): Promise<bigint> {
    return this.read(() => this.client.total_supply());
  }

  /** Decimal precision of the dfToken and, for these vaults, of the assets. */
  async decimals(): Promise<number> {
    return this.read(() => this.client.decimals());
  }

  /** dfToken symbol, e.g. `DFXV`. */
  async symbol(): Promise<string> {
    return this.read(() => this.client.symbol());
  }

  /**
   * Every underlying asset the vault manages, with idle vs. invested split and
   * the per-strategy allocation — including each strategy's `paused` flag.
   */
  async fetchTotalManagedFunds(): Promise<CurrentAssetInvestmentAllocation[]> {
    return this.readResult(() => this.client.fetch_total_managed_funds());
  }

  /** Underlying-asset amounts backing `vaultShares` dfTokens right now. */
  async getAssetAmountsPerShares(vaultShares: bigint): Promise<bigint[]> {
    return this.readResult(() =>
      this.client.get_asset_amounts_per_shares({ vault_shares: vaultShares }),
    );
  }

  /** Assets and the strategies configured for each. */
  async getAssets(): Promise<AssetStrategySet[]> {
    return this.readResult(() => this.client.get_assets());
  }

  /** `[vaultFeeBps, defindexProtocolFeeBps]`. */
  async getFees(): Promise<[number, number]> {
    const fees = await this.read(() => this.client.get_fees());
    return [fees[0], fees[1]];
  }

  /** Simulate a plain-valued read and return the value. */
  private async read<T>(
    call: () => Promise<AssembledTransaction<T>>,
  ): Promise<T> {
    try {
      const tx = await call();
      return tx.result;
    } catch (error) {
      throw toDefindexVaultError(error);
    }
  }

  /** Simulate a `Result`-valued read and unwrap it. */
  private async readResult<T>(
    call: () => Promise<
      AssembledTransaction<{
        unwrap(): T;
        isErr(): boolean;
        unwrapErr(): { message: string };
      }>
    >,
  ): Promise<T> {
    try {
      const tx = await call();
      const result = tx.result;
      if (result.isErr()) {
        const { message } = result.unwrapErr();
        throw new DefindexVaultError(
          message,
          undefined,
          "vault",
          `DeFindex vault call failed: ${message}`,
        );
      }
      return result.unwrap();
    } catch (error) {
      throw toDefindexVaultError(error);
    }
  }
}
