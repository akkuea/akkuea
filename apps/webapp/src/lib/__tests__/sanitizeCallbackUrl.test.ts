import { describe, expect, it } from "bun:test";
import {
  DEFAULT_CALLBACK_URL,
  sanitizeCallbackUrl,
} from "../sanitizeCallbackUrl";

const BASE = "https://app.example.com";

describe("sanitizeCallbackUrl", () => {
  it("accepts a relative dashboard path", () => {
    expect(sanitizeCallbackUrl("/en/dashboard", BASE)).toBe("/en/dashboard");
  });

  it("preserves query strings on deep links", () => {
    expect(sanitizeCallbackUrl("/en/properties/1?tab=x", BASE)).toBe(
      "/en/properties/1?tab=x",
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("//evil.example", BASE)).toBe(
      DEFAULT_CALLBACK_URL,
    );
  });

  it("rejects backslash host variants", () => {
    expect(sanitizeCallbackUrl("/\\evil.example", BASE)).toBe(
      DEFAULT_CALLBACK_URL,
    );
  });

  it("rejects absolute off-origin URLs", () => {
    expect(sanitizeCallbackUrl("https://evil.example", BASE)).toBe(
      DEFAULT_CALLBACK_URL,
    );
  });

  it("rejects javascript schemes", () => {
    expect(sanitizeCallbackUrl("javascript:alert(1)", BASE)).toBe(
      DEFAULT_CALLBACK_URL,
    );
  });

  it("falls back for an empty string", () => {
    expect(sanitizeCallbackUrl("", BASE)).toBe(DEFAULT_CALLBACK_URL);
  });

  it("falls back for null", () => {
    expect(sanitizeCallbackUrl(null, BASE)).toBe(DEFAULT_CALLBACK_URL);
  });

  it("falls back for undefined", () => {
    expect(sanitizeCallbackUrl(undefined, BASE)).toBe(DEFAULT_CALLBACK_URL);
  });
});
