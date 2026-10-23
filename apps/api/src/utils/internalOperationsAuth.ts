import { safeEqual } from './safeEqual';

/**
 * Shared check for /internal/operations routes (header x-internal-api-key).
 */
export function isInternalOperationsAuthorized(
  headers: Record<string, string | undefined>,
): boolean {
  return safeEqual(headers['x-internal-api-key'], process.env.OPERATIONS_BACKEND_CREDENTIAL);
}
