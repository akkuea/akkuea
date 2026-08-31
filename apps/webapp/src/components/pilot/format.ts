/**
 * Display helpers shared by the pilot views.
 *
 * On-chain amounts are integers in the token's base units. Converting them for
 * display in one place keeps a stroop-vs-USDC mistake from reaching an investor
 * looking at a payout figure.
 */

/** USDC on Stellar uses 7 decimals, as does the pilot income token. */
export const USDC_DECIMALS = 7;

/**
 * Converts a base-unit integer to a decimal string without going through
 * `Number`, which would silently lose precision on large balances.
 */
export function formatBaseUnits(
  amount: bigint,
  decimals: number = USDC_DECIMALS,
  fractionDigits = 2,
): string {
  const negative = amount < BigInt(0);
  const absolute = negative ? -amount : amount;
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;

  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, fractionDigits);

  const wholeText = whole.toLocaleString("en-US");
  const sign = negative ? "-" : "";

  return fractionDigits > 0
    ? `${sign}${wholeText}.${fractionText}`
    : `${sign}${wholeText}`;
}

/** Formats a USDC base-unit amount for display, for example "1,250.00 USDC". */
export function formatUsdc(amount: bigint): string {
  return `${formatBaseUnits(amount, USDC_DECIMALS)} USDC`;
}

/** Formats a Unix-seconds timestamp as a UTC calendar date. */
export function formatUnixDate(seconds: number, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(seconds * 1000));
}

/** Formats a `YYYY-MM` cycle id as a readable month, for example "March 2026". */
export function formatCycleLabel(cycleId: string, locale = "en-US"): string {
  const [year, month] = cycleId
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return cycleId;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Shortens a hash for display while keeping it verifiable at a glance. */
export function shortenHash(hex: string): string {
  return hex.length <= 16 ? hex : `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}
