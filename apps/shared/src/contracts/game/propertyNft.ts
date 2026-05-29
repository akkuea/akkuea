// Generated from WASM using Stellar SDK
// Contract: PropertyNFT
// DO NOT EDIT - Regenerate using /tmp/generate_clients.js if contract changes

import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import { Client as ContractClient, Spec as ContractSpec } from "@stellar/stellar-sdk/contract";
import type { AssembledTransaction, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
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
  Duration,
} from "@stellar/stellar-sdk/contract";




export interface PropertyNftClient {
}
export class PropertyNftClient extends ContractClient {
  static async deploy<T = PropertyNftClient>(
    args: Record<string, any> | null,
    deployOptions: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        wasmHash: Buffer | string;
        salt?: Buffer | Uint8Array;
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(args, deployOptions);
  }

  constructor(override readonly options: ContractClientOptions) {
    super(
      new ContractSpec([]),
      options
    );
  }
}
