import { formatBigIntAsDecimalString, parseDecimalStringToBigInt } from '@akkuea/shared';

/**
 * Conversion between the `properties.pricePerShare` column and the units the
 * payment token uses on-chain.
 *
 * The database stores `pricePerShare` as a decimal with 2 places (USD dollars
 * and cents), while the payment token (USDC) is a Soroban token with 7
 * decimals (1 USDC = 10^7 stroop-like units). Every on-chain amount therefore
 * scales the stored price by 10^(7 - 2) = 100_000.
 *
 * This is the only place that scaling happens: tokenization uses it to price
 * the `list_property` call, and buy-shares confirm uses it to check the
 * `SharePurchase` event and to record the real paid amount.
 */
export const PAYMENT_TOKEN_DECIMALS = 7;
export const PRICE_PER_SHARE_DECIMALS = 2;

const PAYMENT_TOKEN_SCALE = 10n ** BigInt(PAYMENT_TOKEN_DECIMALS - PRICE_PER_SHARE_DECIMALS);

/**
 * Converts `properties.pricePerShare` (2 decimals) into payment token units
 * (7 decimals), as a bigint ready for a Soroban `i128` argument.
 *
 * @param pricePerShare decimal string from the database, e.g. "100.00"
 */
export function pricePerShareToTokenUnits(pricePerShare: string): bigint {
  return parseDecimalStringToBigInt(pricePerShare, PRICE_PER_SHARE_DECIMALS) * PAYMENT_TOKEN_SCALE;
}

/**
 * Total payment for a purchase, in payment token units: price * shares.
 *
 * @param pricePerShare decimal string from the database, e.g. "100.00"
 * @param shares number of shares being bought
 */
export function purchaseTotalToTokenUnits(pricePerShare: string, shares: number): bigint {
  if (!Number.isInteger(shares) || shares <= 0) {
    throw new Error('Shares must be a positive integer');
  }

  return pricePerShareToTokenUnits(pricePerShare) * BigInt(shares);
}

/**
 * Formats payment token units (7 decimals) back into a decimal string for the
 * `transactions.amount` column (precision 20, scale 7).
 *
 * @param units amount in payment token units
 */
export function formatTokenUnits(units: bigint): string {
  return formatBigIntAsDecimalString(units, PAYMENT_TOKEN_DECIMALS);
}
