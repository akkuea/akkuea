import { formatBigIntAsDecimalString, parseDecimalStringToBigInt } from '@akkuea/shared';
import { formatTokenUnits, PAYMENT_TOKEN_DECIMALS } from './paymentAmount';

/**
 * Conversion between the values the defi-rwa contract works in and the
 * columns of the lending tables.
 *
 * Token amounts are 7-decimal Stellar token units on-chain and decimal(20, 7)
 * in the database. Pool factors and the health factor use the contract's
 * PRECISION (1.0 = 10^18). Nothing here accrues or recomputes interest: the
 * database stores what the contract returned.
 */
export const CONTRACT_PRECISION_DECIMALS = 18;
const PRECISION = 10n ** BigInt(CONTRACT_PRECISION_DECIMALS);

/** Largest value `borrow_positions.health_factor` (decimal(10, 4)) can hold. */
const MAX_HEALTH_FACTOR_UNITS = 9_999_999_999n;
/** Largest value `lending_pools.utilization_rate` (decimal(5, 2)) can hold. */
const MAX_UTILIZATION_BASIS = 99_999n;

/**
 * Parses a user-entered token amount ("12.5") into token units. Rejects
 * amounts with more decimals than the token has, instead of truncating.
 */
export function parseTokenAmount(value: string): bigint {
  const [, fraction = ''] = value.split('.');
  if (fraction.length > PAYMENT_TOKEN_DECIMALS) {
    throw new Error(`Amounts can have at most ${PAYMENT_TOKEN_DECIMALS} decimal places`);
  }
  const units = parseDecimalStringToBigInt(value, PAYMENT_TOKEN_DECIMALS);
  if (units <= 0n) {
    throw new Error('Amount must be greater than zero');
  }
  return units;
}

/**
 * Parses a pool factor written as a fraction ("0.75" for 75%) into contract
 * PRECISION units. Factors must be between 0 and 1 inclusive.
 */
export function parseContractFactor(value: string): bigint {
  const units = parseDecimalStringToBigInt(value, CONTRACT_PRECISION_DECIMALS);
  if (units < 0n || units > PRECISION) {
    throw new Error('Pool factors must be fractions between 0 and 1');
  }
  return units;
}

/** Available liquidity the way the contract computes it. */
export function availableLiquidityUnits(totalDeposits: bigint, totalBorrows: bigint): bigint {
  return totalDeposits > totalBorrows ? totalDeposits - totalBorrows : 0n;
}

/** Utilization in percent with 2 decimals, for `lending_pools.utilization_rate`. */
export function formatUtilizationRate(totalDeposits: bigint, totalBorrows: bigint): string {
  if (totalDeposits <= 0n) {
    return '0.00';
  }
  const basis = (totalBorrows * 10_000n) / totalDeposits;
  return formatBigIntAsDecimalString(
    basis > MAX_UTILIZATION_BASIS ? MAX_UTILIZATION_BASIS : basis,
    2,
  );
}

/**
 * Health factor from PRECISION units to 4 decimals. A position with almost no
 * debt has an enormous health factor, so it is capped at what the column holds.
 */
export function formatHealthFactor(healthFactor: bigint): string {
  const units = healthFactor <= 0n ? 0n : healthFactor / 10n ** 14n;
  return formatBigIntAsDecimalString(
    units > MAX_HEALTH_FACTOR_UNITS ? MAX_HEALTH_FACTOR_UNITS : units,
    4,
  );
}

/** Pool totals as stored on `lending_pools`. */
export function poolTotalsFromChain(totalDeposits: bigint, totalBorrows: bigint) {
  return {
    totalDeposits: formatTokenUnits(totalDeposits),
    totalBorrows: formatTokenUnits(totalBorrows),
    availableLiquidity: formatTokenUnits(availableLiquidityUnits(totalDeposits, totalBorrows)),
    utilizationRate: formatUtilizationRate(totalDeposits, totalBorrows),
  };
}

/** A contract timestamp (seconds) as a Date. */
export function fromContractTimestamp(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}
