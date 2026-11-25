/**
 * onboarding - unit tests
 *
 * The helper remembers per wallet address whether the onboarding tour ran.
 * Tests cover the default state, marking it complete, keeping wallets apart,
 * and the server-side render path where window does not exist.
 *
 * localStorage comes from the shared in-memory JSDOM realm (see
 * src/test/setupJsdom.ts); nothing touches the real browser storage of the
 * test runner.
 */

// All land tests share one JSDOM realm (see src/test/setupJsdom.ts).
// axe-core captures window/document when it is first imported, so renders
// and axe.run calls must use the same realm or axe rejects the container.
import { ensureSharedDom } from "@/test/setupJsdom";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { onboarding } from "../onboarding";

const ADDRESS = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const OTHER_ADDRESS = "GDOTHERPLAYERADDRESSFORONBOARDINGTESTSONLYXXXXXXXXXXXXX";

beforeEach(() => {
  ensureSharedDom();
  localStorage.clear();
});

afterEach(() => {
  ensureSharedDom();
});

describe("onboarding", () => {
  it("is not complete for a wallet that has never finished onboarding", () => {
    expect(onboarding.isComplete(ADDRESS)).toBe(false);
  });

  it("is complete after markComplete", () => {
    onboarding.markComplete(ADDRESS);

    expect(onboarding.isComplete(ADDRESS)).toBe(true);
    expect(localStorage.getItem(`akkuea-land:onboarded:${ADDRESS}`)).toBe(
      "true",
    );
  });

  it("keeps completion separate per wallet address", () => {
    onboarding.markComplete(ADDRESS);

    expect(onboarding.isComplete(ADDRESS)).toBe(true);
    expect(onboarding.isComplete(OTHER_ADDRESS)).toBe(false);

    onboarding.markComplete(OTHER_ADDRESS);

    expect(onboarding.isComplete(ADDRESS)).toBe(true);
    expect(onboarding.isComplete(OTHER_ADDRESS)).toBe(true);
  });

  it("reports incomplete during a server render, where window is undefined", () => {
    onboarding.markComplete(ADDRESS);

    const savedWindow = globalThis.window;
    delete (globalThis as any).window;

    try {
      expect(typeof window).toBe("undefined");
      expect(onboarding.isComplete(ADDRESS)).toBe(false);
    } finally {
      globalThis.window = savedWindow;
    }

    // Once window is back, the stored answer is unchanged.
    expect(onboarding.isComplete(ADDRESS)).toBe(true);
  });
});
