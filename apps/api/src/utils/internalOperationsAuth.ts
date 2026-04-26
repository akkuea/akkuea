/**
 * Shared check for /internal/operations routes (header x-internal-api-key).
 */
export function isInternalOperationsAuthorized(
  headers: Record<string, string | undefined>,
): boolean {
  const expected = process.env.OPERATIONS_BACKEND_CREDENTIAL;
  const key = headers['x-internal-api-key'];
  return Boolean(expected && key === expected);
}
