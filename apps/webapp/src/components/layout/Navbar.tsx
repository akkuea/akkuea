"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Menu,
  X,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  Handshake,
  Landmark,
  LayoutDashboard,
  ShieldCheck,
  Store,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useAuthenticationStore } from "@/components/auth/store/data/slices/authentication.slice";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { WalletStatusWidget } from "@/components/layout/WalletStatusWidget";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import {
  PilotAllyNotConfiguredError,
  pilotAllyAddress,
} from "@/services/pilot/config";

export type PilotNavLabelKey =
  | "pilotInvestor"
  | "pilotOnboarding"
  | "pilotAlly"
  | "pilotReviewWhitelist"
  | "pilotReviewEvidence";

export interface PilotNavItem {
  key: PilotNavLabelKey;
  href: string;
  icon: LucideIcon;
}

/**
 * Convenience visibility rule for role-specific pilot navigation entries:
 * - Investor (`/pilot/investor`) and Onboarding (`/pilot/onboarding`) are
 *   always shown to every visitor on desktop and mobile.
 * - Ally (`/pilot/ally`) is shown when a wallet is connected and matches the
 *   configured `NEXT_PUBLIC_PILOT_ALLY_ADDRESS`, or when already viewing `/pilot/ally`.
 * - Operator queues (`/pilot/review/whitelist`, `/pilot/review/evidence`) are
 *   shown when a wallet is connected and is not the configured ally address
 *   (`pilot-payout-split` enforces `operator != ally`, while server-side
 *   `OPERATIONS_ALLOWED_WALLETS` remains private to the API proxy), or when
 *   already viewing `/pilot/review/*`.
 *
 * Hiding links is navigation convenience only; the pages, API proxy, and
 * contracts enforce their own authorization checks.
 */
export function resolvePilotNavItems(options: {
  pathname: string;
  connectedAddress: string | null;
  allyAddress: string | null;
}): PilotNavItem[] {
  const { pathname, connectedAddress, allyAddress } = options;
  const normalizedConnected = connectedAddress?.trim() || null;
  const normalizedAlly = allyAddress?.trim() || null;

  const items: PilotNavItem[] = [
    { key: "pilotInvestor", href: "/pilot/investor", icon: TrendingUp },
    { key: "pilotOnboarding", href: "/pilot/onboarding", icon: UserPlus },
  ];

  const isAllyWallet =
    Boolean(normalizedConnected) &&
    Boolean(normalizedAlly) &&
    normalizedConnected === normalizedAlly;

  if (isAllyWallet || pathname === "/pilot/ally") {
    items.push({ key: "pilotAlly", href: "/pilot/ally", icon: Handshake });
  }

  const isPotentialOperatorWallet =
    Boolean(normalizedConnected) && !isAllyWallet;

  if (isPotentialOperatorWallet || pathname.startsWith("/pilot/review/")) {
    items.push(
      {
        key: "pilotReviewWhitelist",
        href: "/pilot/review/whitelist",
        icon: ClipboardCheck,
      },
      {
        key: "pilotReviewEvidence",
        href: "/pilot/review/evidence",
        icon: FileCheck2,
      },
    );
  }

  return items;
}

function configuredAllyOrNull(): string | null {
  try {
    return pilotAllyAddress();
  } catch (err) {
    if (err instanceof PilotAllyNotConfiguredError) {
      return null;
    }
    throw err;
  }
}

export interface NavbarViewProps {
  pathname: string;
  connectedAddress: string | null;
  allyAddress: string | null;
  brandSlot?: ReactNode;
  rightSlot?: ReactNode;
}

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function NavbarView({
  pathname,
  connectedAddress,
  allyAddress,
  brandSlot,
  rightSlot,
}: NavbarViewProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pilotMenuOpen, setPilotMenuOpen] = useState(false);
  const pilotContainerRef = useRef<HTMLDivElement>(null);
  const pilotButtonRef = useRef<HTMLButtonElement>(null);
  const pilotListRef = useRef<HTMLUListElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("Navbar");

  const navigation = [
    { name: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("marketplace"), href: "/marketplace", icon: Store },
    { name: t("tokenize"), href: "/tokenize", icon: Building2 },
    { name: t("lending"), href: "/lending", icon: Landmark },
  ];

  const pilotItems = useMemo(
    () =>
      resolvePilotNavItems({
        pathname,
        connectedAddress,
        allyAddress,
      }),
    [pathname, connectedAddress, allyAddress],
  );

  const isAnyPilotActive =
    pathname === "/pilot" || pathname.startsWith("/pilot/");

  useEffect(() => {
    if (!pilotMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        pilotContainerRef.current &&
        !pilotContainerRef.current.contains(event.target as Node)
      ) {
        setPilotMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [pilotMenuOpen]);

  useEffect(() => {
    if (!pilotMenuOpen && !mobileMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (pilotMenuOpen) {
        event.preventDefault();
        setPilotMenuOpen(false);
        pilotButtonRef.current?.focus();
      } else if (mobileMenuOpen) {
        event.preventDefault();
        setMobileMenuOpen(false);
        mobileButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pilotMenuOpen, mobileMenuOpen]);

  function focusPilotLinkAt(index: number) {
    const links =
      pilotListRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]");
    if (!links || links.length === 0) return;
    const bounded = ((index % links.length) + links.length) % links.length;
    links[bounded]?.focus();
  }

  function handlePilotTriggerKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!pilotMenuOpen) {
        setPilotMenuOpen(true);
        requestAnimationFrame(() => focusPilotLinkAt(0));
      } else {
        focusPilotLinkAt(0);
      }
    }
  }

  function handlePilotListKeyDown(
    event: React.KeyboardEvent<HTMLUListElement>,
  ) {
    const links = Array.from(
      pilotListRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ??
        [],
    );
    if (links.length === 0) return;

    const currentIndex = links.indexOf(
      document.activeElement as HTMLAnchorElement,
    );

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusPilotLinkAt(currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusPilotLinkAt(currentIndex <= 0 ? links.length - 1 : currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusPilotLinkAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusPilotLinkAt(links.length - 1);
    }
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
    >
      <nav
        aria-label={t("mainNavigation")}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-center justify-between h-14">
          {brandSlot !== undefined ? (
            brandSlot
          ) : (
            <BrandLogo animateIcon textClassName="hidden sm:block" />
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer",
                    focusRingClass,
                    isActive
                      ? "text-foreground"
                      : "text-foreground/75 hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-muted rounded-md border border-border"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Desktop Pilot Disclosure Menu */}
            <div
              ref={pilotContainerRef}
              className="relative"
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setPilotMenuOpen(false);
                }
              }}
            >
              <button
                ref={pilotButtonRef}
                type="button"
                aria-expanded={pilotMenuOpen}
                aria-controls="navbar-pilot-menu"
                data-active={isAnyPilotActive ? "true" : undefined}
                onClick={() => setPilotMenuOpen((open) => !open)}
                onKeyDown={handlePilotTriggerKeyDown}
                className={cn(
                  "relative px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer",
                  focusRingClass,
                  isAnyPilotActive || pilotMenuOpen
                    ? "text-foreground"
                    : "text-foreground/75 hover:text-foreground",
                )}
              >
                {isAnyPilotActive && (
                  <motion.div
                    layoutId="navbar-active"
                    className="absolute inset-0 bg-muted rounded-md border border-border"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("pilot")}
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-150",
                      pilotMenuOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </span>
              </button>

              <AnimatePresence>
                {pilotMenuOpen && (
                  <motion.ul
                    ref={pilotListRef}
                    id="navbar-pilot-menu"
                    aria-label={t("pilotMenuLabel")}
                    onKeyDown={handlePilotListKeyDown}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card p-1.5 shadow-2xl z-50"
                  >
                    {pilotItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setPilotMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                              focusRingClass,
                              isActive
                                ? "bg-muted text-foreground border border-border"
                                : "text-foreground/75 hover:text-foreground hover:bg-muted/60",
                            )}
                          >
                            <item.icon
                              className="w-3.5 h-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{t(item.key)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {rightSlot !== undefined ? (
              rightSlot
            ) : (
              <>
                <LanguageSelector />
                <WalletStatusWidget />
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button
              ref={mobileButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className={cn(
                "md:hidden p-2 rounded-md text-foreground/75 hover:text-foreground hover:bg-muted transition-colors cursor-pointer",
                focusRingClass,
              )}
              aria-label={t("toggleMenu")}
              aria-expanded={mobileMenuOpen}
              aria-controls="navbar-mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Menu className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="navbar-mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <div className="py-3 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                        focusRingClass,
                        isActive
                          ? "bg-muted text-foreground border border-border"
                          : "text-foreground/75 hover:text-foreground hover:bg-muted/60",
                      )}
                    >
                      <item.icon className="w-4 h-4" aria-hidden="true" />
                      {item.name}
                    </Link>
                  );
                })}

                <div className="pt-2 mt-2 border-t border-border space-y-1">
                  <p className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-foreground/75">
                    {t("pilot")}
                  </p>
                  {pilotItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                          focusRingClass,
                          isActive
                            ? "bg-muted text-foreground border border-border"
                            : "text-foreground/75 hover:text-foreground hover:bg-muted/60",
                        )}
                      >
                        <item.icon className="w-4 h-4" aria-hidden="true" />
                        {t(item.key)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}

export function Navbar() {
  const pathname = usePathname();
  useTheme();
  const isConnected = useAuthenticationStore((state) => state.isConnected);
  const address = useAuthenticationStore((state) => state.address);
  const connectedAddress = isConnected ? address : null;
  const allyAddress = configuredAllyOrNull();

  return (
    <NavbarView
      pathname={pathname}
      connectedAddress={connectedAddress}
      allyAddress={allyAddress}
    />
  );
}
