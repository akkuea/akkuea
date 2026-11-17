import { describe, expect, it } from "bun:test";
import {
  isValidEvidenceHttpsUrl,
  parseEvidenceHttpsUrl,
} from "../evidenceUrl";

describe("parseEvidenceHttpsUrl", () => {
  it("rejects http URLs", () => {
    const result = parseEvidenceHttpsUrl("http://example.com/evidence.pdf");
    expect(result.isValid).toBe(false);
    expect(isValidEvidenceHttpsUrl("http://example.com/evidence.pdf")).toBe(false);
    if (!result.isValid) {
      expect(result.reason).toMatch(/https:/i);
    }
  });

  it("rejects javascript: URLs", () => {
    const result = parseEvidenceHttpsUrl("javascript:alert(1)");
    expect(result.isValid).toBe(false);
    expect(isValidEvidenceHttpsUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects data: URLs", () => {
    const result = parseEvidenceHttpsUrl("data:text/plain;base64,SGVsbG8=");
    expect(result.isValid).toBe(false);
    expect(isValidEvidenceHttpsUrl("data:text/plain;base64,SGVsbG8=")).toBe(false);
  });

  it("rejects relative paths", () => {
    const relativePaths = [
      "/statements/2026-03.pdf",
      "statements/2026-03.pdf",
      "./evidence.pdf",
      "../evidence.pdf",
    ];
    for (const path of relativePaths) {
      const result = parseEvidenceHttpsUrl(path);
      expect(result.isValid).toBe(false);
      expect(isValidEvidenceHttpsUrl(path)).toBe(false);
    }
  });

  it("rejects strings with spaces", () => {
    const invalidInputs = [
      "https://example.com/statements/march 2026.pdf",
      "https://example .com/statement.pdf",
      "https:// example.com",
      "   ",
      "https://example.com/\tfile.pdf",
    ];
    for (const input of invalidInputs) {
      const result = parseEvidenceHttpsUrl(input);
      expect(result.isValid).toBe(false);
      expect(isValidEvidenceHttpsUrl(input)).toBe(false);
    }
  });

  it("rejects empty, null, or undefined values", () => {
    expect(parseEvidenceHttpsUrl("").isValid).toBe(false);
    expect(parseEvidenceHttpsUrl(null).isValid).toBe(false);
    expect(parseEvidenceHttpsUrl(undefined).isValid).toBe(false);
    expect(isValidEvidenceHttpsUrl("")).toBe(false);
    expect(isValidEvidenceHttpsUrl(null)).toBe(false);
    expect(isValidEvidenceHttpsUrl(undefined)).toBe(false);
  });

  it("accepts valid https URLs and returns parsed details", () => {
    const validUrl = "https://example.com/statements/2026-03.pdf?download=true#hash";
    const result = parseEvidenceHttpsUrl(validUrl);
    expect(result.isValid).toBe(true);
    expect(isValidEvidenceHttpsUrl(validUrl)).toBe(true);
    if (result.isValid) {
      expect(result.href).toBe(validUrl);
      expect(result.url.hostname).toBe("example.com");
      expect(result.url.protocol).toBe("https:");
      expect(result.url.pathname).toBe("/statements/2026-03.pdf");
    }
  });

  it("trims surrounding whitespace from otherwise valid https URLs", () => {
    const validUrl = "  https://example.com/statements/2026-03.pdf  ";
    const result = parseEvidenceHttpsUrl(validUrl);
    expect(result.isValid).toBe(true);
    expect(isValidEvidenceHttpsUrl(validUrl)).toBe(true);
    if (result.isValid) {
      expect(result.href).toBe("https://example.com/statements/2026-03.pdf");
    }
  });
});
