import { describe, expect, it } from 'bun:test';
import {
  PAYMENT_TOKEN_DECIMALS,
  PRICE_PER_SHARE_DECIMALS,
  formatTokenUnits,
  pricePerShareToTokenUnits,
  purchaseTotalToTokenUnits,
} from './paymentAmount';

// Soroban `i128` upper bound. The contract computes `amount * price_per_share`
// as an i128, so the API must never produce a total the contract cannot hold.
const I128_MAX = 2n ** 127n - 1n;

// The DB stores pricePerShare with 2 decimals; the payment token has 7.
// One cent therefore equals 10^(7 - 2) = 100_000 token units.
const ONE_CENT_IN_UNITS = 100_000n;

describe('paymentAmount', () => {
  describe('decimal constants', () => {
    it('matches the DB price scale and the payment token scale', () => {
      expect(PRICE_PER_SHARE_DECIMALS).toBe(2);
      expect(PAYMENT_TOKEN_DECIMALS).toBe(7);
    });
  });

  describe('pricePerShareToTokenUnits', () => {
    it('scales a two-decimal price to seven-decimal token units', () => {
      expect(pricePerShareToTokenUnits('125.50')).toBe(1_255_000_000n);
      expect(pricePerShareToTokenUnits('0.01')).toBe(ONE_CENT_IN_UNITS);
      expect(pricePerShareToTokenUnits('1.00')).toBe(10_000_000n);
    });

    it('accepts prices without a fractional part or with a short one', () => {
      expect(pricePerShareToTokenUnits('100')).toBe(1_000_000_000n);
      expect(pricePerShareToTokenUnits('100.5')).toBe(1_005_000_000n);
      expect(pricePerShareToTokenUnits('.50')).toBe(5_000_000n);
    });

    it('trims surrounding whitespace', () => {
      expect(pricePerShareToTokenUnits('  10.00  ')).toBe(100_000_000n);
    });

    it('returns zero for a zero price', () => {
      expect(pricePerShareToTokenUnits('0.00')).toBe(0n);
    });

    it('always returns a whole multiple of one cent', () => {
      for (const price of ['0.01', '0.99', '1.23', '19.99', '125.50', '9999.99']) {
        expect(pricePerShareToTokenUnits(price) % ONE_CENT_IN_UNITS).toBe(0n);
      }
    });

    it('stays exact beyond Number.MAX_SAFE_INTEGER', () => {
      // 1,000,000,000.00 USD -> 1e16 units, which a float cannot represent exactly
      // once it picks up any extra precision.
      expect(pricePerShareToTokenUnits('1000000000.00')).toBe(10_000_000_000_000_000n);
      expect(pricePerShareToTokenUnits('1000000000.01')).toBe(10_000_000_000_100_000n);
    });

    it('rejects empty and malformed prices', () => {
      expect(() => pricePerShareToTokenUnits('')).toThrow('Empty value');
      expect(() => pricePerShareToTokenUnits('   ')).toThrow('Empty value');
      expect(() => pricePerShareToTokenUnits('abc')).toThrow('Invalid decimal string');
      expect(() => pricePerShareToTokenUnits('1.2.3')).toThrow('Invalid decimal string');
      expect(() => pricePerShareToTokenUnits('1e5')).toThrow('Invalid decimal string');
      expect(() => pricePerShareToTokenUnits('.')).toThrow('Invalid decimal string');
    });
  });

  describe('purchaseTotalToTokenUnits', () => {
    it('multiplies the unit price by the share count', () => {
      expect(purchaseTotalToTokenUnits('125.50', 3)).toBe(3_765_000_000n);
      expect(purchaseTotalToTokenUnits('100.00', 1)).toBe(pricePerShareToTokenUnits('100.00'));
    });

    it('has no floating point drift', () => {
      // 0.1 * 3 === 0.30000000000000004 in floats; the bigint path must be exact.
      expect(purchaseTotalToTokenUnits('0.10', 3)).toBe(3_000_000n);
      expect(purchaseTotalToTokenUnits('0.07', 100)).toBe(70_000_000n);
    });

    it('is linear in the share count', () => {
      const unit = pricePerShareToTokenUnits('42.42');
      for (const shares of [1, 2, 10, 999, 100_000]) {
        expect(purchaseTotalToTokenUnits('42.42', shares)).toBe(unit * BigInt(shares));
      }
    });

    it('stays exact for large purchases and fits the contract i128', () => {
      const total = purchaseTotalToTokenUnits('999999.99', 1_000_000);
      expect(total).toBe(9_999_999_900_000_000_000n);
      expect(total <= I128_MAX).toBe(true);
    });

    it('rejects zero, negative, fractional and non-finite share counts', () => {
      const message = 'Shares must be a positive integer';
      expect(() => purchaseTotalToTokenUnits('100.00', 0)).toThrow(message);
      expect(() => purchaseTotalToTokenUnits('100.00', -1)).toThrow(message);
      expect(() => purchaseTotalToTokenUnits('100.00', 1.5)).toThrow(message);
      expect(() => purchaseTotalToTokenUnits('100.00', Number.NaN)).toThrow(message);
      expect(() => purchaseTotalToTokenUnits('100.00', Number.POSITIVE_INFINITY)).toThrow(message);
    });

    it('propagates price parsing errors', () => {
      expect(() => purchaseTotalToTokenUnits('not-a-price', 1)).toThrow('Invalid decimal string');
      expect(() => purchaseTotalToTokenUnits('', 1)).toThrow('Empty value');
    });
  });

  describe('formatTokenUnits', () => {
    it('formats token units with seven decimals for transactions.amount', () => {
      expect(formatTokenUnits(3_765_000_000n)).toBe('376.5000000');
      expect(formatTokenUnits(10_000_000n)).toBe('1.0000000');
      expect(formatTokenUnits(ONE_CENT_IN_UNITS)).toBe('0.0100000');
    });

    it('keeps sub-cent precision and zero padding', () => {
      expect(formatTokenUnits(1n)).toBe('0.0000001');
      expect(formatTokenUnits(0n)).toBe('0.0000000');
    });

    it('round-trips a database price through units and back', () => {
      expect(formatTokenUnits(pricePerShareToTokenUnits('125.50'))).toBe('125.5000000');
      expect(formatTokenUnits(pricePerShareToTokenUnits('0.01'))).toBe('0.0100000');
    });

    it('formats the real paid amount recorded for a purchase', () => {
      // 8 shares at 125.50 -> 1004.00 paid
      expect(formatTokenUnits(purchaseTotalToTokenUnits('125.50', 8))).toBe('1004.0000000');
    });

    it('fits the transactions.amount column (precision 20, scale 7)', () => {
      // numeric(20, 7) leaves room for 13 integer digits.
      const formatted = formatTokenUnits(purchaseTotalToTokenUnits('999999.99', 1_000_000));
      const [integerPart, fractionalPart] = formatted.split('.');
      expect(fractionalPart).toHaveLength(7);
      expect(integerPart!.length).toBeLessThanOrEqual(13);
    });
  });
});
