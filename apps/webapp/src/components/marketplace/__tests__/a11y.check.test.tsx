import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import axe from "axe-core";
import type { PropertyInfo } from "@real-estate-defi/shared";

const { InvestModal } = await import("../InvestModal");

mock.module("next/image", () => ({
  default: (props: HTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

mock.module("framer-motion", () => {
  const passthroughDiv = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
    <div {...props}>{children}</div>
  );
  const passthroughButton = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  );

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
    const { getByRole } = render(
      <InvestModal
        property={property}
        isOpen
        onClose={() => {}}
        isConnected
        walletAddress="GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234"
        onConnectWallet={() => Promise.resolve()}
      />,
    );

    const firstButton = getByRole("button", { name: /decrease token count/i });
    const closeButton = getByRole("button", { name: /close dialog/i });

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(firstButton);
  });

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
