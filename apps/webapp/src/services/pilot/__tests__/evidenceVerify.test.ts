import { afterEach, describe, expect, it } from "bun:test";
import {
  normalizeHashHex,
  verifyEvidenceBytes,
  verifyEvidenceDocument,
} from "../evidenceVerify";

/** Computes the same SHA-256 hex the browser path computes. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Buffer.from(new Uint8Array(digest)).toString("hex");
}

function body(text: string): Response {
  return new Response(new TextEncoder().encode(text), { status: 200 });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("normalizeHashHex", () => {
  it("ignores case and a leading 0x", () => {
    expect(normalizeHashHex("0xAB12")).toBe("ab12");
  });
});

describe("verifyEvidenceBytes", () => {
  it("reports a match for a document that hashes to the digest", async () => {
    const text = "August income statement";
    const result = await verifyEvidenceBytes(
      new TextEncoder().encode(text).buffer as ArrayBuffer,
      await sha256Hex(text),
    );
    expect(result.status).toBe("match");
  });

  it("reports a mismatch for a tampered document", async () => {
    const original = "August income statement";
    const tampered = "August income statement (edited)";
    const result = await verifyEvidenceBytes(
      new TextEncoder().encode(tampered).buffer as ArrayBuffer,
      await sha256Hex(original),
    );
    expect(result.status).toBe("mismatch");
    // The computed digest is surfaced so a reader can compare it by hand.
    expect(result.actualHex).toBe(await sha256Hex(tampered));
  });
});

describe("verifyEvidenceDocument", () => {
  it("verifies a reachable document against the on-chain digest", async () => {
    const text = "August income statement";
    globalThis.fetch = (async () => body(text)) as unknown as typeof fetch;

    const result = await verifyEvidenceDocument(
      "https://example.org/statements/2026-08.pdf",
      await sha256Hex(text),
    );
    expect(result.status).toBe("match");
  });

  it("reports unreachable when the source blocks the browser, not a mismatch", async () => {
    // A CORS rejection surfaces as a thrown TypeError from fetch, which must
    // not be presented to an investor as a failed verification.
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const result = await verifyEvidenceDocument(
      "https://example.org/statements/2026-08.pdf",
      await sha256Hex("anything"),
    );
    expect(result.status).toBe("unreachable");
    expect(result.reason).toMatch(/failed to fetch/i);
  });

  it("reports unreachable for a non-200 response", async () => {
    globalThis.fetch = (async () =>
      new Response("gone", { status: 404 })) as unknown as typeof fetch;

    const result = await verifyEvidenceDocument(
      "https://example.org/missing.pdf",
      await sha256Hex("anything"),
    );
    expect(result.status).toBe("unreachable");
    expect(result.reason).toMatch(/404/);
  });
});
