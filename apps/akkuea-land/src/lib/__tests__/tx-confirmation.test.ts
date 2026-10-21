/**
 * tx-confirmation - unit tests
 *
 * A transaction that is still pending after polling must surface as a
 * TxNotConfirmedError carrying its hash, never as a success.
 */

import { describe, it, expect } from "bun:test";
import { assertTxConfirmed, TxNotConfirmedError } from "@/lib/tx-confirmation";

const HASH = "abc123";

describe("assertTxConfirmed", () => {
  it("passes for a confirmed transaction", () => {
    expect(() => assertTxConfirmed("success", HASH)).not.toThrow();
  });

  it("throws TxNotConfirmedError with the hash for a pending transaction", () => {
    let caught: unknown;
    try {
      assertTxConfirmed("pending", HASH);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TxNotConfirmedError);
    expect((caught as TxNotConfirmedError).hash).toBe(HASH);
    expect((caught as Error).message).toContain(HASH);
  });

  it("throws for any other non-success status", () => {
    expect(() => assertTxConfirmed("not_found", HASH)).toThrow(
      TxNotConfirmedError,
    );
  });
});
