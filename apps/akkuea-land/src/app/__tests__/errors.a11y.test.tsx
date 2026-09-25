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
import React from "react";
import { cleanup, fireEvent } from "@testing-library/react";
import axe from "axe-core";
import { renderWithIntl } from "@/test/renderWithIntl";

mock.module("next/navigation", () => ({
  usePathname: () => "/map",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

import RootError from "../[locale]/error";
import DashboardError from "../[locale]/dashboard/error";
import MapError from "../[locale]/map/error";
import MarketplaceError from "../[locale]/marketplace/error";
import LoginError from "../[locale]/(auth)/login/error";
import NotFound from "../[locale]/not-found";

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
};
const testError = Object.assign(new Error("boom"), { digest: "test-digest" });

afterEach(() => {
  cleanup();
});

describe.each([
  ["RootError", RootError, "Something went wrong"],
  ["DashboardError", DashboardError, "Your dashboard couldn't load"],
  ["MapError", MapError, "The city map couldn't load"],
  ["MarketplaceError", MarketplaceError, "The marketplace couldn't load"],
  ["LoginError", LoginError, "Login couldn't load"],
] as const)("%s", (_name, ErrorComponent, expectedTitle) => {
  it("renders a retry action and calls reset on click", () => {
    const reset = mock(() => {});
    const view = renderWithIntl(
      <ErrorComponent error={testError} reset={reset} />,
    );

    expect(view.getByText(expectedTitle)).not.toBeNull();
    const retryButton = view.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    const view = renderWithIntl(
      <ErrorComponent error={testError} reset={mock(() => {})} />,
    );

    const results = await axe.run(view.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });
});

describe("NotFound", () => {
  it("renders a translated message and a link back home in both locales", () => {
    const en = renderWithIntl(<NotFound />);
    expect(en.getByText("Page not found")).not.toBeNull();
    expect(en.getByRole("link", { name: /Back to Home/i })).not.toBeNull();
    cleanup();

    const es = renderWithIntl(<NotFound />, { locale: "es" });
    expect(es.getByText("Página no encontrada")).not.toBeNull();
  });

  it("has no axe violations", async () => {
    const view = renderWithIntl(<NotFound />);

    const results = await axe.run(view.container, AXE_OPTIONS);
    expect(results.violations).toEqual([]);
  });
});
