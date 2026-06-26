import type {
  AssembledTransaction,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import type { Client as CombinedContractClient } from "./generated/rwaDefi";
import {
  Client as GeneratedRwaDefiClient,
  type BorrowPosition,
  type DepositPosition,
  type LendingPool,
} from "./generated/rwaDefi";
import {
  buildContractClientOptions,
  type SorobanClientConfig,
} from "./clientConfig";

export type {
  BorrowPosition,
  DepositPosition,
  LendingPool,
} from "./generated/rwaDefi";

export interface CreatePoolArgs {
  admin: string;
  poolId: string;
  name: string;
  asset: string;
  assetAddress: string;
  collateralFactor: bigint;
  liquidationThreshold: bigint;
  liquidationPenalty: bigint;
  reserveFactor: number;
}

export interface PoolActionArgs {
  actor: string;
  poolId: string;
  amount: bigint;
}

export interface BorrowArgs extends PoolActionArgs {
  collateralAsset: string;
  collateralAmount: bigint;
}

export interface PoolUserArgs {
  user: string;
  poolId: string;
}

export class DefiLendingContractClient {
  constructor(private readonly client: CombinedContractClient) {}

  static fromConfig(config: SorobanClientConfig): DefiLendingContractClient {
    return new DefiLendingContractClient(
      new GeneratedRwaDefiClient(buildContractClientOptions(config)),
    );
  }

  createPool(
    args: CreatePoolArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.create_pool(
      {
        admin: args.admin,
        pool_id: args.poolId,
        name: args.name,
        asset: args.asset,
        asset_address: args.assetAddress,
        collateral_factor: args.collateralFactor,
        liquidation_threshold: args.liquidationThreshold,
        liquidation_penalty: args.liquidationPenalty,
        reserve_factor: args.reserveFactor,
      },
      options,
    );
  }

  deposit(
    args: PoolActionArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.deposit(
      {
        depositor: args.actor,
        pool_id: args.poolId,
        amount: args.amount,
      },
      options,
    );
  }

  withdraw(
    args: PoolActionArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.withdraw(
      {
        depositor: args.actor,
        pool_id: args.poolId,
        amount: args.amount,
      },
      options,
    );
  }

  borrow(
    args: BorrowArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<BorrowPosition>> {
    return this.client.borrow(
      {
        borrower: args.actor,
        pool_id: args.poolId,
        amount: args.amount,
        collateral_asset: args.collateralAsset,
        collateral_amount: args.collateralAmount,
      },
      options,
    );
  }

  repay(
    args: PoolActionArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<BorrowPosition>> {
    return this.client.repay(
      {
        borrower: args.actor,
        pool_id: args.poolId,
        amount: args.amount,
      },
      options,
    );
  }

  accrueInterest(
    poolId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.accrue_interest(
      {
        pool_id: poolId,
      },
      options,
    );
  }

  getPool(
    poolId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<LendingPool>> {
    return this.client.get_pool(
      {
        pool_id: poolId,
      },
      options,
    );
  }

  getUserDeposits(
    user: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<string[]>> {
    return this.client.get_user_deposits({ user }, options);
  }

  getUserBorrows(
    user: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<string[]>> {
    return this.client.get_user_borrows({ user }, options);
  }

  getTotalDeposits(
    poolId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.get_total_deposits(
      {
        pool_id: poolId,
      },
      options,
    );
  }

  getTotalBorrows(
    poolId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.get_total_borrows(
      {
        pool_id: poolId,
      },
      options,
    );
  }

  getInterestIndex(
    poolId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.get_interest_index(
      {
        pool_id: poolId,
      },
      options,
    );
  }

  getDepositPosition(
    args: PoolUserArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<DepositPosition>> {
    return this.client.get_deposit_position(
      {
        user: args.user,
        pool_id: args.poolId,
      },
      options,
    );
  }

  getBorrowPosition(
    args: PoolUserArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<BorrowPosition>> {
    return this.client.get_borrow_position(
      {
        user: args.user,
        pool_id: args.poolId,
      },
      options,
    );
  }

  setOracle(
    oracleAddress: string,
    caller: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.set_oracle(
      {
        oracle_address: oracleAddress,
        caller,
      },
      options,
    );
  }

  setOracleConfig(
    caller: string,
    maxAge: bigint,
    minPrice: bigint,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.set_oracle_config(
      {
        caller,
        max_age: maxAge,
        min_price: minPrice,
      },
      options,
    );
  }

  getOracleConfig(
    options?: MethodOptions,
  ): Promise<AssembledTransaction<readonly [bigint, bigint]>> {
    return this.client.get_oracle_config(options);
  }
}
