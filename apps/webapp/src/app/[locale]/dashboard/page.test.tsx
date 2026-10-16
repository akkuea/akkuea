import "@/test/setup-dom";
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";

mock.module("next/dynamic", () => ({
  default: (
    _loader: () => Promise<unknown>,
    options: { loading?: () => ReactNode },
  ) => {
    const DynamicComponent = () => options.loading?.() ?? null;
    return DynamicComponent;
  },
}));

mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

mock.module("framer-motion", () => {
  const passthroughDiv = ({
    children,
    initial: _initial,
    animate: _animate,
    variants: _variants,
    transition: _transition,
    ...props
  }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
    <div {...props}>{children}</div>
  );
  const passthroughButton = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  );

  return {
    motion: new Proxy(
      { div: passthroughDiv, button: passthroughButton },
      {
        get: (target, property) =>
          property in target
            ? target[property as keyof typeof target]
            : passthroughDiv,
      },
    ),
  };
});

mock.module("@/components/layout", () => ({
  Navbar: () => <div>Navbar</div>,
  Footer: () => <div>Footer</div>,
}));

mock.module("@/components/auth/hooks", () => ({
  useWallet: () => ({
    address: "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000",
    balance: "0",
    isConnected: true,
    network: "testnet",
  }),
  useWalletConnectModal: () => ({
    openConnectModal: mock(() => {}),
    connectModalProps: {},
  }),
}));

mock.module("@/components/auth/WalletProviderModal", () => ({
  WalletProviderModal: () => null,
}));

mock.module("@/components/portfolio/AllocationChart", () => ({
  AllocationChart: () => null,
}));

mock.module("@/components/portfolio/PropertyReportCard", () => ({
  PropertyReportCard: () => null,
}));

mock.module("@/hooks/usePortfolio", () => ({
  usePortfolio: () => ({
    properties: [],
    borrows: [],
    deposits: [],
    summary: {
      totalValue: 0,
      totalBorrowed: 0,
      totalDeposited: 0,
      avgYield: 0,
      propertyCount: 0,
      allocationByType: {},
    },
    isLoading: false,
    error: null,
    refetch: mock(() => {}),
  }),
}));

mock.module("@/hooks/useHealthFactor", () => ({
  useHealthFactor: () => ({ healthFactor: Infinity, status: "none" }),
}));

mock.module("@/hooks/useLiveUpdates", () => ({
  useLiveUpdates: () => ({ connectionStatus: "connected" }),
}));

const { default: DashboardPage } = await import("./page");

describe("DashboardPage", () => {
  beforeEach(() => {
    cleanup();
  });

  afterAll(() => {
    cleanup();
  });

  it("renders the portfolio chart skeleton while the chart module is unresolved", () => {
    const view = render(<DashboardPage />);

    expect(view.getByText("Portfolio Performance")).not.toBeNull();
    expect(view.getByRole("status", { name: "Loading..." })).not.toBeNull();
  });
});
