"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, X, Loader2 } from "lucide-react";
import { useWallet } from "@/components/auth/hooks";

/**
 * Global, non-blocking banner shown when a previously-connected wallet is
 * found to be unavailable or on the wrong network (see the focus-triggered
 * check in useWallet.hook.ts). Mounted once in Providers.tsx so it has scope
 * over every route.
 */
export function WalletReconnectionPrompt() {
  const { isWalletDisconnected, reconnect, dismissReconnectionPrompt } =
    useWallet();
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await reconnect();
    } catch {
      // Error state is left visible via isWalletDisconnected; the user can retry.
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <AnimatePresence>
      {isWalletDisconnected && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
          role="alert"
          aria-live="assertive"
          className="fixed bottom-4 right-4 z-[60] w-full max-w-sm"
        >
          <div className="flex items-start gap-3 rounded-xl border border-[#262626] bg-[#0a0a0a] p-4 shadow-2xl">
            <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#262626] text-amber-400">
              <WifiOff className="w-4 h-4" />
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                Wallet disconnected
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Your wallet session ended or switched networks unexpectedly.
              </p>

              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isReconnecting && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                {isReconnecting ? "Reconnecting…" : "Reconnect"}
              </button>
            </div>

            <button
              onClick={dismissReconnectionPrompt}
              disabled={isReconnecting}
              aria-label="Dismiss"
              className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
