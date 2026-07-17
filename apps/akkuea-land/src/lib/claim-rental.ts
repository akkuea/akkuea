/**
 * claim-rental.ts
 *
 * "Claim All" flow for the dashboard: for each claimable property, build the
 * real GameEngine.claim_rental XDR, sign it with the connected wallet, submit
 * it to the Soroban RPC, and wait for confirmation.
 *
 * Extracted from the dashboard page so the loop and error mapping are unit
 * testable without React.
 */

import {
  buildClaimIncomeXdr,
  submitSorobanTx,
  waitForSorobanTx,
  NETWORK_PASSPHRASE,
} from "@/lib/soroban-tx";

/** Minimal wallet-kit surface needed to sign (matches @creit.tech/stellar-wallets-kit). */
export interface ClaimSigner {
  signTransaction(
    xdr: string,
    opts: { networkPassphrase: string; address: string },
  ): Promise<{ signedTxXdr: string }>;
}

export interface ClaimableProperty {
  id: string;
  name: string;
}

export interface ClaimAllOptions {
  kit: ClaimSigner;
  viewerAddress: string;
  properties: ClaimableProperty[];
  /** Called with the index of the property about to be claimed. */
  onProgress?: (index: number) => void;
  /** Called with the property id after its claim confirmed on-chain. */
  onClaimed?: (propertyId: string) => void;
}

export interface ClaimAllResult {
  /** Human-readable "<property name> — <reason>" entries, one per failed claim. */
  failures: string[];
}

/**
 * Map a raw claim error to a short human-readable reason.
 * Game engine error codes: NotOwner=2, NothingToClaim=4, InsufficientBalance=5.
 */
export function describeClaimError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  // Checked before the generic wallet-rejection pattern: node rejections
  // also contain the word "rejected".
  if (/submission rejected/i.test(message)) {
    return "submission rejected (check XLM fee balance)";
  }
  if (/reject|denied|declined/i.test(message)) {
    return "wallet signing rejected";
  }
  if (/Error\(Contract, #2\)/.test(message)) {
    return "not the on-chain owner of this property";
  }
  if (/Error\(Contract, #4\)/.test(message)) {
    return "nothing to claim yet (wait one epoch)";
  }
  if (/Error\(Contract, #5\)/.test(message)) {
    return "insufficient balance";
  }
  return message;
}

/**
 * Claim rental income for every property, sequentially.
 *
 * Sequential on purpose: each transaction uses the viewer account's sequence
 * number, so building the next XDR only after the previous claim confirms
 * avoids sequence-number collisions. Do not parallelize.
 *
 * A failure on one property never aborts the loop — it is recorded in
 * `failures` and the next property is attempted.
 */
export async function claimAllRentals(
  opts: ClaimAllOptions,
): Promise<ClaimAllResult> {
  const { kit, viewerAddress, properties, onProgress, onClaimed } = opts;
  const failures: string[] = [];

  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    onProgress?.(i);

    try {
      const unsignedXdr = await buildClaimIncomeXdr(viewerAddress, prop.id);

      const { signedTxXdr } = await kit.signTransaction(unsignedXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: viewerAddress,
      });

      const txHash = await submitSorobanTx(signedTxXdr);
      await waitForSorobanTx(txHash);

      onClaimed?.(prop.id);
    } catch (err) {
      failures.push(`${prop.name} — ${describeClaimError(err)}`);
    }
  }

  return { failures };
}
