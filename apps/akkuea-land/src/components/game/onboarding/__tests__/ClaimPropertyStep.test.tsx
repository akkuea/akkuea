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
import { ClaimPropertyStep } from "../ClaimPropertyStep";

const mockSignAndSubmitTx = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (useGameWallet as ReturnType<typeof vi.fn>).mockReturnValue({
    signAndSubmitTx: mockSignAndSubmitTx,
    isConnected: true,
    address: "GTESTADDRESS",
  });
});

function findTreasuryButtons(view: ReturnType<typeof render>) {
  return view
    .getAllByRole("button")
    .filter(
      (button) =>
        !button.hasAttribute("disabled") &&
        /^\d+,\d+$/.test(button.textContent?.trim() || "")
    );
}

describe("ClaimPropertyStep — render tests", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders the step title and description", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    expect(view.getByText("Claim your first property")).not.toBeNull();
    expect(
      view.getByText(
        "Tap on any highlighted treasury tile on the grid below. It is yours completely free as a starting bonus!"
      )
    ).not.toBeNull();
  });

  it("renders the 5x5 property grid with 25 tiles", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    // The grid renders 25 coordinate-labeled tiles
    const coordinateButtons = view
      .getAllByRole("button")
      .filter(
        (b) => /^\d+,\d+$/.test(b.textContent?.trim() || "")
      );
    expect(coordinateButtons.length).toBe(25);

    // At least some tiles are enabled (treasury)
    const enabled = coordinateButtons.filter((b) => !b.hasAttribute("disabled"));
    expect(enabled.length).toBeGreaterThanOrEqual(9);

    // At least some tiles are disabled
    const disabled = coordinateButtons.filter((b) => b.hasAttribute("disabled"));
    expect(disabled.length).toBeGreaterThanOrEqual(10);
  });

  it("renders the claim button initially disabled", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    expect(claimButton).not.toBeNull();
    expect(claimButton.hasAttribute("disabled")).toBe(true);
  });

  it("renders the skip button initially", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    expect(
      view.getByRole("button", { name: /Skip this step/i })
    ).not.toBeNull();
  });

  it("renders legend showing treasury vs unavailable properties", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    expect(view.getByText("Treasury (Free)")).not.toBeNull();
    expect(view.getByText("Unavailable")).not.toBeNull();
  });
});

describe("ClaimPropertyStep — interaction tests", () => {
  beforeEach(() => {
    cleanup();
  });

  it("enables claim button when a treasury property is selected", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    const treasuryButtons = findTreasuryButtons(view);
    expect(treasuryButtons.length).toBeGreaterThan(0);

    fireEvent.click(treasuryButtons[0]);

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    expect(claimButton.hasAttribute("disabled")).toBe(false);
  });

  it("disables claim button when no property is selected", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    expect(claimButton.hasAttribute("disabled")).toBe(true);
  });

  it("calls signAndSubmitTx and shows pending state when claim button is clicked", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(view.getByText(/Acquiring property\.\.\./i)).not.toBeNull();
    });

    expect(mockSignAndSubmitTx).toHaveBeenCalledTimes(1);
    expect(mockSignAndSubmitTx).toHaveBeenCalledWith(
      "placeholder-starter-claim-xdr"
    );
    expect(claimButton.hasAttribute("disabled")).toBe(true);
  });

  it("transitions to celebration screen when claim succeeds", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);
    fireEvent.click(
      view.getByRole("button", { name: /Claim Free Property/i })
    );

    // Should show pending state first
    await waitFor(() => {
      expect(view.getByText(/Acquiring property\.\.\./i)).not.toBeNull();
    });

    // Wait for celebration screen
    await waitFor(() => {
      expect(view.getByText(/Welcome, Landowner!/i)).not.toBeNull();
    });

    expect(
      view.getByText(
        /You successfully claimed your first property on Stellar!/i
      )
    ).not.toBeNull();
  });

  it("calls onComplete callback after claim succeeds and timeout fires", async () => {
    const onComplete = vi.fn();
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(
      <ClaimPropertyStep onComplete={onComplete} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);
    fireEvent.click(
      view.getByRole("button", { name: /Claim Free Property/i })
    );

    // Wait for celebration screen
    await waitFor(() => {
      expect(view.getByText(/Welcome, Landowner!/i)).not.toBeNull();
    });

    // Wait for the 3-second setTimeout to fire onComplete
    await waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 }
    );
  });

  it("resets to idle and does NOT call onComplete when claim fails", async () => {
    mockSignAndSubmitTx.mockRejectedValueOnce(new Error("Transaction failed"));

    const onComplete = vi.fn();
    const view = render(
      <ClaimPropertyStep onComplete={onComplete} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    fireEvent.click(claimButton);

    // Should show pending state first
    await waitFor(() => {
      expect(view.getByText(/Acquiring property\.\.\./i)).not.toBeNull();
    });

    // Should reset to idle state (status becomes "idle" on catch)
    await waitFor(() => {
      expect(claimButton.hasAttribute("disabled")).toBe(false);
      expect(claimButton.textContent).toMatch(/Claim Free Property/i);
    });

    // onComplete should NOT have been called
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("allows retrying claim after failure", async () => {
    mockSignAndSubmitTx
      .mockRejectedValueOnce(new Error("Transaction failed"))
      .mockResolvedValueOnce(undefined);

    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    fireEvent.click(claimButton);

    // Wait for reset to idle
    await waitFor(() => {
      expect(claimButton.hasAttribute("disabled")).toBe(false);
    });

    // Try again — this time succeed
    fireEvent.click(claimButton);

    await waitFor(() => {
      expect(view.getByText(/Acquiring property\.\.\./i)).not.toBeNull();
    });

    await waitFor(() => {
      expect(view.getByText(/Welcome, Landowner!/i)).not.toBeNull();
    });
  });

  it("allows selecting a different property after initial selection", () => {
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    const treasuryButtons = findTreasuryButtons(view);
    expect(treasuryButtons.length).toBeGreaterThan(1);

    fireEvent.click(treasuryButtons[0]);

    const claimButton = view.getByRole("button", {
      name: /Claim Free Property/i,
    });
    expect(claimButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(treasuryButtons[1]);
    expect(claimButton.hasAttribute("disabled")).toBe(false);
  });

  it("calls onSkip when skip button is clicked", () => {
    const onSkip = vi.fn();
    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={onSkip} />
    );

    fireEvent.click(
      view.getByRole("button", { name: /Skip this step/i })
    );

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("does not show skip button during pending state", async () => {
    let resolveTx: () => void;
    const txPromise = new Promise<void>((resolve) => {
      resolveTx = resolve;
    });
    mockSignAndSubmitTx.mockReturnValueOnce(txPromise);

    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);
    fireEvent.click(
      view.getByRole("button", { name: /Claim Free Property/i })
    );

    await waitFor(() => {
      expect(view.getByText(/Acquiring property\.\.\./i)).not.toBeNull();
    });

    expect(
      view.queryByRole("button", { name: /Skip this step/i })
    ).toBeNull();

    resolveTx!();
  });

  it("does not show skip button during celebration state", async () => {
    mockSignAndSubmitTx.mockResolvedValueOnce(undefined);

    const view = render(
      <ClaimPropertyStep onComplete={vi.fn()} onSkip={vi.fn()} />
    );

    fireEvent.click(findTreasuryButtons(view)[0]);
    fireEvent.click(
      view.getByRole("button", { name: /Claim Free Property/i })
    );

    await waitFor(() => {
      expect(view.getByText(/Welcome, Landowner!/i)).not.toBeNull();
    });

    expect(
      view.queryByRole("button", { name: /Skip this step/i })
    ).toBeNull();
  });
});