import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

Object.defineProperty(globalThis, "window", {
  value: dom.window,
  writable: true,
});

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

Object.defineProperty(globalThis, "MutationObserver", {
  value: dom.window.MutationObserver,
  writable: true,
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
});
