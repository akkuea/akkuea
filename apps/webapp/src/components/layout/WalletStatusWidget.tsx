"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useGameWallet } from "@/components/auth/hooks";
import { cn, truncateAddress } from "@/lib/utils";

export function WalletStatusWidget() {
  const { wallet, isConnected, isConnecting, connect, logout } =
    useGameWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isConnected) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={connect}
        isLoading={isConnecting}
        leftIcon={<Wallet className="h-3.5 w-3.5" />}
      >
        Connect
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setMenuOpen((value) => !value)}
        className="min-w-[200px] justify-between"
        leftIcon={<Wallet className="h-3.5 w-3.5" />}
        rightIcon={
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              menuOpen && "rotate-180",
            )}
          />
        }
      >
        <span className="flex flex-col items-start gap-0.5 text-left leading-tight">
          <span className="font-mono text-xs text-white">
            {truncateAddress(wallet.address, 4)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-400">
            {Number.parseFloat(wallet.balance || "0").toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}{" "}
            LAND
          </span>
        </span>
      </Button>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-[#262626] bg-[#0a0a0a] shadow-2xl"
            >
              <div className="border-b border-[#262626] p-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">
                  Wallet
                </p>
                <p className="font-mono text-xs text-white">{wallet.address}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setMenuOpen(false);
                  await logout();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-red-400 transition-colors hover:bg-[#1a1a1a]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
