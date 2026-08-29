import { afterEach } from "bun:test";
import { JSDOM } from "jsdom";

/**
 * Installs a DOM for component tests.
 *
 * The JSDOM instance is cached on `globalThis`, because this module is
 * evaluated once per test file. Building a fresh DOM each time would leave
 * already-rendered nodes belonging to an earlier realm while the globals point
 * at the newest one, and every cross-realm `instanceof` check inside React or
 * Testing Library would then fail in ways that depend on file order.
 */
const CACHE_KEY = "__akkueaTestDom";

/** `JSDOM` is exported as a class value, so the instance type is derived. */
type JsdomInstance = InstanceType<typeof JSDOM>;

type DomCache = typeof globalThis & { [CACHE_KEY]?: JsdomInstance };

const cache = globalThis as DomCache;

const dom: JsdomInstance =
  cache[CACHE_KEY] ??
  new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });

cache[CACHE_KEY] = dom;

// Sharing one realm means sharing one document, so anything a test leaves
// attached stays visible to body-scoped queries in whatever runs next. Testing
// Library unmounts its own containers, but a render that threw, or one made
// outside it, does not get cleaned up. Body-scoped queries then see both trees:
// a leftover button lands in the middle of another file's focus-order
// assertions, and the failure depends on file order.
dom.window.document.body.innerHTML = "";

afterEach(() => {
  dom.window.document.body.innerHTML = "";
});

Object.defineProperty(globalThis, "window", {
  value: dom.window,
  writable: true,
});
globalThis.window.fetch = fetch;

Object.defineProperty(globalThis, "document", {
  value: dom.window.document,
  writable: true,
});

Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  writable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: dom.window.localStorage,
  writable: true,
});

Object.defineProperty(globalThis, "HTMLElement", {
  value: dom.window.HTMLElement,
  writable: true,
});

Object.defineProperty(globalThis, "SVGElement", {
  value: dom.window.SVGElement,
  writable: true,
});

Object.defineProperty(globalThis, "Element", {
  value: dom.window.Element,
  writable: true,
});

Object.defineProperty(globalThis, "Node", {
  value: dom.window.Node,
  writable: true,
});

Object.defineProperty(globalThis, "MutationObserver", {
  value: dom.window.MutationObserver,
  writable: true,
});

// jsdom validates an `addEventListener` signal against its own AbortSignal
// class, and React attaches its act-environment listener with a signal built
// from the runtime's AbortController. jsdom rejects it, so any component that
// registers a listener (a framer-motion Button, for instance) fails to render.
//
// Only the listener path is patched. Swapping the global AbortController and
// AbortSignal for jsdom's fixes the same symptom but hands every abort-aware
// call in the app, fetch included, a signal its own runtime does not recognise,
// which strands anything waiting on one.
type ListenerOptions =
  boolean | (AddEventListenerOptions & { signal?: unknown });

const eventTarget = dom.window.EventTarget.prototype;
const nativeAddEventListener = eventTarget.addEventListener;

eventTarget.addEventListener = function patchedAddEventListener(
  this: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: ListenerOptions,
) {
  const signal =
    options && typeof options === "object" ? options.signal : undefined;

  if (signal && !(signal instanceof dom.window.AbortSignal)) {
    const { signal: foreignSignal, ...rest } =
      options as AddEventListenerOptions & {
        signal?: unknown;
      };
    nativeAddEventListener.call(this, type, listener, rest);

    // Preserve the abort contract the caller asked for, minus the type jsdom
    // refuses to accept.
    (foreignSignal as AbortSignal).addEventListener(
      "abort",
      () => this.removeEventListener(type, listener, rest),
      { once: true },
    );
    return;
  }

  return nativeAddEventListener.call(
    this,
    type,
    listener,
    options as AddEventListenerOptions,
  );
} as typeof eventTarget.addEventListener;

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
});
