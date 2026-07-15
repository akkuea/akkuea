/**
 * Money/share-price math utilities using BigInt to prevent floating-point precision loss.
 */

/**
 * Safely divides two BigInts.
 * @param numerator The numerator
 * @param denominator The denominator
 * @returns The division result (truncated towards zero)
 * @throws {Error} If denominator is 0n
 */
export function safeDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("Division by zero");
  }
  return numerator / denominator;
}

/**
 * Rounds a BigInt value by dividing it by a divisor, applying the specified rounding mode.
 * Useful for scaling down a fixed-point number.
 * @param value The value to round
 * @param divisor The divisor to scale down by
 * @param mode The rounding mode: 'up', 'down', or 'nearest'
 * @returns The rounded result
 * @throws {Error} If divisor is 0n
 */
export function roundBigInt(value: bigint, divisor: bigint, mode: 'up' | 'down' | 'nearest'): bigint {
  if (divisor === 0n) {
    throw new Error("Division by zero");
  }
  
  const isNegative = (value < 0n && divisor > 0n) || (value > 0n && divisor < 0n);
  const absValue = value < 0n ? -value : value;
  const absDivisor = divisor < 0n ? -divisor : divisor;
  
  const quotient = absValue / absDivisor;
  const remainder = absValue % absDivisor;
  
  let result = quotient;
  
  if (remainder !== 0n) {
    if (mode === 'up') {
      result = quotient + 1n;
    } else if (mode === 'nearest') {
      const halfDivisor = absDivisor / 2n;
      const isHalfOrMore = (absDivisor % 2n === 0n) ? (remainder >= halfDivisor) : (remainder > halfDivisor);
      if (isHalfOrMore) {
        result = quotient + 1n;
      }
    }
  }
  
  return isNegative ? -result : result;
}

/**
 * Parses a decimal string into a BigInt scaled by 10^decimals.
 * @param value The decimal string (e.g. "10.50", "5")
 * @param decimals The number of decimal places to scale by
 * @returns The scaled BigInt
 * @throws {Error} If the string is not a valid number
 */
export function parseDecimalStringToBigInt(value: string, decimals: number): bigint {
  if (!value || value.trim() === '') {
    throw new Error("Empty value");
  }
  
  let isNegative = false;
  let str = value.trim();
  
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1);
  }
  
  if (!/^\d*\.?\d*$/.test(str) || str === '.') {
    throw new Error("Invalid decimal string");
  }
  
  let [integerPart, fractionalPart] = str.split('.');
  if (!integerPart) integerPart = '0';
  if (!fractionalPart) fractionalPart = '';
  
  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.substring(0, decimals);
  } else {
    fractionalPart = fractionalPart.padEnd(decimals, '0');
  }
  
  const result = BigInt(integerPart + fractionalPart);
  return isNegative ? -result : result;
}

/**
 * Formats a scaled BigInt back to a decimal string.
 * @param value The scaled BigInt
 * @param decimals The number of decimal places it is scaled by
 * @returns The formatted decimal string (e.g. "10.50")
 */
export function formatBigIntAsDecimalString(value: bigint, decimals: number): string {
  if (decimals < 0) {
    throw new Error("Decimals cannot be negative");
  }
  
  const isNegative = value < 0n;
  const absValue = isNegative ? -value : value;
  
  let str = absValue.toString();
  
  if (decimals === 0) {
    return (isNegative ? "-" : "") + str;
  }
  
  if (str.length <= decimals) {
    str = str.padStart(decimals + 1, '0');
  }
  
  const integerPart = str.substring(0, str.length - decimals);
  const fractionalPart = str.substring(str.length - decimals);
  
  return `${isNegative ? '-' : ''}${integerPart}.${fractionalPart}`;
}
