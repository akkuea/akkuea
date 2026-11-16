import { describe, expect, it } from "bun:test";
import { parseEvidenceUrl } from "../evidenceUrl";

describe("parseEvidenceUrl", () => {
  it("accepts a valid https URL with path, query, and fragment", () => {
    const raw =
      "https://storage.example.org/statements/2026-03.pdf?v=2#summary";
    const result = parseEvidenceUrl(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.href).toBe(raw);
      expect(result.url.protocol).toBe("https:");
      expect(result.url.hostname).toBe("storage.example.org");
    }
  });

  it("rejects empty and whitespace-only strings", () => {
    expect(parseEvidenceUrl("")).toEqual({ ok: false, reason: "empty" });
    expect(parseEvidenceUrl("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects http:// URLs", () => {
    expect(
      parseEvidenceUrl("http://example.org/statements/2026-03.pdf"),
    ).toEqual({
      ok: false,
      reason: "non_https",
    });
  });

  it("rejects javascript: URLs", () => {
    expect(parseEvidenceUrl("javascript:alert(1)")).toEqual({
      ok: false,
      reason: "non_https",
    });
  });

  it("rejects data: URLs", () => {
    expect(parseEvidenceUrl("data:text/plain;base64,SGVsbG8=")).toEqual({
      ok: false,
      reason: "non_https",
    });
  });

  it("rejects relative and scheme-relative paths", () => {
    expect(parseEvidenceUrl("/statements/2026-03.pdf")).toEqual({
      ok: false,
      reason: "invalid_url",
    });
    expect(parseEvidenceUrl("statements/2026-03.pdf")).toEqual({
      ok: false,
      reason: "invalid_url",
    });
    expect(parseEvidenceUrl("./2026-03.pdf")).toEqual({
      ok: false,
      reason: "invalid_url",
    });
    expect(parseEvidenceUrl("//example.org/statements/2026-03.pdf")).toEqual({
      ok: false,
      reason: "invalid_url",
    });
  });

  it("rejects strings containing spaces anywhere", () => {
    expect(parseEvidenceUrl("https://example.org/statement 2026.pdf")).toEqual({
      ok: false,
      reason: "whitespace",
    });
    expect(parseEvidenceUrl(" https://example.org/statement.pdf")).toEqual({
      ok: false,
      reason: "whitespace",
    });
    expect(parseEvidenceUrl("https://example.org/statement.pdf ")).toEqual({
      ok: false,
      reason: "whitespace",
    });
  });

  it("rejects https URLs carrying embedded credentials", () => {
    expect(
      parseEvidenceUrl("https://user:token@example.org/statements/2026-03.pdf"),
    ).toEqual({
      ok: false,
      reason: "credentials",
    });
  });
});
