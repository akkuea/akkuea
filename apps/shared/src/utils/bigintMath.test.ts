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
      expect(safeDivide(BigInt(10), BigInt(2))).toBe(BigInt(5));
    });

    test("divides negative numbers", () => {
      expect(safeDivide(BigInt(-10), BigInt(2))).toBe(BigInt(-5));
      expect(safeDivide(BigInt(10), BigInt(-2))).toBe(BigInt(-5));
      expect(safeDivide(BigInt(-10), BigInt(-2))).toBe(BigInt(5));
    });

    test("throws on division by zero", () => {
      expect(() => safeDivide(BigInt(10), BigInt(0))).toThrow(
        "Division by zero",
      );
    });

    test("truncates correctly", () => {
      expect(safeDivide(BigInt(11), BigInt(2))).toBe(BigInt(5));
      expect(safeDivide(BigInt(-11), BigInt(2))).toBe(BigInt(-5));
    });
  });

  describe("roundBigInt", () => {
    test("rounds down", () => {
      expect(roundBigInt(BigInt(15), BigInt(10), "down")).toBe(BigInt(1));
      expect(roundBigInt(BigInt(19), BigInt(10), "down")).toBe(BigInt(1));
    });

    test("rounds up", () => {
      expect(roundBigInt(BigInt(11), BigInt(10), "up")).toBe(BigInt(2));
      expect(roundBigInt(BigInt(19), BigInt(10), "up")).toBe(BigInt(2));
      expect(roundBigInt(BigInt(10), BigInt(10), "up")).toBe(BigInt(1)); // no remainder
    });

    test("rounds nearest", () => {
      expect(roundBigInt(BigInt(14), BigInt(10), "nearest")).toBe(BigInt(1));
      expect(roundBigInt(BigInt(15), BigInt(10), "nearest")).toBe(BigInt(2)); // half up
      expect(roundBigInt(BigInt(16), BigInt(10), "nearest")).toBe(BigInt(2));
    });

    test("handles negative values", () => {
      expect(roundBigInt(BigInt(-15), BigInt(10), "nearest")).toBe(BigInt(-2));
      expect(roundBigInt(BigInt(-14), BigInt(10), "nearest")).toBe(BigInt(-1));
      expect(roundBigInt(BigInt(15), BigInt(-10), "nearest")).toBe(BigInt(-2));
    });

    test("throws on division by zero", () => {
      expect(() => roundBigInt(BigInt(10), BigInt(0), "down")).toThrow(
        "Division by zero",
      );
    });

    test("works with large numbers", () => {
      const veryLarge = BigInt("123456789012345678901234567890");
      expect(roundBigInt(veryLarge, BigInt(10), "down")).toBe(
        BigInt("12345678901234567890123456789"),
      );
    });
  });

  describe("parseDecimalStringToBigInt", () => {
    test("parses integers", () => {
      expect(parseDecimalStringToBigInt("10", 2)).toBe(BigInt(1000));
    });

    test("parses decimals", () => {
      expect(parseDecimalStringToBigInt("10.50", 2)).toBe(BigInt(1050));
      expect(parseDecimalStringToBigInt("0.5", 2)).toBe(BigInt(50));
      expect(parseDecimalStringToBigInt(".5", 2)).toBe(BigInt(50));
    });

    test("truncates extra decimals", () => {
      expect(parseDecimalStringToBigInt("10.555", 2)).toBe(BigInt(1055));
    });

    test("handles negatives", () => {
      expect(parseDecimalStringToBigInt("-10.5", 2)).toBe(BigInt(-1050));
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
      expect(formatBigIntAsDecimalString(BigInt(1000), 2)).toBe("10.00");
    });

    test("formats small numbers", () => {
      expect(formatBigIntAsDecimalString(BigInt(5), 2)).toBe("0.05");
      expect(formatBigIntAsDecimalString(BigInt(50), 2)).toBe("0.50");
    });

    test("formats zero", () => {
      expect(formatBigIntAsDecimalString(BigInt(0), 2)).toBe("0.00");
      expect(formatBigIntAsDecimalString(BigInt(0), 0)).toBe("0");
    });

    test("formats negatives", () => {
      expect(formatBigIntAsDecimalString(BigInt(-1050), 2)).toBe("-10.50");
      expect(formatBigIntAsDecimalString(BigInt(-5), 2)).toBe("-0.05");
    });

    test("formats with 0 decimals", () => {
      expect(formatBigIntAsDecimalString(BigInt(1050), 0)).toBe("1050");
    });

    test("round-trip correctness", () => {
      const original = "12345.6789";
      const parsed = parseDecimalStringToBigInt(original, 4);
      expect(formatBigIntAsDecimalString(parsed, 4)).toBe(original);

      const veryLarge = "98765432109876543210.12";
      expect(
        formatBigIntAsDecimalString(
          parseDecimalStringToBigInt(veryLarge, 2),
          2,
        ),
      ).toBe(veryLarge);
    });
  });
});
