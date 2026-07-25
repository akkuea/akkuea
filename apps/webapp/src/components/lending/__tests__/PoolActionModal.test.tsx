import "@/test/setup-dom";
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
} from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { LendingPool } from "@real-estate-defi/shared";
import { createLendingPool } from "@real-estate-defi/shared";
import { lendingApi } from "@/services/api";

const depositMock = mock(() =>
  Promise.resolve({
    id: "dep-1",
    poolId: "550e8400-e29b-41d4-a716-446655440000",
    depositor: "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234",
    amount: "1000",
    shares: "1000",
    depositedAt: new Date().toISOString(),
    lastAccrualAt: new Date().toISOString(),
    accruedInterest: "0",
  }),
);

const borrowMock = mock(() =>
  Promise.resolve({
    id: "bor-1",
    poolId: "550e8400-e29b-41d4-a716-446655440000",
    borrower: "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234",
    principal: "500",
    accruedInterest: "0",
    collateralAmount: "1000",
    collateralAsset: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
    healthFactor: 1.5,
    borrowedAt: new Date().toISOString(),
    lastAccrualAt: new Date().toISOString(),
  }),
);

const depositFailMock = mock(() =>
  Promise.reject(new Error("Insufficient liquidity")),
);

const borrowFailMock = mock(() =>
  Promise.reject(new Error("Insufficient collateral")),
);

const originalDeposit = lendingApi.deposit;
const originalBorrow = lendingApi.borrow;

mock.module("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
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

mock.module("@/components/forms", () => {
  const FormInput = ({ label }: { label: string }) => (
    <div data-testid="mock-input">{label}</div>
  );
  return {
    Form: ({ children, onSubmit }: { children: unknown; onSubmit: (values: { amount: string }) => Promise<void> }) => {
      const handleClick = () => {
        void onSubmit({ amount: "1000", zkPrivacy: false });
      };
      if (typeof children === "function") {
        return (
          <div data-testid="mock-form">
            {children({
              watch: () => false,
              setValue: () => {},
              formState: { isSubmitting: false, isValid: true },
            })}
            <button
              data-testid="submit-btn"
              onClick={handleClick}
              type="button"
            >
              Submit
            </button>
          </div>
        );
      }
      return <div data-testid="mock-form">{children}</div>;
    },
    FormInput,
  };
});

const { PoolActionModal } = await import("../PoolActionModal");

const pool: LendingPool = createLendingPool({
  name: "USD Pool",
  asset: "USD",
  totalDeposits: "1000000",
  totalBorrows: "500000",
  availableLiquidity: "500000",
  utilizationRate: 50,
  supplyAPY: 2.5,
  borrowAPY: 5.0,
  collateralFactor: 60,
});

const WALLET = "GDB6EXAMPLEWALLETADDRESS1234567890123456789012345678901234";

describe("PoolActionModal - optimistic UI", () => {
  beforeEach(() => {
    cleanup();
    lendingApi.deposit = depositMock;
    lendingApi.borrow = borrowMock;
    depositMock.mockClear();
    borrowMock.mockClear();
  });

  afterAll(() => {
    lendingApi.deposit = originalDeposit;
    lendingApi.borrow = originalBorrow;
  });

  it("shows confirming skeleton immediately after submit, then success", async () => {
    const onSuccess = mock(() => {});
    const onPendingAction = mock(() => {});
    const onSettleAction = mock(() => {});

    const view = render(
      <PoolActionModal
        pool={pool}
        action="supply"
        isOpen
        onClose={() => {}}
        userAddress={WALLET}
        onSuccess={onSuccess}
        onPendingAction={onPendingAction}
        onSettleAction={onSettleAction}
      />,
    );

    fireEvent.click(view.getByTestId("submit-btn"));

    expect(onPendingAction).toHaveBeenCalledWith({
      poolId: pool.id,
      type: "supply",
      amount: 1000,
    });

    expect(view.queryByText(/Processing supply/i)).not.toBeNull();
    expect(view.queryByText(/Waiting for on-chain confirmation/i)).not.toBeNull();

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).not.toBeNull();

    await waitFor(() => {
      expect(view.queryByText(/1,000 USD/)).not.toBeNull();
      expect(view.queryByText(/Supply submitted successfully/i)).not.toBeNull();
    });

    expect(onSettleAction).toHaveBeenCalledWith(pool.id, "supply");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows error state and retry button on failed tx", async () => {
    lendingApi.deposit = depositFailMock;
    const onSettleAction = mock(() => {});

    const view = render(
      <PoolActionModal
        pool={pool}
        action="supply"
        isOpen
        onClose={() => {}}
        userAddress={WALLET}
        onSuccess={() => {}}
        onPendingAction={() => {}}
        onSettleAction={onSettleAction}
      />,
    );

    fireEvent.click(view.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(view.queryByText(/Insufficient liquidity/i)).not.toBeNull();
    });

    expect(onSettleAction).toHaveBeenCalledWith(pool.id, "supply");

    const retryButton = view.getByRole("button", { name: /Retry transaction/i });
    expect(retryButton).not.toBeNull();
  });

  it("shows confirming state for borrow action, then success", async () => {
    const onPendingAction = mock(() => {});

    const view = render(
      <PoolActionModal
        pool={pool}
        action="borrow"
        isOpen
        onClose={() => {}}
        userAddress={WALLET}
        onSuccess={() => {}}
        onPendingAction={onPendingAction}
        onSettleAction={() => {}}
      />,
    );

    fireEvent.click(view.getByTestId("submit-btn"));

    expect(onPendingAction).toHaveBeenCalledWith({
      poolId: pool.id,
      type: "borrow",
      amount: 1000,
    });

    expect(view.queryByText(/Processing borrow/i)).not.toBeNull();

    await waitFor(() => {
      expect(view.queryByText(/Borrow submitted successfully/i)).not.toBeNull();
    });
  });

  it("shows error state for failed borrow", async () => {
    lendingApi.borrow = borrowFailMock;

    const view = render(
      <PoolActionModal
        pool={pool}
        action="borrow"
        isOpen
        onClose={() => {}}
        userAddress={WALLET}
        onSuccess={() => {}}
        onPendingAction={() => {}}
        onSettleAction={() => {}}
      />,
    );

    fireEvent.click(view.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(view.queryByText(/Insufficient collateral/i)).not.toBeNull();
    });
  });

  it("shows connect wallet prompt when no wallet is connected", () => {
    const view = render(
      <PoolActionModal
        pool={pool}
        action="supply"
        isOpen
        onClose={() => {}}
        userAddress={null}
      />,
    );

    expect(
      view.queryByText(/Connect your wallet before submitting/i),
    ).not.toBeNull();
  });
});
