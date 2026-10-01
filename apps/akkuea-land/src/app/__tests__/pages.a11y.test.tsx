// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

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

import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import React, { forwardRef } from "react";
import { cleanup } from "@testing-library/react";
import axe from "axe-core";
import { renderWithIntl } from "@/test/renderWithIntl";

// GameShell and the dashboard page navigate through `@/i18n/routing`, which
// wraps `next/navigation`. There is no real Next.js router in a unit test, so
// this stands in for it the same way the app's own tests already mock
// `next/navigation` (see apps/webapp's properties/[id]/page.test.tsx).
let currentPathname = "/map";
mock.module("next/navigation", () => ({
  usePathname: () => currentPathname,
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

mock.module("framer-motion", () => {
  const passthrough = new Proxy(
    {},
    {
      get: (_target, tagName: string) =>
        forwardRef<any, any>(function PassthroughMotion(
          { children, ...props }: any,
          ref,
        ) {
          return React.createElement(tagName, { ref, ...props }, children);
        }),
    },
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: passthrough,
  };
});

import HomePage from "../[locale]/page";
import OnboardingPage from "../[locale]/onboarding/page";
import MapPage from "../[locale]/map/page";
import MarketplacePage from "../[locale]/marketplace/page";
import LoginPage from "../[locale]/(auth)/login/page";
import DashboardPage from "../[locale]/dashboard/page";

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
};

afterEach(() => {
  cleanup();
});

describe("page rendering and accessibility", () => {
  it("renders the home sandbox page in English and Spanish with no axe violations", async () => {
    currentPathname = "/";
    const en = renderWithIntl(<HomePage />);
    expect(en.getByText("Akkuea Land Grid Panel")).not.toBeNull();
    const results = await axe.run(en.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
    cleanup();

    const es = renderWithIntl(<HomePage />, { locale: "es" });
    expect(es.getByText("Panel de Cuadrícula de Akkuea Land")).not.toBeNull();
  });

  it("renders the onboarding page in English and Spanish with no axe violations", async () => {
    currentPathname = "/onboarding";
    const en = renderWithIntl(<OnboardingPage />);
    expect(en.getByText("Welcome to Akkuea Land")).not.toBeNull();
    const results = await axe.run(en.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
    cleanup();

    const es = renderWithIntl(<OnboardingPage />, { locale: "es" });
    expect(es.getByText("Bienvenido a Akkuea Land")).not.toBeNull();
  });

  it("renders the map page in English and Spanish with no axe violations", async () => {
    currentPathname = "/map";
    const en = renderWithIntl(<MapPage />);
    expect(en.getByText("City Map")).not.toBeNull();
    const results = await axe.run(en.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
    cleanup();

    const es = renderWithIntl(<MapPage />, { locale: "es" });
    expect(es.getByText("Mapa de la Ciudad")).not.toBeNull();
  });

  it("renders the marketplace page in English and Spanish with no axe violations", async () => {
    currentPathname = "/marketplace";
    const en = renderWithIntl(<MarketplacePage />);
    expect(en.getByRole("heading", { name: "Marketplace" })).not.toBeNull();
    const results = await axe.run(en.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
    cleanup();

    const es = renderWithIntl(<MarketplacePage />, { locale: "es" });
    expect(es.getByRole("heading", { name: "Mercado" })).not.toBeNull();
  });

  it("renders the login page in English and Spanish with no axe violations", async () => {
    currentPathname = "/login";
    const en = renderWithIntl(<LoginPage />);
    expect(en.getByText("Connect your Stellar wallet to play")).not.toBeNull();
    const results = await axe.run(en.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
    cleanup();

    const es = renderWithIntl(<LoginPage />, { locale: "es" });
    expect(
      es.getByText("Conecta tu billetera Stellar para jugar"),
    ).not.toBeNull();
  });

  it("renders the dashboard page in English and Spanish with no axe violations", async () => {
    currentPathname = "/dashboard";
    const en = renderWithIntl(<DashboardPage />);
    expect(en.getByText("Portfolio Overview")).not.toBeNull();
    const results = await axe.run(en.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
    cleanup();

    const es = renderWithIntl(<DashboardPage />, { locale: "es" });
    expect(es.getByText("Resumen del Portafolio")).not.toBeNull();
  });
});
