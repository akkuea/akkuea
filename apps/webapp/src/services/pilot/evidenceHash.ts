/**
 * Client-side evidence hashing.
 *
 * The income statement itself never leaves the ally's machine: the browser
 * computes a SHA-256 digest and only that digest is written on-chain, alongside
 * a link the ally controls. That keeps the pilot's promise that Akkuea stores no
 * evidence files, and it means anyone can re-hash the document later and check
 * it against the chain.
 */

/** The payout-split contract requires exactly this many hash bytes. */
export const EVIDENCE_HASH_BYTES = 32;

/** Largest file the browser will hash, to avoid locking up a low-end device. */
export const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024;

export class EvidenceFileTooLargeError extends Error {
  constructor(size: number) {
    super(
      `Evidence file is ${Math.round(size / 1024 / 1024)} MB, over the ${
        MAX_EVIDENCE_FILE_BYTES / 1024 / 1024
      } MB limit.`,
    );
    this.name = "EvidenceFileTooLargeError";
  }
}

export interface EvidenceDigest {
  /** Raw digest, ready to pass to the contract. */
  bytes: Buffer;
  /** Lowercase hex, for display and for the ally to verify independently. */
  hex: string;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashes an evidence file with SHA-256 via the Web Crypto API.
 *
 * Throws when the page is not in a secure context, because `crypto.subtle` is
 * unavailable over plain HTTP and silently falling back to a weaker hash would
 * undermine the only integrity guarantee this flow has.
 */
export async function hashEvidenceFile(file: File): Promise<EvidenceDigest> {
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new EvidenceFileTooLargeError(file.size);
  }

  if (typeof globalThis.crypto?.subtle === "undefined") {
    throw new Error(
      "Secure hashing is unavailable. Open this page over HTTPS and try again.",
    );
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );

  return { bytes: Buffer.from(new Uint8Array(digest)), hex: toHex(digest) };
}
