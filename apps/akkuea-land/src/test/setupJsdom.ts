/**
 * One shared JSDOM realm for every land test file.
 *
 * axe-core captures `window` and `document` when it is first imported, and
 * only re-derives them when they are missing. Every test file used to build
 * its own JSDOM and replace the globals, so axe kept the first file's
 * window while renders happened in later files' documents, and every
 * `axe.run(container)` call failed with "axe.run arguments are invalid"
 * (`container instanceof window.Node` was false across realms).
 *
 * Importing this module creates the single shared JSDOM and points the
 * globals at it; `ensureSharedDom` re-points them, so test files that run
 * after a file with its own JSDOM still render and audit in this realm.
 * Import it before `axe-core` in every test file that calls `axe.run`.
 * The shared realm also provides `localStorage`: the onboarding helper
 * reads the bare `localStorage` global, so the onboarding tests use this
 * realm's storage instead of building their own JSDOM for it.
 */

// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

export function ensureSharedDom(): void {
  (dom.window as any).fetch = fetch;
  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  globalThis.navigator = dom.window.navigator as any;
  globalThis.HTMLElement = dom.window.HTMLElement as any;
  globalThis.MutationObserver = dom.window.MutationObserver as any;
  (globalThis as any).localStorage = dom.window.localStorage as any;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
}

ensureSharedDom();
