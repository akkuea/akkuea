import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for secrets such as API keys.
 *
 * Both inputs are hashed to fixed-length SHA-256 digests before
 * `timingSafeEqual` runs, so the comparison takes the same time whatever the
 * length or content of either value and never exits early on a length
 * mismatch. Returns false when either value is missing, empty, or not a string,
 * so an unset expected secret can never authorize a request.
 */
export function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) {
    return false;
  }

  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}
