import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Mock IntersectionObserver
  global.IntersectionObserver = class MockIntersectionObserver implements IntersectionObserver {
    root: Element | Document | null = null;
    rootMargin: string = '0px';
    thresholds: ReadonlyArray<number> = [0];

    constructor(
      public callback: IntersectionObserverCallback,
      public options?: IntersectionObserverInit
    ) {
      this.root = options?.root || null;
      this.rootMargin = options?.rootMargin || '0px';
      this.thresholds = options?.threshold
        ? Array.isArray(options.threshold)
          ? options.threshold
          : [options.threshold]
        : [0];
    }

    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };

  // Mock ResizeObserver
  global.ResizeObserver = class MockResizeObserver implements ResizeObserver {
    constructor(public callback: ResizeObserverCallback) {}
    disconnect() {}
    observe() {}
    unobserve() {}
  };

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  // Mock scrollTo
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: () => {},
  });

  // Mock fetch if not available
  if (!global.fetch) {
    global.fetch = async () => {
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }
});
