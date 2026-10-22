/* eslint-disable @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { LendingPool } from "@akkuea/shared";
import { createLendingPool } from "@akkuea/shared";
import { lendingApi } from "@/services/api";

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

// Testing Library (and with it react-dom) is loaded only after setup-dom has
// installed `window`. React DOM checks for a DOM once, when it is first loaded;
// without one it falls back to a legacy IE input polyfill that stops seeing
// `change` events once an input has been focused, which breaks every test that
// runs after a rejected submit focuses the amount field.
const { act, cleanup, fireEvent, render, waitFor } =
  await import("@testing-library/react");
const { AUTO_CLOSE_DELAY_MS, PoolActionModal } =
  await import("../PoolActionModal");
type PoolActionModalProps = import("../PoolActionModal").PoolActionModalProps;

const WALLET = "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234";

const XLM_POOL = createLendingPool({
  name: "XLM Native Pool",
  asset: "XLM",
  totalDeposits: "2000000",
  totalBorrows: "1300000",
  availableLiquidity: "700000",
});

const USDC_POOL = createLendingPool({
  name: "USDC Stable Pool",
  asset: "USDC",
  totalDeposits: "5000000",
  totalBorrows: "3600000",
  availableLiquidity: "1400000",
});

const deposit = mock(async () => ({}));
const withdraw = mock(async () => ({}));
const borrow = mock(async () => ({}));
const repay = mock(async () => ({}));

const original = {
  deposit: lendingApi.deposit,
  withdraw: lendingApi.withdraw,
  borrow: lendingApi.borrow,
  repay: lendingApi.repay,
};

// ---------------------------------------------------------------------------
// Auto-close timer tracking. Only timers with the modal's auto-close delay are
// captured, and they are never scheduled for real: `fireAutoClose` runs the
// ones that were not cancelled, as if 2.5 seconds had passed.
// ---------------------------------------------------------------------------

interface CapturedTimer {
  callback: () => void;
  cancelled: boolean;
}

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
let autoCloseTimers = new Map<object, CapturedTimer>();

function trackAutoCloseTimers() {
  autoCloseTimers = new Map();
  globalThis.setTimeout = ((
    callback: () => void,
    delay?: number,
    ...rest: unknown[]
  ) => {
    if (delay === AUTO_CLOSE_DELAY_MS) {
      const handle = {};
      autoCloseTimers.set(handle, { callback, cancelled: false });
      return handle;
    }
    return (realSetTimeout as unknown as (...args: unknown[]) => unknown)(
      callback,
      delay,
      ...rest,
    );
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((handle: Parameters<typeof clearTimeout>[0]) => {
    const captured =
      typeof handle === "object" && handle !== null
        ? autoCloseTimers.get(handle as object)
        : undefined;
    if (captured) {
      captured.cancelled = true;
      return;
    }
    return realClearTimeout(handle);
  }) as typeof clearTimeout;
}

function liveAutoCloseTimers(): CapturedTimer[] {
  return [...autoCloseTimers.values()].filter((timer) => !timer.cancelled);
}

function fireAutoClose() {
  act(() => {
    for (const timer of liveAutoCloseTimers()) {
      timer.cancelled = true;
      timer.callback();
    }
  });
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function baseProps(
  overrides: Partial<PoolActionModalProps> = {},
): PoolActionModalProps {
  return {
    pool: XLM_POOL,
    action: "supply",
    isOpen: true,
    onClose: () => {},
    userAddress: WALLET,
    ...overrides,
  };
}

function renderModal(overrides: Partial<PoolActionModalProps> = {}) {
  return render(<PoolActionModal {...baseProps(overrides)} />);
}

type View = ReturnType<typeof renderModal>;

function enterAmount(view: View, asset: string, value: string) {
  const input = view.getByLabelText(`Enter amount in ${asset}`);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function submitForm(view: View) {
  const form = view.getByRole("dialog").querySelector("form");
  if (!form) throw new Error("the action form is not rendered");
  fireEvent.submit(form);
}

type ApiMock = typeof deposit;

/**
 * Submits the form and checks the amount reaches the API. Validation runs on
 * the form's own submit path, so a rejected amount never gets this far.
 */
async function expectAccepted(view: View, api: ApiMock, amount: number) {
  submitForm(view);
  await waitFor(() => {
    expect(api).toHaveBeenCalledTimes(1);
  });
  const [, payload] = api.mock.calls[0] as unknown as [
    string,
    { amount?: number; borrowAmount?: number },
  ];
  expect(payload.amount ?? payload.borrowAmount).toBe(amount);
  expect(view.queryByText(/Amount cannot exceed/i)).toBeNull();
}

/** Checks the limit message shows and that submitting never calls the API. */
async function expectRejected(view: View, api: ApiMock, message: string) {
  await waitFor(() => {
    expect(view.queryByText(message)).not.toBeNull();
  });
  submitForm(view);
  await act(async () => {
    await Promise.resolve();
  });
  expect(view.queryByText(message)).not.toBeNull();
  expect(api).not.toHaveBeenCalled();
}

/** Submits a valid amount and waits for the success view. */
async function submitSuccessfully(view: View, asset: string, value: string) {
  enterAmount(view, asset, value);
  submitForm(view);
  await waitFor(() => {
    expect(view.queryByText("Action submitted")).not.toBeNull();
  });
}

beforeEach(() => {
  for (const fn of [deposit, withdraw, borrow, repay]) {
    fn.mockReset();
    fn.mockImplementation(async () => ({}));
  }
  lendingApi.deposit = deposit as unknown as typeof lendingApi.deposit;
  lendingApi.withdraw = withdraw as unknown as typeof lendingApi.withdraw;
  lendingApi.borrow = borrow as unknown as typeof lendingApi.borrow;
  lendingApi.repay = repay as unknown as typeof lendingApi.repay;
  trackAutoCloseTimers();
});

afterEach(() => {
  cleanup();
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
});

afterAll(() => {
  lendingApi.deposit = original.deposit;
  lendingApi.withdraw = original.withdraw;
  lendingApi.borrow = original.borrow;
  lendingApi.repay = original.repay;
});

// ---------------------------------------------------------------------------
// Limits per action
// ---------------------------------------------------------------------------

describe("PoolActionModal limits", () => {
  it("withdraw rejects amounts above the user's deposit, even with more pool liquidity", async () => {
    const view = renderModal({ action: "withdraw", userDeposit: 500 });

    enterAmount(view, "XLM", "1000000");
    await expectRejected(
      view,
      withdraw,
      "Amount cannot exceed your deposit of 500 XLM",
    );

    enterAmount(view, "XLM", "500.0000001");
    await expectRejected(
      view,
      withdraw,
      "Amount cannot exceed your deposit of 500 XLM",
    );
  });

  it("withdraw accepts the full deposit", async () => {
    const view = renderModal({ action: "withdraw", userDeposit: 500 });

    enterAmount(view, "XLM", "500");
    await expectAccepted(view, withdraw, 500);
  });

  it("repay rejects amounts above principal plus interest", async () => {
    const view = renderModal({ action: "repay", userDebt: 508.25 });

    enterAmount(view, "XLM", "508.26");
    await expectRejected(
      view,
      repay,
      "Amount cannot exceed your debt of 508.25 XLM",
    );
  });

  it("repay accepts the full debt even when it is above the pool's liquidity", async () => {
    const view = renderModal({
      action: "repay",
      pool: { ...XLM_POOL, availableLiquidity: "100" },
      userDebt: 508.25,
    });

    enterAmount(view, "XLM", "508.25");
    await expectAccepted(view, repay, 508.25);
  });

  it("borrow keeps the pool liquidity limit", async () => {
    const view = renderModal({
      action: "borrow",
      pool: { ...XLM_POOL, availableLiquidity: "700" },
      userDeposit: 1_000_000,
    });

    enterAmount(view, "XLM", "701");
    await expectRejected(
      view,
      borrow,
      "Amount cannot exceed the pool's available liquidity of 700 XLM",
    );

    enterAmount(view, "XLM", "700");
    await expectAccepted(view, borrow, 700);
  });

  it("supply is allowed when the pool has no available liquidity", async () => {
    const view = renderModal({
      action: "supply",
      pool: { ...XLM_POOL, availableLiquidity: "0" },
    });

    enterAmount(view, "XLM", "5000");
    await expectAccepted(view, deposit, 5000);
    expect(deposit).toHaveBeenCalledWith(XLM_POOL.id, {
      userAddress: WALLET,
      amount: 5000,
    });
  });

  it("still rejects a zero amount", async () => {
    const view = renderModal({ action: "supply" });

    enterAmount(view, "XLM", "0");
    await expectRejected(view, deposit, "Amount must be greater than 0");
  });
});

describe("PoolActionModal limit hint", () => {
  it("shows the limit in the pool's asset with no dollar sign", () => {
    const view = renderModal({ action: "withdraw", userDeposit: 500 });

    expect(view.queryByText("Available: 500 XLM")).not.toBeNull();
    expect(view.queryByText(/\$/)).toBeNull();
  });

  it("formats large and fractional limits in the asset", () => {
    const borrowView = renderModal({ action: "borrow" });
    expect(borrowView.queryByText("Available: 700,000 XLM")).not.toBeNull();
    cleanup();

    const repayView = renderModal({
      action: "repay",
      pool: USDC_POOL,
      userDebt: 1250.5,
    });
    expect(repayView.queryByText("Available: 1,250.5 USDC")).not.toBeNull();
  });

  it("shows no limit hint for supply, which has no cap", () => {
    const view = renderModal({ action: "supply" });

    expect(view.queryByText(/Available:/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Auto-close timer
// ---------------------------------------------------------------------------

describe("PoolActionModal auto-close", () => {
  it("still closes by itself after a successful action", async () => {
    const onClose = mock(() => {});
    const view = renderModal({ action: "supply", onClose });

    await submitSuccessfully(view, "XLM", "100");
    expect(liveAutoCloseTimers()).toHaveLength(1);

    fireAutoClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closing the success view by hand cancels the timer, so the next modal stays open", async () => {
    const onClose = mock(() => {});
    const view = render(
      <PoolActionModal {...baseProps({ action: "supply", onClose })} />,
    );

    await submitSuccessfully(view, "XLM", "100");
    expect(liveAutoCloseTimers()).toHaveLength(1);

    fireEvent.click(view.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(liveAutoCloseTimers()).toHaveLength(0);

    // The page clears the selected pool, then opens another pool's action.
    view.rerender(
      <PoolActionModal
        {...baseProps({ action: "supply", onClose, isOpen: false })}
      />,
    );
    view.rerender(
      <PoolActionModal
        {...baseProps({ action: "borrow", onClose, pool: USDC_POOL })}
      />,
    );

    // 2.5 seconds pass.
    fireAutoClose();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("dialog")).not.toBeNull();
    expect(view.queryByText("Borrow from Pool")).not.toBeNull();
  });

  it("closing with Escape also cancels the timer", async () => {
    const onClose = mock(() => {});
    const view = renderModal({ action: "supply", onClose });

    await submitSuccessfully(view, "XLM", "100");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(liveAutoCloseTimers()).toHaveLength(0);
  });

  it("cancels the timer when the parent closes the modal", async () => {
    const onClose = mock(() => {});
    const view = render(
      <PoolActionModal {...baseProps({ action: "supply", onClose })} />,
    );

    await submitSuccessfully(view, "XLM", "100");
    view.rerender(
      <PoolActionModal
        {...baseProps({ action: "supply", onClose, isOpen: false })}
      />,
    );

    expect(liveAutoCloseTimers()).toHaveLength(0);
  });

  it("cancels the timer on unmount", async () => {
    const onClose = mock(() => {});
    const view = renderModal({ action: "supply", onClose });

    await submitSuccessfully(view, "XLM", "100");
    view.unmount();

    expect(liveAutoCloseTimers()).toHaveLength(0);
    fireAutoClose();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not schedule a close when the transaction settles after the modal was closed", async () => {
    let settle: () => void = () => {};
    deposit.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = () => resolve({});
        }),
    );
    const onClose = mock(() => {});
    const onSuccess = mock(() => {});
    const view = render(
      <PoolActionModal
        {...baseProps({ action: "supply", onClose, onSuccess })}
      />,
    );

    enterAmount(view, "XLM", "100");
    submitForm(view);
    await waitFor(() => {
      expect(view.queryByText("Confirming transaction")).not.toBeNull();
    });

    fireEvent.click(view.getByRole("button", { name: "Close dialog" }));
    view.rerender(
      <PoolActionModal
        {...baseProps({ action: "supply", onClose, onSuccess, isOpen: false })}
      />,
    );
    view.rerender(
      <PoolActionModal
        {...baseProps({
          action: "borrow",
          onClose,
          onSuccess,
          pool: USDC_POOL,
        })}
      />,
    );

    await act(async () => {
      settle();
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(liveAutoCloseTimers()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.queryByText("Borrow from Pool")).not.toBeNull();
  });
});
