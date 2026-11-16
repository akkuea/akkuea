/* eslint-disable @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import "@/test/jsdomListenerSignal";

import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import axe from "axe-core";
import { NextIntlClientProvider, useLocale } from "next-intl";
import enMessages from "../../../../messages/en.json";
import esMessages from "../../../../messages/es.json";

mock.module("framer-motion", () => {
  const passthroughDiv = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  >(function PassthroughDiv(
    {
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      layoutId: _layoutId,
      ...props
    },
    ref,
  ) {
    return (
      <div ref={ref} {...props}>
        {children as ReactNode}
      </div>
    );
  });

  const passthroughHeader = forwardRef<
    HTMLElement,
    HTMLAttributes<HTMLElement> & Record<string, unknown>
  >(function PassthroughHeader(
    {
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    },
    ref,
  ) {
    return (
      <header ref={ref} {...props}>
        {children as ReactNode}
      </header>
    );
  });

  const passthroughUl = forwardRef<
    HTMLUListElement,
    HTMLAttributes<HTMLUListElement> & Record<string, unknown>
  >(function PassthroughUl(
    {
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    },
    ref,
  ) {
    return (
      <ul ref={ref} {...props}>
        {children as ReactNode}
      </ul>
    );
  });

  const passthroughButton = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>
  >(function PassthroughButton(
    {
      children,
      whileHover: _whileHover,
      whileTap: _whileTap,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      variants: _variants,
      ...props
    },
    ref,
  ) {
    return (
      <button ref={ref} {...props}>
        {children as ReactNode}
      </button>
    );
  });

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {
        div: passthroughDiv,
        header: passthroughHeader,
        ul: passthroughUl,
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

mock.module("@/i18n/routing", () => ({
  Link: forwardRef<
    HTMLAnchorElement,
    AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(function MockLocaleLink({ href, children, ...props }, ref) {
    const locale = useLocale();
    const localizedHref = href.startsWith("/") ? `/${locale}${href}` : href;
    return (
      <a ref={ref} href={localizedHref} {...props}>
        {children}
      </a>
    );
  }),
  usePathname: () => "/",
  useRouter: () => ({
    push: () => {},
    replace: () => {},
  }),
}));

const { cleanup, fireEvent, render, within } =
  await import("@testing-library/react");
const { NavbarView, resolvePilotNavItems } = await import("../Navbar");

const ALLY = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA";
const OPERATOR = "GDTNXRLOJD2YEBPKK7KCMR7J33AAG5VZXHAJTHIG736D6LVEFLLLKPDL";

function renderNavbar(
  options: {
    locale?: "en" | "es";
    pathname?: string;
    connectedAddress?: string | null;
    allyAddress?: string | null;
  } = {},
) {
  const {
    locale = "en",
    pathname = "/",
    connectedAddress = null,
    allyAddress = ALLY,
  } = options;
  const messages = locale === "es" ? esMessages : enMessages;

  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <NavbarView
        pathname={pathname}
        connectedAddress={connectedAddress}
        allyAddress={allyAddress}
        brandSlot={<a href={`/${locale}`}>AKKUEA</a>}
        rightSlot={null}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("resolvePilotNavItems", () => {
  it("exposes only investor and onboarding links to disconnected visitors", () => {
    const items = resolvePilotNavItems({
      pathname: "/",
      connectedAddress: null,
      allyAddress: ALLY,
    });
    expect(items.map((item) => item.href)).toEqual([
      "/pilot/investor",
      "/pilot/onboarding",
    ]);
  });

  it("includes the ally link only when the connected wallet matches the configured ally", () => {
    const items = resolvePilotNavItems({
      pathname: "/",
      connectedAddress: ALLY,
      allyAddress: ALLY,
    });
    expect(items.map((item) => item.href)).toEqual([
      "/pilot/investor",
      "/pilot/onboarding",
      "/pilot/ally",
    ]);
  });

  it("includes the operator queues when a non-ally wallet is connected", () => {
    const items = resolvePilotNavItems({
      pathname: "/",
      connectedAddress: OPERATOR,
      allyAddress: ALLY,
    });
    expect(items.map((item) => item.href)).toEqual([
      "/pilot/investor",
      "/pilot/onboarding",
      "/pilot/review/whitelist",
      "/pilot/review/evidence",
    ]);
  });
});

describe("Navbar pilot navigation", () => {
  it("reaches investor dashboard and onboarding on desktop and mobile widths", () => {
    const view = renderNavbar({ pathname: "/" });
    const scope = within(view.container);

    const pilotTrigger = scope.getByRole("button", { name: /^pilot$/i });
    expect(pilotTrigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(pilotTrigger);
    expect(pilotTrigger.getAttribute("aria-expanded")).toBe("true");

    const desktopMenu = view.container.querySelector("#navbar-pilot-menu")!;
    expect(desktopMenu).not.toBeNull();
    const desktopHrefs = Array.from(
      desktopMenu.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ).map((anchor) => anchor.getAttribute("href"));
    expect(desktopHrefs).toEqual([
      "/en/pilot/investor",
      "/en/pilot/onboarding",
    ]);

    const mobileToggle = scope.getByRole("button", { name: /toggle menu/i });
    fireEvent.click(mobileToggle);
    const mobileMenu = view.container.querySelector("#navbar-mobile-menu")!;
    expect(mobileMenu).not.toBeNull();
    const mobileHrefs = Array.from(
      mobileMenu.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ).map((anchor) => anchor.getAttribute("href"));
    expect(mobileHrefs).toContain("/en/pilot/investor");
    expect(mobileHrefs).toContain("/en/pilot/onboarding");
  });

  it("preserves the Spanish locale across pilot links", () => {
    const view = renderNavbar({
      locale: "es",
      pathname: "/",
      connectedAddress: OPERATOR,
    });
    const scope = within(view.container);

    fireEvent.click(scope.getByRole("button", { name: /^piloto$/i }));
    const desktopMenu = view.container.querySelector("#navbar-pilot-menu")!;
    const hrefs = Array.from(
      desktopMenu.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ).map((anchor) => anchor.getAttribute("href"));

    expect(hrefs).toEqual([
      "/es/pilot/investor",
      "/es/pilot/onboarding",
      "/es/pilot/review/whitelist",
      "/es/pilot/review/evidence",
    ]);
    expect(scope.queryByText("Panel de inversor")).not.toBeNull();
    expect(scope.queryByText("Solicitud de lista blanca")).not.toBeNull();
  });

  it("marks the active pilot route on both the trigger and the matching link", () => {
    const view = renderNavbar({ pathname: "/pilot/onboarding" });
    const scope = within(view.container);

    const pilotTrigger = scope.getByRole("button", { name: /^pilot$/i });
    expect(pilotTrigger.getAttribute("data-active")).toBe("true");

    fireEvent.click(pilotTrigger);
    const onboardingLink = within(
      view.container.querySelector("#navbar-pilot-menu") as HTMLElement,
    ).getByRole("link", { name: /whitelist onboarding/i });
    const investorLink = within(
      view.container.querySelector("#navbar-pilot-menu") as HTMLElement,
    ).getByRole("link", { name: /investor dashboard/i });

    expect(onboardingLink.getAttribute("aria-current")).toBe("page");
    expect(investorLink.getAttribute("aria-current")).toBeNull();
  });

  it("supports keyboard navigation and returns focus to the trigger on Escape", () => {
    const view = renderNavbar({
      pathname: "/",
      connectedAddress: ALLY,
    });
    const scope = within(view.container);

    const pilotTrigger = scope.getByRole("button", { name: /^pilot$/i });
    fireEvent.click(pilotTrigger);

    const desktopMenu = view.container.querySelector(
      "#navbar-pilot-menu",
    ) as HTMLElement;
    const links = Array.from(
      desktopMenu.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );
    expect(links.length).toBe(3);

    links[0]!.focus();
    expect(document.activeElement).toBe(links[0]);

    fireEvent.keyDown(desktopMenu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links[1]);

    fireEvent.keyDown(desktopMenu, { key: "End" });
    expect(document.activeElement).toBe(links[2]);

    fireEvent.keyDown(desktopMenu, { key: "Home" });
    expect(document.activeElement).toBe(links[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(view.container.querySelector("#navbar-pilot-menu")).toBeNull();
    expect(document.activeElement).toBe(pilotTrigger);
  });

  it("has zero axe accessibility violations with desktop and mobile menus open", async () => {
    const view = renderNavbar({
      pathname: "/pilot/investor",
      connectedAddress: OPERATOR,
    });
    const scope = within(view.container);

    fireEvent.click(scope.getByRole("button", { name: /^pilot$/i }));
    fireEvent.click(scope.getByRole("button", { name: /toggle menu/i }));

    const results = await axe.run(view.container);
    expect(results.violations).toEqual([]);
  });
});
