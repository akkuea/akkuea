/**
 * Lets jsdom accept the listeners React registers under test.
 *
 * jsdom validates an `addEventListener` signal against its own AbortSignal
 * class, and React attaches its act-environment listener with a signal built
 * from the runtime's AbortController. jsdom rejects it, so any component that
 * registers a listener, a framer-motion Button for instance, fails to render.
 *
 * Two things this deliberately does not do. It does not replace the global
 * AbortController and AbortSignal with jsdom's: that fixes the same symptom but
 * hands every abort-aware call in the app, `fetch` included, a signal its own
 * runtime does not recognise, which strands anything waiting on one. And it is
 * not installed from `setup-dom`, so a test file that does not need it keeps
 * the DOM behaviour the rest of the suite has always run against.
 *
 * Import it once, before rendering, in a test that renders such a component.
 */

type ListenerOptions =
  boolean | (AddEventListenerOptions & { signal?: unknown });

interface JsdomGlobals {
  EventTarget: typeof EventTarget;
  AbortSignal: typeof AbortSignal;
}

// `setup-dom` points globalThis.window at the jsdom window, and these classes
// have to come from that same realm for the instanceof check below to mean
// anything.
const jsdomWindow = globalThis.window as unknown as JsdomGlobals | undefined;

if (!jsdomWindow?.EventTarget) {
  throw new Error(
    'jsdomListenerSignal requires the jsdom window. Import "@/test/setup-dom" first.',
  );
}

const eventTarget = jsdomWindow.EventTarget.prototype;
const nativeAddEventListener = eventTarget.addEventListener;

eventTarget.addEventListener = function patchedAddEventListener(
  this: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: ListenerOptions,
) {
  const signal =
    options && typeof options === "object" ? options.signal : undefined;

  if (signal && !(signal instanceof jsdomWindow.AbortSignal)) {
    const { signal: foreignSignal, ...rest } =
      options as AddEventListenerOptions & { signal?: unknown };
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
