import { safeEqual } from './safeEqual';

/**
 * Auth check for the liquidation endpoint (header x-api-key, env LIQUIDATOR_API_KEY).
 */
export function isLiquidatorAuthorized(headers: Record<string, string | undefined>): boolean {
  return safeEqual(headers['x-api-key'], process.env.LIQUIDATOR_API_KEY);
}
