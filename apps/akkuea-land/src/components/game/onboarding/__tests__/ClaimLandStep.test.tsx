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

import { describe, it, expect, vi, mock, beforeEach } from "bun:test";
import React from "react";
import { cleanup, render, fireEvent, waitFor } from "@testing-library/react";

// Mock framer-motion to bypass animations for synchronous UI assertions
mock.module("framer-motion", () => {
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) => (
        <div {...props}>{children}</div>
      ),
      button: ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) => (
        <button {...props}>{children}</button>
      ),
      p: ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) => (
        <p {...props}>{children}</p>
      ),
    },
  };
});

// Mock the useGameWallet hook
vi.mock("@/hooks/useGameWallet", () => ({
  useGameWallet: vi.fn(),
}));

import { useGameWallet } from "@/hooks/useGameWallet";
import { ClaimLandStep } from "../ClaimLandStep";

const mockSignAndSubmitTx = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (useGameWallet as ReturnType<typeof vi.fn>).mockReturnValue({
    signAndSubmitTx: mockSignAndSubmitTx,
    isConnected: true,
    address: "GTESTADDRESS",
  });
});

describe("ClaimLandStep — render tests", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders the step title and description", () => {
    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    expect(view.getByText("Get your starter LAND")).not.toBeNull();
    expect(
      view.getByText(
        "LAND is the premium utility token of Akkuea Land. Reclaim 1,000 LAND from our testnet faucet for free to fund your very first property claim."
      )
    ).not.toBeNull();
  });

  it("renders the initial 'Claim 1,000 LAND' button enabled", () => {
    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    const claimButton = view.getByRole("button", {
      name: /Claim 1,000 LAND/i,
    });
    expect(claimButton).not.toBeNull();
    expect(claimButton.hasAttribute("disabled")).toBe(false);
  });

  it("renders the skip button initially", () => {
    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    expect(
      view.getByRole("button", { name: /Skip this step/i })
    ).not.toBeNull();
  });
});

describe("ClaimLandStep — interaction tests", () => {
  beforeEach(() => {
    cleanup();
  });

  it("calls signAndSubmitTx and transitions to pending state when claim button is clicked", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    const claimButton = view.getByRole("button", {
      name: /Claim 1,000 LAND/i,
    });
    fireEvent.click(claimButton);

    // Should show pending state
    await waitFor(() => {
      expect(
        view.getByText(/Preparing your wallet on Stellar\.\.\./i)
      ).not.toBeNull();
    });

    expect(mockSignAndSubmitTx).toHaveBeenCalledTimes(1);
    expect(mockSignAndSubmitTx).toHaveBeenCalledWith(
      "placeholder-faucet-xdr"
    );
  });

  it("disables the button during pending state", async () => {
    let resolveClaim: () => void;
    const claimPromise = new Promise<void>((resolve) => {
      resolveClaim = resolve;
    });
    mockSignAndSubmitTx.mockReturnValueOnce(claimPromise);

    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    const claimButton = view.getByRole("button", {
      name: /Claim 1,000 LAND/i,
    });
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(
        view.getByText(/Preparing your wallet on Stellar\.\.\./i)
      ).not.toBeNull();
    });

    expect(claimButton.hasAttribute("disabled")).toBe(true);

    resolveClaim!();
  });

  it("transitions to success state and shows continue button when claim succeeds", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    const claimButton = view.getByRole("button", {
      name: /Claim 1,000 LAND/i,
    });
    fireEvent.click(claimButton);

    // Wait for success state — the success UI shows "+1,000" and "LAND" in separate elements
    await waitFor(() => {
      expect(view.getByText(/\+1,000/i)).not.toBeNull();
    });

    expect(
      view.getByText(/Transaction successfully recorded on-chain/i)
    ).not.toBeNull();

    // Continue button should be present
    const continueButton = view.getByRole("button", {
      name: /Continue to Claim Property/i,
    });
    expect(continueButton).not.toBeNull();
  });

  it("calls onNext when continue button is clicked after success", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const onNext = vi.fn();
    const view = render(<ClaimLandStep onNext={onNext} onSkip={vi.fn()} />);

    fireEvent.click(
      view.getByRole("button", { name: /Claim 1,000 LAND/i })
    );

    // Wait for success state — "+1,000" appears in the success UI
    await waitFor(() => {
      expect(view.getByText(/\+1,000/i)).not.toBeNull();
    });

    fireEvent.click(
      view.getByRole("button", { name: /Continue to Claim Property/i })
    );

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("shows error state and does NOT call onNext when claim fails", async () => {
    mockSignAndSubmitTx.mockRejectedValueOnce(new Error("Transaction failed"));

    const onNext = vi.fn();
    const view = render(<ClaimLandStep onNext={onNext} onSkip={vi.fn()} />);

    fireEvent.click(
      view.getByRole("button", { name: /Claim 1,000 LAND/i })
    );

    // Wait for error state
    await waitFor(() => {
      expect(view.getByText(/Claim failed\. Try again\./i)).not.toBeNull();
    });

    // Error message should be shown
    expect(
      view.getByText(
        /Transaction failed\. Please make sure you have internet access/i
      )
    ).not.toBeNull();

    // onNext should NOT be called
    expect(onNext).not.toHaveBeenCalled();

    // Retry button should be present and enabled
    const retryButton = view.getByRole("button", {
      name: /Claim failed\. Try again\./i,
    });
    expect(retryButton).not.toBeNull();
    expect(retryButton.hasAttribute("disabled")).toBe(false);
  });

  it("allows retry after error by clicking the claim button again", async () => {
    mockSignAndSubmitTx
      .mockRejectedValueOnce(new Error("Transaction failed"))
      .mockResolvedValueOnce(undefined);

    const onNext = vi.fn();
    const view = render(<ClaimLandStep onNext={onNext} onSkip={vi.fn()} />);

    // First attempt - fails
    fireEvent.click(
      view.getByRole("button", { name: /Claim 1,000 LAND/i })
    );

    await waitFor(() => {
      expect(view.getByText(/Claim failed\. Try again\./i)).not.toBeNull();
    });

    // Second attempt - succeeds
    fireEvent.click(
      view.getByRole("button", { name: /Claim failed\. Try again\./i })
    );

    await waitFor(() => {
      expect(view.getByText(/\+1,000/i)).not.toBeNull();
    });

    fireEvent.click(
      view.getByRole("button", { name: /Continue to Claim Property/i })
    );

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when skip button is clicked in idle state", () => {
    const onSkip = vi.fn();
    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(
      view.getByRole("button", { name: /Skip this step/i })
    );

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when skip button is clicked in error state", async () => {
    mockSignAndSubmitTx.mockRejectedValueOnce(new Error("Transaction failed"));

    const onSkip = vi.fn();
    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={onSkip} />);

    fireEvent.click(
      view.getByRole("button", { name: /Claim 1,000 LAND/i })
    );

    await waitFor(() => {
      expect(view.getByText(/Claim failed\. Try again\./i)).not.toBeNull();
    });

    fireEvent.click(
      view.getByRole("button", { name: /Skip this step/i })
    );

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("does not show skip button during pending state", async () => {
    let resolveClaim: () => void;
    const claimPromise = new Promise<void>((resolve) => {
      resolveClaim = resolve;
    });
    mockSignAndSubmitTx.mockReturnValueOnce(claimPromise);

    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    fireEvent.click(
      view.getByRole("button", { name: /Claim 1,000 LAND/i })
    );

    await waitFor(() => {
      expect(
        view.getByText(/Preparing your wallet on Stellar\.\.\./i)
      ).not.toBeNull();
    });

    expect(
      view.queryByRole("button", { name: /Skip this step/i })
    ).toBeNull();

    resolveClaim!();
  });

  it("does not show skip button in success state", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(<ClaimLandStep onNext={vi.fn()} onSkip={vi.fn()} />);

    fireEvent.click(
      view.getByRole("button", { name: /Claim 1,000 LAND/i })
    );

    await waitFor(() => {
      expect(view.getByText(/\+1,000/i)).not.toBeNull();
    });

    expect(
      view.queryByRole("button", { name: /Skip this step/i })
    ).toBeNull();
  });
});