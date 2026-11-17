// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { onboarding } from "@/lib/onboarding";

if (typeof globalThis.window === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  (dom.window as any).fetch = fetch;
  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  globalThis.navigator = dom.window.navigator as any;
  globalThis.HTMLElement = dom.window.HTMLElement as any;
  globalThis.MutationObserver = dom.window.MutationObserver as any;
}

const WALLET_A = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const WALLET_B = "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";

beforeEach(() => {
  window.localStorage.clear();
});

describe("onboarding", () => {
  it("reports onboarding as not complete by default", () => {
    expect(onboarding.isComplete(WALLET_A)).toBe(false);
  });

  it("marks onboarding complete after markComplete is called", () => {
    onboarding.markComplete(WALLET_A);
    expect(onboarding.isComplete(WALLET_A)).toBe(true);
  });

  it("keeps completion state separate per wallet address", () => {
    onboarding.markComplete(WALLET_A);

    expect(onboarding.isComplete(WALLET_A)).toBe(true);
    expect(onboarding.isComplete(WALLET_B)).toBe(false);

    onboarding.markComplete(WALLET_B);
    expect(onboarding.isComplete(WALLET_B)).toBe(true);
  });

  it("returns false from isComplete and does not throw in markComplete when window is undefined", () => {
    onboarding.markComplete(WALLET_A);
    expect(onboarding.isComplete(WALLET_A)).toBe(true);

    const savedWindow = globalThis.window;
    delete (globalThis as any).window;
    try {
      expect(onboarding.isComplete(WALLET_A)).toBe(false);
      expect(() => onboarding.markComplete(WALLET_B)).not.toThrow();
    } finally {
      globalThis.window = savedWindow;
    }
  });

  it("returns false for an empty address or when storage access fails", () => {
    onboarding.markComplete("");
    expect(onboarding.isComplete("")).toBe(false);

    window.localStorage.setItem(`akkuea-land:onboarded:${WALLET_A}`, "false");
    expect(onboarding.isComplete(WALLET_A)).toBe(false);

    const getItemSpy = spyOn(
      Object.getPrototypeOf(window.localStorage),
      "getItem",
    ).mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const setItemSpy = spyOn(
      Object.getPrototypeOf(window.localStorage),
      "setItem",
    ).mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    try {
      expect(onboarding.isComplete(WALLET_A)).toBe(false);
      expect(() => onboarding.markComplete(WALLET_A)).not.toThrow();
    } finally {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });
});
