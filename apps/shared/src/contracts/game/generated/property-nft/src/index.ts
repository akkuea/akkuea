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

export interface PropertyMeta {
  approved_spender: u32;
  last_claimed_ledger: u64;
  level: u32;
}

export interface PropertyOwner {
  address: string;
}

export interface PropertyCoords {
  x: u32;
  y: u32;
}

export interface PropertyState {
  approved: Option<string>;
  id: u32;
  last_claimed_ledger: u64;
  level: u32;
  owner: string;
  x: u32;
  y: u32;
}

export const NftError = {
  1: { message: "AlreadyInitialized" },
  2: { message: "NotOwner" },
  3: { message: "NotApproved" },
  4: { message: "InvalidProperty" },
  5: { message: "ContractPaused" },
  6: { message: "Unauthorized" },
};

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: (
    { admin }: { admin: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve spender
   */
  approve: (
    {
      owner,
      spender,
      property_id,
    }: { owner: string; spender: string; property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: (
    { admin }: { admin: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer property
   */
  transfer: (
    { from, to, property_id }: { from: string; to: string; property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_owner: (
    { property_id }: { property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mint all 400 tiles to `treasury` logically.
   */
  initialize: (
    { treasury, game_engine }: { treasury: string; game_engine: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_property transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get property
   */
  get_property: (
    { property_id }: { property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<PropertyState>>;

  /**
   * Construct and simulate a list_by_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_by_owner: (
    { owner }: { owner: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer from approved spender
   */
  transfer_from: (
    {
      spender,
      from,
      to,
      property_id,
    }: { spender: string; from: string; to: string; property_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_improvement_level transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_improvement_level: (
    {
      caller,
      property_id,
      level,
    }: { caller: string; property_id: u32; level: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_last_claimed_ledger transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_last_claimed_ledger: (
    {
      caller,
      property_id,
      ledger,
    }: { caller: string; property_id: u32; ledger: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
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
        "AAAAAQAAAAAAAAAAAAAADFByb3BlcnR5TWV0YQAAAAMAAAAAAAAAEGFwcHJvdmVkX3NwZW5kZXIAAAAEAAAAAAAAABNsYXN0X2NsYWltZWRfbGVkZ2VyAAAAAAYAAAAAAAAABWxldmVsAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAADVByb3BlcnR5T3duZXIAAAAAAAABAAAAAAAAAAdhZGRyZXNzAAAAABM=",
        "AAAAAQAAAAAAAAAAAAAADlByb3BlcnR5Q29vcmRzAAAAAAACAAAAAAAAAAF4AAAAAAAABAAAAAAAAAABeQAAAAAAAAQ=",
        "AAAAAQAAAAAAAAAAAAAADVByb3BlcnR5U3RhdGUAAAAAAAAHAAAAAAAAAAhhcHByb3ZlZAAAA+gAAAATAAAAAAAAAAJpZAAAAAAABAAAAAAAAAATbGFzdF9jbGFpbWVkX2xlZGdlcgAAAAAGAAAAAAAAAAVsZXZlbAAAAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAABeAAAAAAAAAQAAAAAAAAAAXkAAAAAAAAE",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAA9BcHByb3ZlIHNwZW5kZXIAAAAAB2FwcHJvdmUAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAABFUcmFuc2ZlciBwcm9wZXJ0eQAAAAAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAALcHJvcGVydHlfaWQAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAJZ2V0X293bmVyAAAAAAAAAQAAAAAAAAALcHJvcGVydHlfaWQAAAAABAAAAAEAAAAT",
        "AAAAAAAAACtNaW50IGFsbCA0MDAgdGlsZXMgdG8gYHRyZWFzdXJ5YCBsb2dpY2FsbHkuAAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAC2dhbWVfZW5naW5lAAAAABMAAAAA",
        "AAAAAAAAAAxHZXQgcHJvcGVydHkAAAAMZ2V0X3Byb3BlcnR5AAAAAQAAAAAAAAALcHJvcGVydHlfaWQAAAAABAAAAAEAAAfQAAAADVByb3BlcnR5U3RhdGUAAAA=",
        "AAAAAAAAAAAAAAANbGlzdF9ieV9vd25lcgAAAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAAB5UcmFuc2ZlciBmcm9tIGFwcHJvdmVkIHNwZW5kZXIAAAAAAA10cmFuc2Zlcl9mcm9tAAAAAAAABAAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAVc2V0X2ltcHJvdmVtZW50X2xldmVsAAAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAAAAAAVsZXZlbAAAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAXc2V0X2xhc3RfY2xhaW1lZF9sZWRnZXIAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAAAAAAZsZWRnZXIAAAAAAAYAAAAA",
        "AAAABAAAAAAAAAAAAAAACE5mdEVycm9yAAAABgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAhOb3RPd25lcgAAAAIAAAAAAAAAC05vdEFwcHJvdmVkAAAAAAMAAAAAAAAAD0ludmFsaWRQcm9wZXJ0eQAAAAAEAAAAAAAAAA5Db250cmFjdFBhdXNlZAAAAAAABQAAAAAAAAAMVW5hdXRob3JpemVkAAAABg==",
        "AAAABQAAAAAAAAAAAAAADEFwcHJvdmVFdmVudAAAAAEAAAANYXBwcm92ZV9ldmVudAAAAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADVRyYW5zZmVyRXZlbnQAAAAAAAABAAAADnRyYW5zZmVyX2V2ZW50AAAAAAADAAAAAAAAAARmcm9tAAAD6AAAABMAAAAAAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAI=",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<null>,
    approve: this.txFromJSON<null>,
    unpause: this.txFromJSON<null>,
    transfer: this.txFromJSON<null>,
    get_owner: this.txFromJSON<string>,
    initialize: this.txFromJSON<null>,
    get_property: this.txFromJSON<PropertyState>,
    list_by_owner: this.txFromJSON<Array<u32>>,
    transfer_from: this.txFromJSON<null>,
    set_improvement_level: this.txFromJSON<null>,
    set_last_claimed_ledger: this.txFromJSON<null>,
  };
}
