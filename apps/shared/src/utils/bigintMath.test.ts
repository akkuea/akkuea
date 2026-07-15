import { expect, test, describe } from "bun:test";
import {
  safeDivide,
  roundBigInt,
  parseDecimalStringToBigInt,
  formatBigIntAsDecimalString,
} from "./bigintMath";

describe("bigintMath", () => {
  describe("safeDivide", () => {
    test("divides positive numbers", () => {
      expect(safeDivide(10n, 2n)).toBe(5n);
    });

    test("divides negative numbers", () => {
      expect(safeDivide(-10n, 2n)).toBe(-5n);
      expect(safeDivide(10n, -2n)).toBe(-5n);
      expect(safeDivide(-10n, -2n)).toBe(5n);
    });

    test("throws on division by zero", () => {
      expect(() => safeDivide(10n, 0n)).toThrow("Division by zero");
    });
    
    test("truncates correctly", () => {
      expect(safeDivide(11n, 2n)).toBe(5n);
      expect(safeDivide(-11n, 2n)).toBe(-5n);
    });
  });

  describe("roundBigInt", () => {
    test("rounds down", () => {
      expect(roundBigInt(15n, 10n, "down")).toBe(1n);
      expect(roundBigInt(19n, 10n, "down")).toBe(1n);
    });

    test("rounds up", () => {
      expect(roundBigInt(11n, 10n, "up")).toBe(2n);
      expect(roundBigInt(19n, 10n, "up")).toBe(2n);
      expect(roundBigInt(10n, 10n, "up")).toBe(1n); // no remainder
    });

    test("rounds nearest", () => {
      expect(roundBigInt(14n, 10n, "nearest")).toBe(1n);
      expect(roundBigInt(15n, 10n, "nearest")).toBe(2n); // half up
      expect(roundBigInt(16n, 10n, "nearest")).toBe(2n);
    });

    test("handles negative values", () => {
      expect(roundBigInt(-15n, 10n, "nearest")).toBe(-2n);
      expect(roundBigInt(-14n, 10n, "nearest")).toBe(-1n);
      expect(roundBigInt(15n, -10n, "nearest")).toBe(-2n);
    });

    test("throws on division by zero", () => {
      expect(() => roundBigInt(10n, 0n, "down")).toThrow("Division by zero");
    });
    
    test("works with large numbers", () => {
      const veryLarge = 123456789012345678901234567890n;
      expect(roundBigInt(veryLarge, 10n, "down")).toBe(12345678901234567890123456789n);
    });
  });

  describe("parseDecimalStringToBigInt", () => {
    test("parses integers", () => {
      expect(parseDecimalStringToBigInt("10", 2)).toBe(1000n);
    });

    test("parses decimals", () => {
      expect(parseDecimalStringToBigInt("10.50", 2)).toBe(1050n);
      expect(parseDecimalStringToBigInt("0.5", 2)).toBe(50n);
      expect(parseDecimalStringToBigInt(".5", 2)).toBe(50n);
    });

    test("truncates extra decimals", () => {
      expect(parseDecimalStringToBigInt("10.555", 2)).toBe(1055n);
    });

    test("handles negatives", () => {
      expect(parseDecimalStringToBigInt("-10.5", 2)).toBe(-1050n);
    });

    test("throws on invalid strings", () => {
      expect(() => parseDecimalStringToBigInt("abc", 2)).toThrow();
      expect(() => parseDecimalStringToBigInt(".", 2)).toThrow();
      expect(() => parseDecimalStringToBigInt("10.5.5", 2)).toThrow();
      expect(() => parseDecimalStringToBigInt("", 2)).toThrow();
    });
  });

  describe("formatBigIntAsDecimalString", () => {
    test("formats integers", () => {
      expect(formatBigIntAsDecimalString(1000n, 2)).toBe("10.00");
    });

    test("formats small numbers", () => {
      expect(formatBigIntAsDecimalString(5n, 2)).toBe("0.05");
      expect(formatBigIntAsDecimalString(50n, 2)).toBe("0.50");
    });

    test("formats zero", () => {
      expect(formatBigIntAsDecimalString(0n, 2)).toBe("0.00");
      expect(formatBigIntAsDecimalString(0n, 0)).toBe("0");
    });

    test("formats negatives", () => {
      expect(formatBigIntAsDecimalString(-1050n, 2)).toBe("-10.50");
      expect(formatBigIntAsDecimalString(-5n, 2)).toBe("-0.05");
    });
    
    test("formats with 0 decimals", () => {
      expect(formatBigIntAsDecimalString(1050n, 0)).toBe("1050");
    });

    test("round-trip correctness", () => {
      const original = "12345.6789";
      const parsed = parseDecimalStringToBigInt(original, 4);
      expect(formatBigIntAsDecimalString(parsed, 4)).toBe(original);
      
      const veryLarge = "98765432109876543210.12";
      expect(formatBigIntAsDecimalString(parseDecimalStringToBigInt(veryLarge, 2), 2)).toBe(veryLarge);
    });
  });
});
