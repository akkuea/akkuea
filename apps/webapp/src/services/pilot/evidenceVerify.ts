import { hashEvidenceBytes } from "./evidenceHash";

/**
 * Client-side evidence verification.
 *
 * The payout contract stores only a SHA-256 digest of the ally's income
 * statement, alongside a link the ally controls. That promise ("anyone can
 * re-hash the document later and check it against the chain") is only real if
 * the dashboard actually performs the check, so this module fetches the linked
 * document, re-computes the digest in the browser, and reports the outcome.
 *
 * Nothing is uploaded and no trust is placed in the source: a document that
 * does not hash to the on-chain digest fails, whether it was tampered with or
 * simply replaced.
 */

export type EvidenceVerificationStatus = "match" | "mismatch" | "unreachable";

export interface EvidenceVerification {
  status: EvidenceVerificationStatus;
  /** Digest actually computed from the document. Absent when unreachable. */
  actualHex?: string;
  /** Why the document could not be checked. Present only when unreachable. */
  reason?: string;
}

/** Lowercases and strips an optional `0x`, so two spellings compare equal. */
export function normalizeHashHex(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

/**
 * Compares a document's bytes against the digest recorded on-chain.
 *
 * Returns `match` or `mismatch`; hashing failures propagate, because a missing
 * Web Crypto context is a setup problem, not a verdict on the document.
 */
export async function verifyEvidenceBytes(
  bytes: ArrayBuffer,
  expectedHex: string,
): Promise<EvidenceVerification> {
  const { hex } = await hashEvidenceBytes(bytes);
  return hex === normalizeHashHex(expectedHex)
    ? { status: "match", actualHex: hex }
    : { status: "mismatch", actualHex: hex };
}

/**
 * Fetches a linked document and verifies it against the on-chain digest.
 *
 * Anything that prevents the check, including a CORS-blocked source, a broken
 * link, or a non-200 response, is reported as `unreachable` rather than
 * `mismatch`: the caller must not imply a document failed verification just
 * because the browser could not retrieve it. The unreachable path is what lets
 * the UI offer "hash a file you downloaded yourself" as the fallback.
 */
export async function verifyEvidenceDocument(
  link: string,
  expectedHex: string,
): Promise<EvidenceVerification> {
  try {
    const response = await fetch(link, { redirect: "follow" });
    if (!response.ok) {
      return { status: "unreachable", reason: `HTTP ${response.status}` };
    }
    return await verifyEvidenceBytes(await response.arrayBuffer(), expectedHex);
  } catch (error) {
    return {
      status: "unreachable",
      reason:
        error instanceof Error && error.message
          ? error.message
          : "The document could not be retrieved.",
    };
  }
}
