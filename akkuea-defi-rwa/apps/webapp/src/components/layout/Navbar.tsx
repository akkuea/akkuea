"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Wallet,
  Building2,
  LayoutDashboard,
  Store,
  Landmark,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/context/ThemeContext";
import { useWallet } from "@/context/WalletContext";
import { cn, truncateAddress } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { name: "Tokenize", href: "/tokenize", icon: Building2 },
  { name: "Lending", href: "/lending", icon: Landmark },
];

export function Navbar() {
  const pathname = usePathname();
  useTheme();
  const { address, isConnected, isConnecting, connect, disconnect } =
    useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

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
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-lg bg-white flex items-center justify-center"
            >
              <Building2 className="w-4 h-4 text-black" />
            </motion.div>
            <span className="text-sm font-semibold text-white tracking-tight hidden sm:block group-hover:text-neutral-300 transition-colors">
              AKKUEA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
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
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="p-2 rounded-md text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button> */}

            {/* Wallet Button */}
            {isConnected ? (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  leftIcon={<Wallet className="w-3.5 h-3.5" />}
                  rightIcon={
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform",
                        walletMenuOpen && "rotate-180",
                      )}
                    />
                  }
                >
                  <span className="font-mono">
                    {truncateAddress(address || "")}
                  </span>
                </Button>
                <AnimatePresence>
                  {walletMenuOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-10"
                        onClick={() => setWalletMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-52 bg-[#0a0a0a] border border-[#262626] rounded-lg shadow-2xl overflow-hidden z-20"
                      >
                        <div className="p-3 border-b border-[#262626]">
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                            Connected
                          </p>
                          <p className="text-xs text-white font-mono">
                            {truncateAddress(address || "", 6)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            disconnect();
                            setWalletMenuOpen(false);
                          }}
                          className="w-full px-3 py-2.5 text-left text-xs text-red-400 hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                        >
                          Disconnect Wallet
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={connect}
                isLoading={isConnecting}
                leftIcon={<Wallet className="w-3.5 h-3.5" />}
              >
                Connect
              </Button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              aria-label="Toggle menu"
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
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-[#262626] overflow-hidden"
            >
              <div className="py-3 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
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
