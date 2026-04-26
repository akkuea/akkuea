/**
 * Interest calculation utilities for DeFi RWA platform
 * Matches on-chain Rust contract implementation for consistency
 */

/** Precision for fixed-point calculations (18 decimals) */
export const PRECISION = BigInt("1000000000000000000");

/** Seconds per year for APY calculations */
export const SECONDS_PER_YEAR = 31_536_000;

/** Days per year for interest calculations */
export const DAYS_PER_YEAR = 365;

/**
 * Interest rate model parameters
 * Uses kinked model: rate changes slope at optimal utilization
 */
export interface InterestRateModel {
  /** Base rate (in PRECISION units, e.g., 2% = 0.02 * PRECISION) */
  baseRate: bigint;
  /** Slope below optimal utilization */
  slope1: bigint;
  /** Slope above optimal utilization */
  slope2: bigint;
  /** Optimal utilization rate (e.g., 80% = 0.8 * PRECISION) */
  optimalUtilization: bigint;
}

/**
 * Default interest rate model
 * Base: 2%, Slope1: 4%, Slope2: 75%, Optimal: 80%
 */
export const DEFAULT_INTEREST_RATE_MODEL: InterestRateModel = {
  baseRate: BigInt("20000000000000000"), // 2%
  slope1: BigInt("40000000000000000"), // 4%
  slope2: BigInt("750000000000000000"), // 75%
  optimalUtilization: BigInt("800000000000000000"), // 80%
};

/**
 * Calculate simple interest
 * Formula: principal * rate * time
 * @param principal - Principal amount
 * @param rate - Annual interest rate (decimal, e.g., 0.05 for 5%)
 * @param timeInYears - Time period in years
 * @returns Interest amount
 */
export function calculateSimpleInterest(
  principal: number,
  rate: number,
  timeInYears: number,
): number {
  return principal * rate * timeInYears;
}

/**
 * Calculate compound interest
 * Formula: principal * (1 + rate/n)^(n*time) - principal
 * @param principal - Principal amount
 * @param rate - Annual interest rate (decimal, e.g., 0.05 for 5%)
 * @param timeInYears - Time period in years
 * @param compoundingFrequency - Number of times interest compounds per year
 * @returns Total amount (principal + interest)
 */
export function calculateCompoundInterest(
  principal: number,
  rate: number,
  timeInYears: number,
  compoundingFrequency: number = 1,
): number {
  const ratePerPeriod = rate / compoundingFrequency;
  const totalPeriods = compoundingFrequency * timeInYears;
  return principal * Math.pow(1 + ratePerPeriod, totalPeriods);
}

/**
 * Convert APR to APY
 * Formula: (1 + APR/n)^n - 1
 * @param apr - Annual Percentage Rate (decimal, e.g., 0.05 for 5%)
 * @param compoundingFrequency - Number of times interest compounds per year
 * @returns APY (Annual Percentage Yield)
 */
export function aprToApy(
  apr: number,
  compoundingFrequency: number = 1,
): number {
  return Math.pow(1 + apr / compoundingFrequency, compoundingFrequency) - 1;
}

/**
 * Convert APY to APR
 * Formula: n * ((1 + APY)^(1/n) - 1)
 * @param apy - Annual Percentage Yield (decimal, e.g., 0.05 for 5%)
 * @param compoundingFrequency - Number of times interest compounds per year
 * @returns APR (Annual Percentage Rate)
 */
export function apyToApr(
  apy: number,
  compoundingFrequency: number = 1,
): number {
  return (
    compoundingFrequency * (Math.pow(1 + apy, 1 / compoundingFrequency) - 1)
  );
}

/**
 * Calculate utilization rate
 * Formula: totalBorrows / totalSupply
 * @param totalBorrows - Total borrowed amount
 * @param totalSupply - Total supplied amount
 * @returns Utilization rate in PRECISION units (0 to PRECISION)
 */
export function calculateUtilizationRate(
  totalBorrows: bigint,
  totalSupply: bigint,
): bigint {
  if (totalSupply === BigInt(0)) {
    return BigInt(0);
  }
  return (totalBorrows * PRECISION) / totalSupply;
}

/**
 * Calculate borrow rate using kinked interest rate model
 * Matches Rust contract implementation
 * @param utilization - Utilization rate in PRECISION units
 * @param model - Interest rate model parameters
 * @returns Borrow rate in PRECISION units
 */
export function calculateBorrowRate(
  utilization: bigint,
  model: InterestRateModel = DEFAULT_INTEREST_RATE_MODEL,
): bigint {
  if (utilization <= model.optimalUtilization) {
    // Below optimal: base + utilization * slope1 / optimal
    const slopeComponent =
      (utilization * model.slope1) / model.optimalUtilization;
    return model.baseRate + slopeComponent;
  } else {
    // Above optimal: rate_at_optimal + (utilization - optimal) * slope2 / (1 - optimal)
    const rateAtOptimal = model.baseRate + model.slope1;
    const excessUtilization = utilization - model.optimalUtilization;
    const remaining = PRECISION - model.optimalUtilization;
    const excessComponent = (excessUtilization * model.slope2) / remaining;
    return rateAtOptimal + excessComponent;
  }
}

/**
 * Calculate supply rate from borrow rate
 * Formula: borrow_rate * utilization * (1 - reserve_factor)
 * @param borrowRate - Borrow rate in PRECISION units
 * @param utilization - Utilization rate in PRECISION units
 * @param reserveFactor - Reserve factor in PRECISION units (e.g., 10% = 0.1 * PRECISION)
 * @returns Supply rate in PRECISION units
 */
export function calculateSupplyRate(
  borrowRate: bigint,
  utilization: bigint,
  reserveFactor: bigint,
): bigint {
  const effectiveRate = (borrowRate * utilization) / PRECISION;
  const factor = PRECISION - reserveFactor;
  return (effectiveRate * factor) / PRECISION;
}

/**
 * Calculate projected earnings over time
 * @param principal - Principal amount
 * @param annualRate - Annual rate (decimal, e.g., 0.05 for 5%)
 * @param days - Number of days
 * @returns Projected earnings
 */
export function calculateProjectedEarnings(
  principal: number,
  annualRate: number,
  days: number,
): number {
  const timeInYears = days / DAYS_PER_YEAR;
  return calculateSimpleInterest(principal, annualRate, timeInYears);
}

/**
 * Calculate new interest index based on time elapsed
 * Matches Rust contract implementation
 * @param currentIndex - Current interest index in PRECISION units
 * @param borrowRate - Borrow rate in PRECISION units
 * @param timeElapsed - Time elapsed in seconds
 * @returns New interest index in PRECISION units
 */
export function calculateNewIndex(
  currentIndex: bigint,
  borrowRate: bigint,
  timeElapsed: number,
): bigint {
  if (timeElapsed === 0) {
    return currentIndex;
  }

  // Calculate rate per second
  const ratePerSecond = borrowRate / BigInt(SECONDS_PER_YEAR);

  // Calculate accumulated interest: index * (1 + rate * time)
  const rateTimesTime = ratePerSecond * BigInt(timeElapsed);
  const interestFactor = PRECISION + rateTimesTime;

  return (currentIndex * interestFactor) / PRECISION;
}

/**
 * Convert rate from PRECISION units to decimal
 * @param rate - Rate in PRECISION units
 * @returns Rate as decimal (e.g., 0.05 for 5%)
 */
export function rateToDecimal(rate: bigint): number {
  return Number(rate) / Number(PRECISION);
}

/**
 * Convert decimal rate to PRECISION units
 * @param rate - Rate as decimal (e.g., 0.05 for 5%)
 * @returns Rate in PRECISION units
 */
export function decimalToRate(rate: number): bigint {
  return BigInt(Math.floor(rate * Number(PRECISION)));
}

/**
 * Convert rate to percentage string
 * @param rate - Rate in PRECISION units
 * @param decimals - Number of decimal places (default: 2)
 * @returns Percentage string (e.g., "5.00%")
 */
export function rateToPercentage(rate: bigint, decimals: number = 2): string {
  const decimal = rateToDecimal(rate);
  return `${(decimal * 100).toFixed(decimals)}%`;
}
