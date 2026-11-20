import { describe, expect, it } from "bun:test";
import { isValidEvidenceLink, parseEvidenceLink } from "../evidenceLink";

describe("parseEvidenceLink", () => {
  it("rejects http:// URLs", () => {
    expect(parseEvidenceLink("http://example.com/statement.pdf")).toBeNull();
    expect(isValidEvidenceLink("http://example.com")).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(parseEvidenceLink("javascript:alert('xss')")).toBeNull();
    expect(isValidEvidenceLink("javascript:void(0)")).toBe(false);
  });

  it("rejects data: URLs", () => {
    expect(
      parseEvidenceLink("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="),
    ).toBeNull();
    expect(isValidEvidenceLink("data:text/plain;charset=utf-8,hello")).toBe(false);
  });

  it("rejects relative paths", () => {
    expect(parseEvidenceLink("/statements/2026-08.pdf")).toBeNull();
    expect(parseEvidenceLink("./statements/2026-08.pdf")).toBeNull();
    expect(parseEvidenceLink("../statements/2026-08.pdf")).toBeNull();
    expect(parseEvidenceLink("statement.pdf")).toBeNull();
    expect(isValidEvidenceLink("/path/to/evidence")).toBe(false);
  });

  it("rejects strings with spaces", () => {
    expect(parseEvidenceLink("a string with spaces")).toBeNull();
    expect(parseEvidenceLink("https://example.com/my statement.pdf")).toBeNull();
    expect(parseEvidenceLink("https://example.com ")).toBeNull();
    expect(parseEvidenceLink(" https://example.com")).toBeNull();
    expect(parseEvidenceLink("   ")).toBeNull();
    expect(isValidEvidenceLink("   ")).toBe(false);
  });

  it("rejects other non-https schemes and malformed URLs", () => {
    expect(parseEvidenceLink("ftp://example.com/statement.pdf")).toBeNull();
    expect(parseEvidenceLink("file:///etc/passwd")).toBeNull();
    expect(parseEvidenceLink("https://")).toBeNull();
    expect(parseEvidenceLink("https:///")).toBeNull();
    expect(parseEvidenceLink("")).toBeNull();
    expect(parseEvidenceLink(null)).toBeNull();
    expect(parseEvidenceLink(undefined)).toBeNull();
    expect(parseEvidenceLink(123)).toBeNull();
  });

  it("accepts a valid absolute https URL and returns the parsed result", () => {
    const valid = "https://example.org/statements/2026-08.pdf";
    const result = parseEvidenceLink(valid);
    expect(result).not.toBeNull();
    expect(result?.href).toBe(valid);
    expect(result?.url).toBeInstanceOf(URL);
    expect(result?.url.protocol).toBe("https:");
    expect(result?.url.hostname).toBe("example.org");
    expect(result?.url.pathname).toBe("/statements/2026-08.pdf");
    expect(isValidEvidenceLink(valid)).toBe(true);
  });

  it("preserves query parameters and hashes on valid https URLs", () => {
    const valid = "https://example.org/statements/report.pdf?version=2#page=1";
    const result = parseEvidenceLink(valid);
    expect(result).not.toBeNull();
    expect(result?.url.searchParams.get("version")).toBe("2");
    expect(result?.url.hash).toBe("#page=1");
  });
});
