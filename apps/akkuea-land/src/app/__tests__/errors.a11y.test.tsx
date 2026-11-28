// All land tests share one JSDOM realm (see src/test/setupJsdom.ts).
// axe-core captures window/document when it is first imported, so renders
// and axe.run calls must use the same realm or axe rejects the container.
import { ensureSharedDom } from "@/test/setupJsdom";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
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

beforeEach(ensureSharedDom);

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
