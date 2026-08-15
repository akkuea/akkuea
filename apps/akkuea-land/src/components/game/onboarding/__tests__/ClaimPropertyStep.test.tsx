/**
 * ClaimPropertyStep - unit tests
 *
 * Verifies the onboarding "Claim your first property" step builds a real
 * PropertyNft.transfer (treasury → viewer) XDR for the selected starter tile
 * and the connected wallet address, instead of the old code path that handed
 * a literal "placeholder-starter-claim-xdr" string straight to a stubbed
 * signAndSubmitTx.
 */

// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
globalThis.HTMLElement = dom.window.HTMLElement as any;
globalThis.MutationObserver = dom.window.MutationObserver as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

mock.module("framer-motion", () => {
  const passthrough = new Proxy(
    {},
    {
      get:
        (_target, tagName: string) =>
        ({ children, ...props }: any) =>
          React.createElement(tagName, props, children),
    },
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: passthrough,
  };
});

const CONNECTED_ADDRESS =
  "GDVIEWER1234567890123456789012345678901234567890123456";
const TEST_TREASURY_ADDRESS =
  "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const MOCK_UNSIGNED_XDR = "AAAA_UNSIGNED_XDR_BASE64==";

const mockBuildBuyFromTreasuryXdr = vi
  .fn()
  .mockResolvedValue(MOCK_UNSIGNED_XDR);
vi.mock("@/lib/soroban-tx", () => ({
  buildBuyFromTreasuryXdr: mockBuildBuyFromTreasuryXdr,
  TREASURY_ADDRESS: TEST_TREASURY_ADDRESS,
}));

const mockSignAndSubmitTx = vi.fn().mockResolvedValue(undefined);
const mockUseGameWallet = vi.fn(
  (): {
    address: string | null;
    signAndSubmitTx: typeof mockSignAndSubmitTx;
  } => ({
    address: CONNECTED_ADDRESS,
    signAndSubmitTx: mockSignAndSubmitTx,
  }),
);
vi.mock("@/hooks/useGameWallet", () => ({
  useGameWallet: mockUseGameWallet,
}));

import { ClaimPropertyStep } from "../ClaimPropertyStep";

beforeEach(() => {
  cleanup();
  mockBuildBuyFromTreasuryXdr.mockClear();
  mockBuildBuyFromTreasuryXdr.mockResolvedValue(MOCK_UNSIGNED_XDR);
  mockSignAndSubmitTx.mockClear();
  mockSignAndSubmitTx.mockResolvedValue(undefined);
  mockUseGameWallet.mockReturnValue({
    address: CONNECTED_ADDRESS,
    signAndSubmitTx: mockSignAndSubmitTx,
  });
});

/** Selects the first tile marked claimable ("(i * 7 + 3) % 2 === 0"). */
function selectFirstClaimableTile(
  view: ReturnType<typeof render>,
): HTMLElement {
  const buttons = view.container.querySelectorAll("button[type='button']");
  const enabled = Array.from(buttons).find(
    (btn) => !(btn as HTMLButtonElement).disabled,
  ) as HTMLElement | undefined;
  if (!enabled) throw new Error("No claimable starter tile found in grid");
  return enabled;
}

describe("ClaimPropertyStep", () => {
  it("builds a real treasury-transfer XDR for the selected tile and signs it", async () => {
    const view = render(
      <ClaimPropertyStep onComplete={() => {}} onSkip={() => {}} />,
    );

    fireEvent.click(selectFirstClaimableTile(view));
    fireEvent.click(view.getByRole("button", { name: /Claim Free Property/i }));

    await waitFor(() => {
      expect(mockBuildBuyFromTreasuryXdr).toHaveBeenCalled();
    });

    const [buyer, propertyId, treasury] =
      mockBuildBuyFromTreasuryXdr.mock.calls[0];
    expect(buyer).toBe(CONNECTED_ADDRESS);
    expect(treasury).toBe(TEST_TREASURY_ADDRESS);
    expect(typeof propertyId).toBe("string");

    expect(mockSignAndSubmitTx).toHaveBeenCalledWith(MOCK_UNSIGNED_XDR);
  });

  it("does not sign a hardcoded placeholder string", async () => {
    const view = render(
      <ClaimPropertyStep onComplete={() => {}} onSkip={() => {}} />,
    );

    fireEvent.click(selectFirstClaimableTile(view));
    fireEvent.click(view.getByRole("button", { name: /Claim Free Property/i }));

    await waitFor(() => {
      expect(mockSignAndSubmitTx).toHaveBeenCalled();
    });

    expect(mockSignAndSubmitTx).not.toHaveBeenCalledWith(
      "placeholder-starter-claim-xdr",
    );
  });

  it("does not attempt to claim when no wallet address is connected", () => {
    mockUseGameWallet.mockReturnValue({
      address: null,
      signAndSubmitTx: mockSignAndSubmitTx,
    });

    const view = render(
      <ClaimPropertyStep onComplete={() => {}} onSkip={() => {}} />,
    );

    fireEvent.click(selectFirstClaimableTile(view));
    fireEvent.click(view.getByRole("button", { name: /Claim Free Property/i }));

    expect(mockBuildBuyFromTreasuryXdr).not.toHaveBeenCalled();
    expect(mockSignAndSubmitTx).not.toHaveBeenCalled();
  });
});
