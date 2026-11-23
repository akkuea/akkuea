/**
 * onboarding - unit tests
 *
 * The helper remembers per wallet address whether the onboarding tour ran.
 * Tests cover the default state, marking it complete, keeping wallets apart,
 * and the server-side render path where window does not exist.
 *
 * localStorage comes from an in-memory JSDOM instance; nothing touches the
 * real browser storage of the test runner.
 */

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";
import { onboarding } from "../onboarding";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
// jsdom has no fetch; axe-core (used by the a11y tests) needs one on window.
(dom.window as any).fetch = fetch;

// Restore what this file replaces so later files in the same bun process keep
// their own DOM setup.
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  localStorage: (globalThis as any).localStorage,
};

const ADDRESS = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const OTHER_ADDRESS = "GDOTHERPLAYERADDRESSFORONBOARDINGTESTSONLYXXXXXXXXXXXXX";

function installBrowserGlobals() {
  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  (globalThis as any).localStorage = dom.window.localStorage;
}

// The module reads `window`/`localStorage` at call time, so the globals only
// need to exist before the first assertion.
installBrowserGlobals();

beforeEach(() => {
  installBrowserGlobals();
  dom.window.localStorage.clear();
});

afterEach(() => {
  installBrowserGlobals();
});

afterAll(() => {
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
  (globalThis as any).localStorage = originalGlobals.localStorage;
});

describe("onboarding", () => {
  it("is not complete for a wallet that has never finished onboarding", () => {
    expect(onboarding.isComplete(ADDRESS)).toBe(false);
  });

  it("is complete after markComplete", () => {
    onboarding.markComplete(ADDRESS);

    expect(onboarding.isComplete(ADDRESS)).toBe(true);
    expect(
      dom.window.localStorage.getItem(`akkuea-land:onboarded:${ADDRESS}`),
    ).toBe("true");
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
