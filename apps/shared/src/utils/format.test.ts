import { expect, test, describe } from "bun:test";
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelativeTime,
  abbreviateNumber,
} from "./format";

describe("format utilities", () => {
  describe("formatCurrency", () => {
    test("formats USD correctly", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(0)).toBe("$0.00");
      expect(formatCurrency(-123.4)).toBe("-$123.40");
    });

    test("formats with custom currency", () => {
      expect(formatCurrency(100, "en-US", "EUR")).toBe("€100.00");
    });
  });

  describe("formatPercent", () => {
    test("formats decimals correctly", () => {
      expect(formatPercent(0.1234)).toBe("12.34%");
      expect(formatPercent(0.5, 0)).toBe("50%");
      expect(formatPercent(0.001, 3)).toBe("0.100%");
    });
  });

  describe("formatDate", () => {
    test("formats date correctly", () => {
      const date = new Date("2024-01-01T12:00:00Z");
      expect(formatDate(date)).toContain("Jan 1, 2024");
    });
  });

  describe("formatRelativeTime", () => {
    test("formats past time correctly", () => {
      const now = new Date();
      const past = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      expect(formatRelativeTime(past)).toBe("2 hours ago");
    });

    test("formats future time correctly", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now
      expect(formatRelativeTime(future)).toBe("tomorrow");
    });

    test("formats 'now' as '0 seconds ago' or similar", () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toMatch(/now|0 seconds ago/);
    });
  });

  describe("abbreviateNumber", () => {
    test("abbreviates large numbers correctly", () => {
      expect(abbreviateNumber(1200)).toBe("1.2K");
      expect(abbreviateNumber(1500000)).toBe("1.5M");
      expect(abbreviateNumber(2000000000)).toBe("2B");
    });

    test("abbreviates with custom decimals", () => {
      expect(abbreviateNumber(1234, 2)).toBe("1.23K");
    });
  });
});
