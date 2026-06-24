import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
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
} from "@stellar/stellar-sdk/contract";
// Timepoint and Duration are not exported by stellar-sdk/contract in v13.x
export type Timepoint = bigint;
export type Duration = bigint;
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export type StorageKey =
  | { tag: "NftContract"; values: void }
  | { tag: "TokenContract"; values: void }
  | { tag: "Treasury"; values: void }
  | { tag: "Initialized"; values: void };

export const EngineError = {
  1: { message: "AlreadyInitialized" },
  2: { message: "NotOwner" },
  3: { message: "AlreadyMaxLevel" },
  4: { message: "NothingToClaim" },
  5: { message: "InsufficientBalance" },
};

export interface PropertyState {
  approved: Option<string>;
  id: u32;
  last_claimed_ledger: u64;
  level: u32;
  owner: string;
  x: u32;
  y: u32;
}

export interface Client {
  /**
   * Construct and simulate a improve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  improve: (
    { caller, property_id }: { caller: string; property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (
    {
      nft_contract,
      token_contract,
      treasury,
    }: { nft_contract: string; token_contract: string; treasury: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a claim_rental transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_rental: (
    { caller, property_id }: { caller: string; property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_accrued_income transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_accrued_income: (
    { property_id }: { property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
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
    return ContractClient.deploy(null, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAgAAAAAAAAAAAAAAClN0b3JhZ2VLZXkAAAAAAAQAAAAAAAAAAAAAAAtOZnRDb250cmFjdAAAAAAAAAAAAAAAAA1Ub2tlbkNvbnRyYWN0AAAAAAAAAAAAAAAAAAAIVHJlYXN1cnkAAAAAAAAAAAAAAAtJbml0aWFsaXplZAA=",
        "AAAAAAAAAAAAAAAHaW1wcm92ZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAQAAAAA",
        "AAAABAAAAAAAAAAAAAAAC0VuZ2luZUVycm9yAAAAAAUAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAITm90T3duZXIAAAACAAAAAAAAAA9BbHJlYWR5TWF4TGV2ZWwAAAAAAwAAAAAAAAAOTm90aGluZ1RvQ2xhaW0AAAAAAAQAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAABQ==",
        "AAAAAQAAAAAAAAAAAAAADVByb3BlcnR5U3RhdGUAAAAAAAAHAAAAAAAAAAhhcHByb3ZlZAAAA+gAAAATAAAAAAAAAAJpZAAAAAAABAAAAAAAAAATbGFzdF9jbGFpbWVkX2xlZGdlcgAAAAAGAAAAAAAAAAVsZXZlbAAAAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAABeAAAAAAAAAQAAAAAAAAAAXkAAAAAAAAE",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAMbmZ0X2NvbnRyYWN0AAAAEwAAAAAAAAAOdG9rZW5fY29udHJhY3QAAAAAABMAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAMY2xhaW1fcmVudGFsAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAASZ2V0X2FjY3J1ZWRfaW5jb21lAAAAAAABAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAQAAAAs=",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    improve: this.txFromJSON<null>,
    initialize: this.txFromJSON<null>,
    claim_rental: this.txFromJSON<null>,
    get_accrued_income: this.txFromJSON<i128>,
  };
}
