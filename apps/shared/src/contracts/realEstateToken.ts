import type {
  AssembledTransaction,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import type { Client as CombinedContractClient } from "./generated/rwaDefi";
import { Client as GeneratedRwaDefiClient } from "./generated/rwaDefi";
import {
  buildContractClientOptions,
  type SorobanClientConfig,
} from "./clientConfig";

export interface MintSharesArgs {
  admin: string;
  propertyId: bigint;
  recipient: string;
  amount: bigint;
}

export interface ShareBalanceArgs {
  propertyId: bigint;
  owner: string;
}

export interface TransferSharesArgs {
  from: string;
  to: string;
  propertyId: bigint;
  amount: bigint;
}

export interface ApproveSharesArgs {
  owner: string;
  spender: string;
  propertyId: bigint;
  amount: bigint;
}

export interface TransferFromSharesArgs extends TransferSharesArgs {
  spender: string;
}

export interface PurchaseSharesArgs {
  buyer: string;
  propertyId: bigint;
  amount: bigint;
  paymentToken: string;
}

function toU64(value: bigint): bigint {
  return value;
}

export class RealEstateTokenContractClient {
  constructor(private readonly client: CombinedContractClient) {}

  static fromConfig(
    config: SorobanClientConfig,
  ): RealEstateTokenContractClient {
    return new RealEstateTokenContractClient(
      new GeneratedRwaDefiClient(buildContractClientOptions(config)),
    );
  }

  mintShares(
    args: MintSharesArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.mint_shares(
      {
        admin: args.admin,
        property_id: toU64(args.propertyId),
        recipient: args.recipient,
        amount: toU64(args.amount),
      },
      options,
    );
  }

  burnShares(
    args: Omit<MintSharesArgs, "admin" | "recipient"> & { owner: string },
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.burn_shares(
      {
        owner: args.owner,
        property_id: toU64(args.propertyId),
        amount: toU64(args.amount),
      },
      options,
    );
  }

  getBalance(
    args: ShareBalanceArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.get_balance(
      {
        property_id: toU64(args.propertyId),
        owner: args.owner,
      },
      options,
    );
  }

  getTotalShares(
    propertyId: bigint,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.get_total_shares(
      {
        property_id: toU64(propertyId),
      },
      options,
    );
  }

  transferShares(
    args: TransferSharesArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.transfer_shares(
      {
        from: args.from,
        to: args.to,
        property_id: toU64(args.propertyId),
        amount: toU64(args.amount),
      },
      options,
    );
  }

  approve(
    args: ApproveSharesArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.approve(
      {
        owner: args.owner,
        spender: args.spender,
        property_id: toU64(args.propertyId),
        amount: toU64(args.amount),
      },
      options,
    );
  }

  transferFrom(
    args: TransferFromSharesArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.transfer_from(
      {
        spender: args.spender,
        from: args.from,
        to: args.to,
        property_id: toU64(args.propertyId),
        amount: toU64(args.amount),
      },
      options,
    );
  }

  purchaseShares(
    args: PurchaseSharesArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.purchase_shares(
      {
        buyer: args.buyer,
        property_id: toU64(args.propertyId),
        amount: toU64(args.amount),
        payment_token: args.paymentToken,
      },
      options,
    );
  }
}
