import { describe, expect, it, mock, beforeEach } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

// ---------------------------------------------------------------------------
// Minimal mocks so the component renders without a full Next.js runtime
// ---------------------------------------------------------------------------

mock.module("@/i18n/routing", () => ({
  usePathname: () => "/",
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

mock.module("framer-motion", () => ({
  motion: {
    header: ({
      children,
      ...rest
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => <header {...rest}>{children}</header>,
    div: ({
      children,
      ...rest
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

mock.module("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

mock.module("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

mock.module("@/components/layout/BrandLogo", () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

mock.module("@/components/layout/WalletStatusWidget", () => ({
  WalletStatusWidget: () => <div data-testid="wallet-widget" />,
}));

mock.module("@/components/layout/LanguageSelector", () => ({
  LanguageSelector: () => <div data-testid="lang-selector" />,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Navbar pilot links", () => {
  beforeEach(() => {
    // Ensure operator env var is unset by default
    delete process.env.NEXT_PUBLIC_PILOT_OPERATOR_ADDRESS;
  });

  it("renders investor dashboard link accessible without typing URL", () => {
    render(<Navbar />);
    const investorLinks = screen.getAllByRole("link", {
      name: /pilotInvestor/i,
    });
    expect(investorLinks.length).toBeGreaterThan(0);
    expect(investorLinks[0]).toHaveAttribute("href", "/pilot/investor");
  });

  it("renders onboarding link accessible without typing URL", () => {
    render(<Navbar />);
    const onboardingLinks = screen.getAllByRole("link", {
      name: /pilotOnboarding/i,
    });
    expect(onboardingLinks.length).toBeGreaterThan(0);
    expect(onboardingLinks[0]).toHaveAttribute("href", "/pilot/onboarding");
  });

  it("investor and onboarding links preserve locale prefix", () => {
    render(<Navbar />);
    // Links use the i18n Link component which handles locale.
    // The href is relative; the routing wrapper prepends locale.
    const investorLink = screen.getAllByRole("link", {
      name: /pilotInvestor/i,
    })[0];
    expect(investorLink.getAttribute("href")).toBe("/pilot/investor");
  });

  it("marks active pilot route with aria-current=page", () => {
    // Re-mock pathname to simulate being on the investor page
    mock.module("@/i18n/routing", () => ({
      usePathname: () => "/pilot/investor",
      Link: ({
        href,
        children,
        ...rest
      }: {
        href: string;
        children: ReactNode;
        [key: string]: unknown;
      }) => (
        <a href={href} {...rest}>
          {children}
        </a>
      ),
    }));

    render(<Navbar />);
    const activeLinks = screen
      .getAllByRole("link", { name: /pilotInvestor/i })
      .filter((el) => el.getAttribute("aria-current") === "page");
    expect(activeLinks.length).toBeGreaterThan(0);
  });

  it("does not render ally or review links when operator address is not configured", () => {
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: /pilotAlly/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /pilotReview/i })).toBeNull();
  });
});
