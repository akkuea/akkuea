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

export type DataKey =
  | { tag: "Balance"; values: readonly [string] }
  | { tag: "Allowance"; values: readonly [string, string] }
  | { tag: "Admin"; values: void }
  | { tag: "Testnet"; values: void }
  | { tag: "Authorized"; values: readonly [string] }
  | { tag: "FaucetClaimed"; values: readonly [string] };

export const TokenError = {
  1: { message: "AlreadyInitialized" },
  2: { message: "InsufficientBalance" },
  3: { message: "InsufficientAllowance" },
  4: { message: "FaucetDisabled" },
  5: { message: "FaucetAlreadyClaimed" },
  6: { message: "Unauthorized" },
};

export interface Client {
  /**
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn: (
    { from, amount }: { from: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mint: (
    { caller, to, amount }: { caller: string; to: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a faucet transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  faucet: (
    { recipient }: { recipient: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

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
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: (
    { id }: { id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  decimals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer: (
    { from, to, amount }: { from: string; to: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a allowance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  allowance: (
    { from, spender }: { from: string; spender: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a burn_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn_from: (
    { spender, from, amount }: { spender: string; from: string; amount: i128 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a authorized transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  authorized: (
    { id }: { id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (
    { admin, testnet_mode }: { admin: string; testnet_mode: boolean },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

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
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_authorized transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_authorized: (
    { id, authorize }: { id: string; authorize: boolean },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a spendable_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  spendable_balance: (
    { id }: { id: string },
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
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAEAAAAAAAAAB0JhbGFuY2UAAAAAAQAAABMAAAABAAAAAAAAAAlBbGxvd2FuY2UAAAAAAAACAAAAEwAAABMAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAAB1Rlc3RuZXQAAAAAAQAAAAAAAAAKQXV0aG9yaXplZAAAAAAAAQAAABMAAAABAAAAAAAAAA1GYXVjZXRDbGFpbWVkAAAAAAAAAQAAABM=",
        "AAAABAAAAAAAAAAAAAAAClRva2VuRXJyb3IAAAAAAAYAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAACAAAAAAAAABVJbnN1ZmZpY2llbnRBbGxvd2FuY2UAAAAAAAADAAAAAAAAAA5GYXVjZXREaXNhYmxlZAAAAAAABAAAAAAAAAAURmF1Y2V0QWxyZWFkeUNsYWltZWQAAAAFAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAG",
        "AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAEbWludAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==",
        "AAAAAAAAAAAAAAAGZmF1Y2V0AAAAAAABAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAAAAAAAKYXV0aG9yaXplZAAAAAAAAQAAAAAAAAACaWQAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAx0ZXN0bmV0X21vZGUAAAABAAAAAA==",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAOc2V0X2F1dGhvcml6ZWQAAAAAAAIAAAAAAAAAAmlkAAAAAAATAAAAAAAAAAlhdXRob3JpemUAAAAAAAABAAAAAA==",
        "AAAAAAAAAAAAAAARc3BlbmRhYmxlX2JhbGFuY2UAAAAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    burn: this.txFromJSON<null>,
    mint: this.txFromJSON<null>,
    name: this.txFromJSON<string>,
    faucet: this.txFromJSON<null>,
    symbol: this.txFromJSON<string>,
    approve: this.txFromJSON<null>,
    balance: this.txFromJSON<i128>,
    decimals: this.txFromJSON<u32>,
    transfer: this.txFromJSON<null>,
    allowance: this.txFromJSON<i128>,
    burn_from: this.txFromJSON<null>,
    authorized: this.txFromJSON<boolean>,
    initialize: this.txFromJSON<null>,
    transfer_from: this.txFromJSON<null>,
    set_authorized: this.txFromJSON<null>,
    spendable_balance: this.txFromJSON<i128>,
  };
}
