/**
 * Auth check for the liquidation endpoint (header x-api-key, env LIQUIDATOR_API_KEY).
 */
export function isLiquidatorAuthorized(headers: Record<string, string | undefined>): boolean {
  const expected = process.env.LIQUIDATOR_API_KEY;
  const key = headers['x-api-key'];
  return Boolean(expected && key === expected);
}
