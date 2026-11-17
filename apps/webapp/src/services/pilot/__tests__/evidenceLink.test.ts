import { describe, expect, it } from "bun:test";
import { parseEvidenceLink } from "../evidenceLink";

describe("parseEvidenceLink", () => {
  it("accepts a valid absolute https URL and returns the parsed result", () => {
    const parsed = parseEvidenceLink(
      "https://example.org/statements/2026-08.pdf?v=1",
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.href).toBe("https://example.org/statements/2026-08.pdf?v=1");
    expect(parsed?.url.protocol).toBe("https:");
    expect(parsed?.url.hostname).toBe("example.org");
  });

  it("rejects http:// URLs", () => {
    expect(
      parseEvidenceLink("http://example.org/statements/2026-08.pdf"),
    ).toBeNull();
  });

  it("rejects javascript: URLs", () => {
    expect(parseEvidenceLink("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(
      parseEvidenceLink(
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      ),
    ).toBeNull();
  });

  it("rejects relative paths and protocol-relative URLs", () => {
    expect(parseEvidenceLink("/statements/2026-08.pdf")).toBeNull();
    expect(parseEvidenceLink("statements/2026-08.pdf")).toBeNull();
    expect(parseEvidenceLink("./2026-08.pdf")).toBeNull();
    expect(
      parseEvidenceLink("//example.org/statements/2026-08.pdf"),
    ).toBeNull();
  });

  it("rejects empty strings and strings containing spaces", () => {
    expect(parseEvidenceLink("")).toBeNull();
    expect(parseEvidenceLink("   ")).toBeNull();
    expect(
      parseEvidenceLink("https://example.org/statements/august 2026.pdf"),
    ).toBeNull();
    expect(
      parseEvidenceLink(" https://example.org/statements/2026-08.pdf"),
    ).toBeNull();
    expect(parseEvidenceLink("not a url")).toBeNull();
  });
});
