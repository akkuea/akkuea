/**
 * tx-confirmation.ts
 *
 * One policy for transactions that were submitted but not confirmed:
 * waitForSorobanTx() reports "pending" when polling times out, and every
 * caller passes that status through assertTxConfirmed(), which throws a
 * TxNotConfirmedError. Callers already treat a throw as failure, so an
 * unconfirmed transaction rolls back optimistic UI instead of being shown
 * as a success.
 *
 * Kept separate from soroban-tx.ts so tests that mock soroban-tx still get
 * the real error class and check.
 */

import type { TxStatus } from "@/lib/soroban-tx";

/** A submitted transaction that did not confirm within the polling window. */
export class TxNotConfirmedError extends Error {
  readonly hash: string;

  constructor(hash: string) {
    super(
      `Transaction not confirmed yet (hash ${hash}). Look it up on a Stellar explorer before retrying.`,
    );
    this.name = "TxNotConfirmedError";
    this.hash = hash;
  }
}

/** Throws TxNotConfirmedError unless `status` is "success". */
export function assertTxConfirmed(status: TxStatus, hash: string): void {
  if (status !== "success") {
    throw new TxNotConfirmedError(hash);
  }
}
