// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

// Standard browser mock environment setup for JSDOM in Bun environment
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
(dom.window as any).fetch = fetch;
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
globalThis.HTMLElement = dom.window.HTMLElement as any;
globalThis.MutationObserver = dom.window.MutationObserver as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, mock, vi, beforeEach } from "bun:test";
import React from "react";
import { cleanup, render, fireEvent, getByText } from "@testing-library/react";

// Mock framer-motion to bypass layout/sheet animations for synchronous UI assertions
mock.module("framer-motion", () => {
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: ({ children, whileHover, whileTap, ...props }: any) => (
        <div {...props}>{children}</div>
      ),
      button: ({ children, whileHover, whileTap, ...props }: any) => (
        <button {...props}>{children}</button>
      ),
    },
  };
});

import { WelcomeStep } from "../WelcomeStep";

describe("WelcomeStep", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders welcome title and description correctly", () => {
    const onNext = mock(() => {});

    const view = render(<WelcomeStep onNext={onNext} />);

    expect(view.getByText(/Welcome to Akkuea Land/i)).not.toBeNull();
    expect(
      view.getByText(
        /Explore and buy virtual properties in a dynamic, live city grid/i,
      ),
    ).not.toBeNull();
    expect(
      view.getByText(
        /Your Stellar wallet has been set up securely through Pollar/i,
      ),
    ).not.toBeNull();
  });

  it("renders the 5x5 sample city grid illustration (25 tiles)", () => {
    const onNext = mock(() => {});

    const view = render(<WelcomeStep onNext={onNext} />);

    // The grid renders 25 tiles (5x5 = 25)
    const gridContainer = view.container.querySelector(
      '[style*="grid-template-columns: repeat(5, 2.5rem)"]',
    );
    expect(gridContainer).not.toBeNull();
    expect(gridContainer?.children.length).toBe(25);
  });

  it("renders 'Get Started' button and calls onNext when clicked", () => {
    const onNext = mock(() => {});

    const view = render(<WelcomeStep onNext={onNext} />);

    const getStartedButton = view.getByRole("button", {
      name: /Get Started/i,
    });
    expect(getStartedButton).not.toBeNull();

    fireEvent.click(getStartedButton);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("does not call onNext before button click", () => {
    const onNext = mock(() => {});

    render(<WelcomeStep onNext={onNext} />);

    expect(onNext).not.toHaveBeenCalled();
  });
});
