"use client";

import { usePathname } from "@/i18n/routing";
import { Link } from "@/i18n/routing";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Menu,
  X,
  Building2,
  LayoutDashboard,
  Store,
  Landmark,
  Rocket,
  UserCheck,
  HandCoins,
  ClipboardCheck,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { WalletStatusWidget } from "@/components/layout/WalletStatusWidget";
import { LanguageSelector } from "@/components/layout/LanguageSelector";

const isOperatorConfigured =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_PILOT_OPERATOR_ADDRESS);

export function Navbar() {
  const pathname = usePathname();
  useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations("Navbar");

  const navigation = [
    { name: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("marketplace"), href: "/marketplace", icon: Store },
    { name: t("tokenize"), href: "/tokenize", icon: Building2 },
    { name: t("lending"), href: "/lending", icon: Landmark },
  ];

  const pilotPublicLinks = [
    {
      name: t("pilotInvestor"),
      href: "/pilot/investor",
      icon: HandCoins,
    },
    {
      name: t("pilotOnboarding"),
      href: "/pilot/onboarding",
      icon: Rocket,
    },
  ];

  const pilotOperatorLinks = isOperatorConfigured
    ? [
        {
          name: t("pilotAlly"),
          href: "/pilot/ally",
          icon: UserCheck,
        },
        {
          name: t("pilotReview"),
          href: "/pilot/review/whitelist",
          icon: ClipboardCheck,
        },
      ]
    : [];

  const allLinks = [...navigation, ...pilotPublicLinks, ...pilotOperatorLinks];

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-[#262626]"
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <BrandLogo animateIcon textClassName="hidden sm:block" />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {/* Core links */}
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer",
                    isActive
                      ? "text-white"
                      : "text-neutral-500 hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active"
                      className="absolute inset-0 bg-[#1a1a1a] rounded-md border border-[#262626]"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5" />
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Pilot separator and links */}
            <span className="mx-1 h-4 w-px bg-[#262626]" aria-hidden="true" />

            {[...pilotPublicLinks, ...pilotOperatorLinks].map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer",
                    isActive
                      ? "text-white"
                      : "text-neutral-500 hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-pilot"
                      className="absolute inset-0 bg-[#1a1a1a] rounded-md border border-[#262626]"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5" />
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <WalletStatusWidget />

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-[#262626] overflow-hidden"
            >
              <div className="py-3 space-y-1">
                {allLinks.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-[#1a1a1a] text-white border border-[#262626]"
                          : "text-neutral-500 hover:text-white hover:bg-[#1a1a1a]/50",
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}
