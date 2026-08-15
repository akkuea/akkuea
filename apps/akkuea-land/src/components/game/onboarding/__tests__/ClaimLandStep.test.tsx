/**
 * ClaimLandStep - unit tests
 *
 * Verifies the onboarding "Claim your starter LAND" step builds a real
 * GameLandToken.faucet XDR for the connected wallet address and signs it
 * through useGameWallet, instead of the old code path that handed a literal
 * "placeholder-faucet-xdr" string straight to a stubbed signAndSubmitTx.
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
const MOCK_UNSIGNED_XDR = "AAAA_UNSIGNED_XDR_BASE64==";

const mockBuildFaucetClaimXdr = vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR);
vi.mock("@/lib/soroban-tx", () => ({
  buildFaucetClaimXdr: mockBuildFaucetClaimXdr,
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

import { ClaimLandStep } from "../ClaimLandStep";

beforeEach(() => {
  cleanup();
  mockBuildFaucetClaimXdr.mockClear();
  mockBuildFaucetClaimXdr.mockResolvedValue(MOCK_UNSIGNED_XDR);
  mockSignAndSubmitTx.mockClear();
  mockSignAndSubmitTx.mockResolvedValue(undefined);
  mockUseGameWallet.mockReturnValue({
    address: CONNECTED_ADDRESS,
    signAndSubmitTx: mockSignAndSubmitTx,
  });
});

describe("ClaimLandStep", () => {
  it("builds a real faucet XDR for the connected address and signs it", async () => {
    const onNext = () => {};
    const onSkip = () => {};

    const view = render(<ClaimLandStep onNext={onNext} onSkip={onSkip} />);

    fireEvent.click(view.getByRole("button", { name: /Claim 1,000 LAND/i }));

    await waitFor(() => {
      expect(mockBuildFaucetClaimXdr).toHaveBeenCalledWith(CONNECTED_ADDRESS);
    });
    expect(mockSignAndSubmitTx).toHaveBeenCalledWith(MOCK_UNSIGNED_XDR);

    await waitFor(() => {
      expect(
        view.queryByText("Transaction successfully recorded on-chain"),
      ).not.toBeNull();
    });
  });

  it("does not call the faucet builder with a hardcoded placeholder string", async () => {
    const view = render(<ClaimLandStep onNext={() => {}} onSkip={() => {}} />);

    fireEvent.click(view.getByRole("button", { name: /Claim 1,000 LAND/i }));

    await waitFor(() => {
      expect(mockBuildFaucetClaimXdr).toHaveBeenCalled();
    });

    expect(mockSignAndSubmitTx).not.toHaveBeenCalledWith(
      "placeholder-faucet-xdr",
    );
  });

  it("shows the error state when the transaction fails", async () => {
    mockSignAndSubmitTx.mockRejectedValueOnce(new Error("User rejected"));

    const view = render(<ClaimLandStep onNext={() => {}} onSkip={() => {}} />);

    fireEvent.click(view.getByRole("button", { name: /Claim 1,000 LAND/i }));

    await waitFor(() => {
      expect(view.queryByText("Claim failed. Try again.")).not.toBeNull();
    });
  });

  it("does not attempt to claim when no wallet address is connected", async () => {
    mockUseGameWallet.mockReturnValue({
      address: null,
      signAndSubmitTx: mockSignAndSubmitTx,
    });

    const view = render(<ClaimLandStep onNext={() => {}} onSkip={() => {}} />);

    fireEvent.click(view.getByRole("button", { name: /Claim 1,000 LAND/i }));

    expect(mockBuildFaucetClaimXdr).not.toHaveBeenCalled();
    expect(mockSignAndSubmitTx).not.toHaveBeenCalled();
  });
});
