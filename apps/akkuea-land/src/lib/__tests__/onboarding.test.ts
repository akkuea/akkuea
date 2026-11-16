// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { onboarding } from "../onboarding";

const WALLET_A = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const WALLET_B = "GDVIEWER123456789012345678901234567890123456789012345678";

const originalWindow = globalThis.window;

beforeEach(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  window.localStorage.clear();
});

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("onboarding", () => {
  it("returns false by default before onboarding is completed", () => {
    expect(onboarding.isComplete(WALLET_A)).toBe(false);
  });

  it("marks onboarding complete for a wallet address", () => {
    onboarding.markComplete(WALLET_A);
    expect(onboarding.isComplete(WALLET_A)).toBe(true);
  });

  it("stores completion status separately per wallet address", () => {
    onboarding.markComplete(WALLET_A);

    expect(onboarding.isComplete(WALLET_A)).toBe(true);
    expect(onboarding.isComplete(WALLET_B)).toBe(false);
  });

  it("returns false and avoids throwing when window is undefined", () => {
    // @ts-expect-error: simulating server-side execution without window
    globalThis.window = undefined;

    expect(onboarding.isComplete(WALLET_A)).toBe(false);
    expect(() => onboarding.markComplete(WALLET_A)).not.toThrow();
  });

  it("ignores blank wallet addresses and handles unavailable localStorage safely", () => {
    onboarding.markComplete("   ");
    expect(onboarding.isComplete("   ")).toBe(false);

    Object.defineProperty(globalThis.window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError: storage disabled");
      },
    });

    expect(onboarding.isComplete(WALLET_A)).toBe(false);
    expect(() => onboarding.markComplete(WALLET_A)).not.toThrow();
  });
});
