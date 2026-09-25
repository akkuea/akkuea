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
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const WhitelistError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  /**
   * `transfer_admin_accept` was called by an address that does not match
   * the pending admin recorded by `transfer_admin_start`, or no transfer
   * is pending at all.
   */
  4: {message:"NotPendingAdmin"},
  /**
   * A state-changing call was rejected because the contract is paused.
   */
  5: {message:"ContractPaused"}
}


export interface WhitelistMutationEvent {
  address: string;
  admin: string;
}


export interface AdminTransferStartedEvent {
  current_admin: string;
  new_admin: string;
}


export interface AdminTransferAcceptedEvent {
  new_admin: string;
  old_admin: string;
}


export interface AdminTransferCancelledEvent {
  admin: string;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Approved", values: readonly [string]} | {tag: "PendingAdmin", values: void} | {tag: "Paused", values: void};

export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the configured whitelist admin.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause `approve` and `revoke`. Read-only calls keep working.
   * 
   * Mirrors `pilot-payout-split`'s `pause`. Before this change, a wrongful
   * approval or revocation had no on-chain circuit breaker.
   */
  pause: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a revoke transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revoke an investor address from pilot participation.
   */
  revoke: ({admin, address}: {admin: string, address: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve an investor address for pilot participation.
   */
  approve: ({admin, address}: {admin: string, address: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resume `approve` and `revoke`.
   */
  unpause: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return whether the contract is paused.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the whitelist with the admin address that can approve and revoke investors.
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return whether an address is approved for pilot participation.
   * Read-only: keeps working while the contract is paused.
   */
  is_approved: ({address}: {address: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a pending_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Return the pending admin, if a transfer is in progress.
   */
  pending_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a transfer_admin_start transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Begin transferring admin to a new address.
   * 
   * Two-step, following the same pattern as `defi-rwa`'s
   * `AdminControl::transfer_admin_start` (see
   * docs/operations/runbook-role-management.md). The current admin keeps
   * full control until `new_admin` calls `transfer_admin_accept`, so a
   * mistyped or unreachable new admin can never lock the contract out.
   * Not blocked by `pause`: admin recovery must keep working while paused.
   */
  transfer_admin_start: ({caller, new_admin}: {caller: string, new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_admin_accept transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accept a pending admin transfer. Must be signed by the address named
   * in `transfer_admin_start`. The old admin loses every privilege the
   * instant this call succeeds, since `require_admin` compares against the
   * single stored admin address.
   */
  transfer_admin_accept: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_admin_cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel a pending admin transfer before it is accepted. Only the
   * current admin can cancel.
   */
  transfer_admin_cancel: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAACZSZXR1cm4gdGhlIGNvbmZpZ3VyZWQgd2hpdGVsaXN0IGFkbWluLgAAAAAABWFkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAALtQYXVzZSBgYXBwcm92ZWAgYW5kIGByZXZva2VgLiBSZWFkLW9ubHkgY2FsbHMga2VlcCB3b3JraW5nLgoKTWlycm9ycyBgcGlsb3QtcGF5b3V0LXNwbGl0YCdzIGBwYXVzZWAuIEJlZm9yZSB0aGlzIGNoYW5nZSwgYSB3cm9uZ2Z1bAphcHByb3ZhbCBvciByZXZvY2F0aW9uIGhhZCBubyBvbi1jaGFpbiBjaXJjdWl0IGJyZWFrZXIuAAAAAAVwYXVzZQAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAADRSZXZva2UgYW4gaW52ZXN0b3IgYWRkcmVzcyBmcm9tIHBpbG90IHBhcnRpY2lwYXRpb24uAAAABnJldm9rZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAA",
        "AAAAAAAAADRBcHByb3ZlIGFuIGludmVzdG9yIGFkZHJlc3MgZm9yIHBpbG90IHBhcnRpY2lwYXRpb24uAAAAB2FwcHJvdmUAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAA",
        "AAAAAAAAAB5SZXN1bWUgYGFwcHJvdmVgIGFuZCBgcmV2b2tlYC4AAAAAAAd1bnBhdXNlAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAACZSZXR1cm4gd2hldGhlciB0aGUgY29udHJhY3QgaXMgcGF1c2VkLgAAAAAACWlzX3BhdXNlZAAAAAAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAFZJbml0aWFsaXplIHRoZSB3aGl0ZWxpc3Qgd2l0aCB0aGUgYWRtaW4gYWRkcmVzcyB0aGF0IGNhbiBhcHByb3ZlIGFuZCByZXZva2UgaW52ZXN0b3JzLgAAAAAACmluaXRpYWxpemUAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAHVSZXR1cm4gd2hldGhlciBhbiBhZGRyZXNzIGlzIGFwcHJvdmVkIGZvciBwaWxvdCBwYXJ0aWNpcGF0aW9uLgpSZWFkLW9ubHk6IGtlZXBzIHdvcmtpbmcgd2hpbGUgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAAALaXNfYXBwcm92ZWQAAAAAAQAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAQAAAAE=",
        "AAAAAAAAADdSZXR1cm4gdGhlIHBlbmRpbmcgYWRtaW4sIGlmIGEgdHJhbnNmZXIgaXMgaW4gcHJvZ3Jlc3MuAAAAAA1wZW5kaW5nX2FkbWluAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAZxCZWdpbiB0cmFuc2ZlcnJpbmcgYWRtaW4gdG8gYSBuZXcgYWRkcmVzcy4KClR3by1zdGVwLCBmb2xsb3dpbmcgdGhlIHNhbWUgcGF0dGVybiBhcyBgZGVmaS1yd2FgJ3MKYEFkbWluQ29udHJvbDo6dHJhbnNmZXJfYWRtaW5fc3RhcnRgIChzZWUKZG9jcy9vcGVyYXRpb25zL3J1bmJvb2stcm9sZS1tYW5hZ2VtZW50Lm1kKS4gVGhlIGN1cnJlbnQgYWRtaW4ga2VlcHMKZnVsbCBjb250cm9sIHVudGlsIGBuZXdfYWRtaW5gIGNhbGxzIGB0cmFuc2Zlcl9hZG1pbl9hY2NlcHRgLCBzbyBhCm1pc3R5cGVkIG9yIHVucmVhY2hhYmxlIG5ldyBhZG1pbiBjYW4gbmV2ZXIgbG9jayB0aGUgY29udHJhY3Qgb3V0LgpOb3QgYmxvY2tlZCBieSBgcGF1c2VgOiBhZG1pbiByZWNvdmVyeSBtdXN0IGtlZXAgd29ya2luZyB3aGlsZSBwYXVzZWQuAAAAFHRyYW5zZmVyX2FkbWluX3N0YXJ0AAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAOtBY2NlcHQgYSBwZW5kaW5nIGFkbWluIHRyYW5zZmVyLiBNdXN0IGJlIHNpZ25lZCBieSB0aGUgYWRkcmVzcyBuYW1lZAppbiBgdHJhbnNmZXJfYWRtaW5fc3RhcnRgLiBUaGUgb2xkIGFkbWluIGxvc2VzIGV2ZXJ5IHByaXZpbGVnZSB0aGUKaW5zdGFudCB0aGlzIGNhbGwgc3VjY2VlZHMsIHNpbmNlIGByZXF1aXJlX2FkbWluYCBjb21wYXJlcyBhZ2FpbnN0IHRoZQpzaW5nbGUgc3RvcmVkIGFkbWluIGFkZHJlc3MuAAAAABV0cmFuc2Zlcl9hZG1pbl9hY2NlcHQAAAAAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAFlDYW5jZWwgYSBwZW5kaW5nIGFkbWluIHRyYW5zZmVyIGJlZm9yZSBpdCBpcyBhY2NlcHRlZC4gT25seSB0aGUKY3VycmVudCBhZG1pbiBjYW4gY2FuY2VsLgAAAAAAABV0cmFuc2Zlcl9hZG1pbl9jYW5jZWwAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAABAAAAAAAAAAAAAAADldoaXRlbGlzdEVycm9yAAAAAAAFAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAADAAAAnGB0cmFuc2Zlcl9hZG1pbl9hY2NlcHRgIHdhcyBjYWxsZWQgYnkgYW4gYWRkcmVzcyB0aGF0IGRvZXMgbm90IG1hdGNoCnRoZSBwZW5kaW5nIGFkbWluIHJlY29yZGVkIGJ5IGB0cmFuc2Zlcl9hZG1pbl9zdGFydGAsIG9yIG5vIHRyYW5zZmVyCmlzIHBlbmRpbmcgYXQgYWxsLgAAAA9Ob3RQZW5kaW5nQWRtaW4AAAAABAAAAEJBIHN0YXRlLWNoYW5naW5nIGNhbGwgd2FzIHJlamVjdGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAA5Db250cmFjdFBhdXNlZAAAAAAABQ==",
        "AAAAAQAAAAAAAAAAAAAAFldoaXRlbGlzdE11dGF0aW9uRXZlbnQAAAAAAAIAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAAAAAAFYWRtaW4AAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAAGUFkbWluVHJhbnNmZXJTdGFydGVkRXZlbnQAAAAAAAACAAAAAAAAAA1jdXJyZW50X2FkbWluAAAAAAAAEwAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAGkFkbWluVHJhbnNmZXJBY2NlcHRlZEV2ZW50AAAAAAACAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAAAAAAlvbGRfYWRtaW4AAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAAG0FkbWluVHJhbnNmZXJDYW5jZWxsZWRFdmVudAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABM=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAQAAAAAAAAAIQXBwcm92ZWQAAAABAAAAEwAAAAAAAAAAAAAADFBlbmRpbmdBZG1pbgAAAAAAAAAAAAAABlBhdXNlZAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<string>,
        pause: this.txFromJSON<null>,
        revoke: this.txFromJSON<null>,
        approve: this.txFromJSON<null>,
        unpause: this.txFromJSON<null>,
        is_paused: this.txFromJSON<boolean>,
        initialize: this.txFromJSON<null>,
        is_approved: this.txFromJSON<boolean>,
        pending_admin: this.txFromJSON<Option<string>>,
        transfer_admin_start: this.txFromJSON<null>,
        transfer_admin_accept: this.txFromJSON<null>,
        transfer_admin_cancel: this.txFromJSON<null>
  }
}