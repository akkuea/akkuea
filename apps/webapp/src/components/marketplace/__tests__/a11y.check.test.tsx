/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import axe from "axe-core";
import type { PropertyInfo } from "@real-estate-defi/shared";

mock.module("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

mock.module("framer-motion", () => {
  const passthroughDiv = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  >(function PassthroughDiv(
    {
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    },
    ref,
  ) {
    return (
      <div ref={ref} {...props}>
        {children as ReactNode}
      </div>
    );
  });

  const passthroughButton = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>
  >(function PassthroughButton(
    {
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    },
    ref,
  ) {
    return (
      <button ref={ref} {...props}>
        {children as ReactNode}
      </button>
    );
  });

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {
        div: passthroughDiv,
        button: passthroughButton,
      },
      {
        get: (target, property) =>
          property in target
            ? target[property as keyof typeof target]
            : passthroughDiv,
      },
    ),
  };
});

const { InvestModal } = await import("../InvestModal");

const property: PropertyInfo = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Lagos Marina Towers",
  description: "Premium residential asset",
  propertyType: "residential",
  location: {
    address: "1 Marina Road",
    city: "Lagos",
    country: "Nigeria",
  },
  totalValue: "2500000",
  tokenAddress: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
  totalShares: 25000,
  availableShares: 6250,
  pricePerShare: "100",
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  documents: [],
  verified: true,
  listedAt: "2026-03-20T00:00:00Z",
  owner: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
};

afterEach(() => {
  cleanup();
});

describe("InvestModal accessibility", () => {
  it("keeps focus within the modal while tabbing", () => {
    const { getByRole, getAllByRole } = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress="GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234"
        onConnectWallet={() => Promise.resolve()}
      />,
    );

    // TEMPORARY INSTRUMENTATION, to be reverted with the real fix.
    // This test takes 34s on the GitHub runner and under 1s everywhere else
    // (macOS, and linux/amd64 containers on the same bun, jsdom and lockfile),
    // so the cost has to be measured where it actually happens. The two
    // baselines below separate "the whole machine is slow" from "this one
    // operation is slow".
    const mark = (label: string, run: () => void) => {
      const started = performance.now();
      run();
      console.log(
        `INSTR ${label}: ${(performance.now() - started).toFixed(1)}ms`,
      );
    };

    mark("baseline_cpu_1e7_iterations", () => {
      let sink = 0;
      for (let i = 0; i < 1e7; i += 1) {
        sink += i;
      }
      if (sink < 0) throw new Error("unreachable");
    });

    mark("baseline_200_getComputedStyle", () => {
      for (let i = 0; i < 200; i += 1) {
        window.getComputedStyle(document.body);
      }
    });

    console.log(
      `INSTR dom_elements: ${document.body.querySelectorAll("*").length}`,
      `dom_buttons: ${document.body.querySelectorAll("button").length}`,
    );

    let closeButton!: HTMLElement;
    mark("getByRole_with_accessible_name", () => {
      closeButton = getByRole("button", { name: /close dialog/i });
    });

    let buttons!: HTMLElement[];
    mark("getAllByRole_no_name", () => {
      buttons = getAllByRole("button");
    });

    const lastButton = buttons[buttons.length - 1];

    // Close is first in tab order; Tab from the last control must wrap back.
    expect(buttons[0]).toBe(closeButton);
    mark("focus_last_button", () => lastButton.focus());
    mark("keydown_tab", () => fireEvent.keyDown(document, { key: "Tab" }));
    expect(document.activeElement).toBe(closeButton);

    mark("focus_close_button", () => closeButton.focus());
    mark("keydown_shift_tab", () =>
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true }),
    );
    expect(document.activeElement).toBe(lastButton);
    // Temporary budget so the instrumented run reports every mark instead of
    // being cut short at the default 5s. Reverted with the instrumentation.
  }, 120_000);

  it("has no critical axe violations", async () => {
    const { container } = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress="GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234"
        onConnectWallet={() => Promise.resolve()}
      />,
    );

    const results = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa"],
      },
    });

    const criticalViolations = results.violations.filter(
      (violation) => violation.impact === "critical",
    );

    expect(criticalViolations).toHaveLength(0);
  });
});
