import { describe, it, expect } from "vitest";
import {
  PRECISION,
  SECONDS_PER_YEAR,
  DEFAULT_INTEREST_RATE_MODEL,
  calculateSimpleInterest,
  calculateCompoundInterest,
  aprToApy,
  apyToApr,
  calculateUtilizationRate,
  calculateBorrowRate,
  calculateSupplyRate,
  calculateProjectedEarnings,
  calculateNewIndex,
  rateToDecimal,
  decimalToRate,
  rateToPercentage,
} from "./interest";

describe("Interest Calculation Utilities", () => {
  describe("Simple Interest", () => {
    it("should calculate simple interest correctly", () => {
      const result = calculateSimpleInterest(1000, 0.05, 1);
      expect(result).toBe(50);
    });

    it("should handle multi-year periods", () => {
      const result = calculateSimpleInterest(1000, 0.05, 2);
      expect(result).toBe(100);
    });

    it("should handle fractional years", () => {
      const result = calculateSimpleInterest(1000, 0.05, 0.5);
      expect(result).toBe(25);
    });

    it("should return 0 for 0 rate", () => {
      const result = calculateSimpleInterest(1000, 0, 1);
      expect(result).toBe(0);
    });
  });

  describe("Compound Interest", () => {
    it("should calculate compound interest with annual compounding", () => {
      const result = calculateCompoundInterest(1000, 0.05, 1, 1);
      expect(result).toBeCloseTo(1050, 2);
    });

    it("should calculate compound interest with monthly compounding", () => {
      const result = calculateCompoundInterest(1000, 0.05, 1, 12);
      expect(result).toBeCloseTo(1051.16, 2);
    });

    it("should calculate compound interest with daily compounding", () => {
      const result = calculateCompoundInterest(1000, 0.05, 1, 365);
      expect(result).toBeCloseTo(1051.27, 2);
    });

    it("should handle multi-year periods", () => {
      const result = calculateCompoundInterest(1000, 0.05, 2, 12);
      expect(result).toBeCloseTo(1104.94, 2);
    });
  });

  describe("APR to APY Conversion", () => {
    it("should convert APR to APY with annual compounding", () => {
      const result = aprToApy(0.05, 1);
      expect(result).toBeCloseTo(0.05, 4);
    });

    it("should convert APR to APY with monthly compounding", () => {
      const result = aprToApy(0.05, 12);
      expect(result).toBeCloseTo(0.05116, 4);
    });

    it("should convert APR to APY with daily compounding", () => {
      const result = aprToApy(0.05, 365);
      expect(result).toBeCloseTo(0.05127, 4);
    });

    it("should handle 0 APR", () => {
      const result = aprToApy(0, 12);
      expect(result).toBe(0);
    });
  });

  describe("APY to APR Conversion", () => {
    it("should convert APY to APR with annual compounding", () => {
      const result = apyToApr(0.05, 1);
      expect(result).toBeCloseTo(0.05, 4);
    });

    it("should convert APY to APR with monthly compounding", () => {
      const result = apyToApr(0.05116, 12);
      expect(result).toBeCloseTo(0.05, 4);
    });

    it("should round-trip APR -> APY -> APR", () => {
      const apr = 0.05;
      const apy = aprToApy(apr, 12);
      const backToApr = apyToApr(apy, 12);
      expect(backToApr).toBeCloseTo(apr, 6);
    });
  });

  describe("Utilization Rate", () => {
    it("should calculate utilization rate correctly", () => {
      const result = calculateUtilizationRate(BigInt(800), BigInt(1000));
      const expected = (BigInt(800) * PRECISION) / BigInt(1000);
      expect(result).toBe(expected);
    });

    it("should return 0 for 0 supply", () => {
      const result = calculateUtilizationRate(BigInt(100), BigInt(0));
      expect(result).toBe(BigInt(0));
    });

    it("should handle 100% utilization", () => {
      const result = calculateUtilizationRate(BigInt(1000), BigInt(1000));
      expect(result).toBe(PRECISION);
    });

    it("should handle 0% utilization", () => {
      const result = calculateUtilizationRate(BigInt(0), BigInt(1000));
      expect(result).toBe(BigInt(0));
    });
  });

  describe("Kinked Interest Rate Model", () => {
    it("should calculate borrow rate below optimal utilization", () => {
      // 50% utilization (below 80% optimal)
      const utilization = BigInt("500000000000000000");
      const result = calculateBorrowRate(utilization);

      // Expected: base + (utilization * slope1 / optimal)
      // = 0.02 + (0.5 * 0.04 / 0.8) = 0.02 + 0.025 = 0.045 = 4.5%
      const expected = BigInt("45000000000000000");
      expect(result).toBe(expected);
    });

    it("should calculate borrow rate at optimal utilization", () => {
      // 80% utilization (at optimal)
      const utilization = DEFAULT_INTEREST_RATE_MODEL.optimalUtilization;
      const result = calculateBorrowRate(utilization);

      // Expected: base + slope1 = 0.02 + 0.04 = 0.06 = 6%
      const expected = BigInt("60000000000000000");
      expect(result).toBe(expected);
    });

    it("should calculate borrow rate above optimal utilization", () => {
      // 90% utilization (above 80% optimal)
      const utilization = BigInt("900000000000000000");
      const result = calculateBorrowRate(utilization);

      // Expected: rate_at_optimal + (excess * slope2 / remaining)
      // rate_at_optimal = 0.06
      // excess = 0.9 - 0.8 = 0.1
      // remaining = 1 - 0.8 = 0.2
      // = 0.06 + (0.1 * 0.75 / 0.2) = 0.06 + 0.375 = 0.435 = 43.5%
      const expected = BigInt("435000000000000000");
      expect(result).toBe(expected);
    });

    it("should calculate borrow rate at 100% utilization", () => {
      const utilization = PRECISION;
      const result = calculateBorrowRate(utilization);

      // Expected: rate_at_optimal + slope2
      // = 0.06 + 0.75 = 0.81 = 81%
      const expected = BigInt("810000000000000000");
      expect(result).toBe(expected);
    });

    it("should calculate borrow rate at 0% utilization", () => {
      const utilization = BigInt(0);
      const result = calculateBorrowRate(utilization);

      // Expected: base rate = 2%
      expect(result).toBe(DEFAULT_INTEREST_RATE_MODEL.baseRate);
    });
  });

  describe("Supply Rate Calculation", () => {
    it("should calculate supply rate correctly", () => {
      const borrowRate = BigInt("60000000000000000"); // 6%
      const utilization = BigInt("800000000000000000"); // 80%
      const reserveFactor = BigInt("100000000000000000"); // 10%

      const result = calculateSupplyRate(
        borrowRate,
        utilization,
        reserveFactor,
      );

      // Expected: borrow_rate * utilization * (1 - reserve_factor)
      // = 0.06 * 0.8 * 0.9 = 0.0432 = 4.32%
      const expected = BigInt("43200000000000000");
      expect(result).toBe(expected);
    });

    it("should return 0 for 0 utilization", () => {
      const borrowRate = BigInt("60000000000000000");
      const utilization = BigInt(0);
      const reserveFactor = BigInt("100000000000000000");

      const result = calculateSupplyRate(
        borrowRate,
        utilization,
        reserveFactor,
      );
      expect(result).toBe(BigInt(0));
    });

    it("should handle 0 reserve factor", () => {
      const borrowRate = BigInt("60000000000000000"); // 6%
      const utilization = BigInt("800000000000000000"); // 80%
      const reserveFactor = BigInt(0);

      const result = calculateSupplyRate(
        borrowRate,
        utilization,
        reserveFactor,
      );

      // Expected: 0.06 * 0.8 = 0.048 = 4.8%
      const expected = BigInt("48000000000000000");
      expect(result).toBe(expected);
    });
  });

  describe("Projected Earnings", () => {
    it("should calculate projected earnings for 30 days", () => {
      const result = calculateProjectedEarnings(1000, 0.05, 30);
      // 1000 * 0.05 * (30/365) ≈ 4.11
      expect(result).toBeCloseTo(4.11, 2);
    });

    it("should calculate projected earnings for 1 year", () => {
      const result = calculateProjectedEarnings(1000, 0.05, 365);
      expect(result).toBeCloseTo(50, 2);
    });

    it("should handle 0 days", () => {
      const result = calculateProjectedEarnings(1000, 0.05, 0);
      expect(result).toBe(0);
    });
  });

  describe("Interest Index Calculation", () => {
    it("should return current index for 0 time elapsed", () => {
      const currentIndex = PRECISION;
      const borrowRate = BigInt("60000000000000000");
      const result = calculateNewIndex(currentIndex, borrowRate, 0);
      expect(result).toBe(currentIndex);
    });

    it("should calculate new index after 1 year", () => {
      const currentIndex = PRECISION;
      const borrowRate = BigInt("60000000000000000"); // 6%
      const result = calculateNewIndex(
        currentIndex,
        borrowRate,
        SECONDS_PER_YEAR,
      );

      // Expected: index * (1 + rate) = 1 * 1.06
      // Using approximate match due to integer division precision
      const expected = BigInt("1060000000000000000");
      const tolerance = BigInt("1000000000000000"); // 0.1% tolerance
      expect(result).toBeGreaterThanOrEqual(expected - tolerance);
      expect(result).toBeLessThanOrEqual(expected + tolerance);
    });

    it("should calculate new index after 6 months", () => {
      const currentIndex = PRECISION;
      const borrowRate = BigInt("60000000000000000"); // 6%
      const halfYear = SECONDS_PER_YEAR / 2;
      const result = calculateNewIndex(currentIndex, borrowRate, halfYear);

      // Expected: index * (1 + rate/2) = 1 * 1.03
      // Using approximate match due to integer division precision
      const expected = BigInt("1030000000000000000");
      const tolerance = BigInt("500000000000000"); // 0.05% tolerance
      expect(result).toBeGreaterThanOrEqual(expected - tolerance);
      expect(result).toBeLessThanOrEqual(expected + tolerance);
    });

    it("should compound correctly over multiple periods", () => {
      let index = PRECISION;
      const borrowRate = BigInt("60000000000000000"); // 6%
      const oneMonth = SECONDS_PER_YEAR / 12;

      // Compound for 12 months
      for (let i = 0; i < 12; i++) {
        index = calculateNewIndex(index, borrowRate, oneMonth);
      }

      // Should be close to 1.06 (with slight difference due to discrete compounding)
      const decimal = rateToDecimal(index - PRECISION);
      expect(decimal).toBeCloseTo(0.06, 2);
    });
  });

  describe("Rate Conversion Utilities", () => {
    it("should convert rate to decimal", () => {
      const rate = BigInt("50000000000000000"); // 5%
      const result = rateToDecimal(rate);
      expect(result).toBeCloseTo(0.05, 6);
    });

    it("should convert decimal to rate", () => {
      const decimal = 0.05;
      const result = decimalToRate(decimal);
      expect(result).toBe(BigInt("50000000000000000"));
    });

    it("should round-trip decimal -> rate -> decimal", () => {
      const original = 0.05;
      const rate = decimalToRate(original);
      const back = rateToDecimal(rate);
      expect(back).toBeCloseTo(original, 6);
    });

    it("should convert rate to percentage string", () => {
      const rate = BigInt("50000000000000000"); // 5%
      const result = rateToPercentage(rate);
      expect(result).toBe("5.00%");
    });

    it("should format percentage with custom decimals", () => {
      const rate = BigInt("51234000000000000"); // 5.1234%
      const result = rateToPercentage(rate, 4);
      expect(result).toBe("5.1234%");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large numbers", () => {
      const large = BigInt("999999999999999999");
      const result = calculateUtilizationRate(large, PRECISION);
      expect(result).toBeLessThanOrEqual(PRECISION);
    });

    it("should handle very small rates", () => {
      const smallRate = BigInt("1"); // 0.000000000000000001%
      const result = rateToDecimal(smallRate);
      expect(result).toBeGreaterThan(0);
    });

    it("should maintain precision in calculations", () => {
      const utilization = BigInt("333333333333333333"); // ~33.33%
      const borrowRate = calculateBorrowRate(utilization);
      expect(borrowRate).toBeGreaterThan(DEFAULT_INTEREST_RATE_MODEL.baseRate);
    });
  });
});
