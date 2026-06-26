"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, Wallet, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { privyProvider } from "@/services/wallet/privy.provider";
import { cn } from "@/lib/utils";

interface WalletProviderModalProps {
  open: boolean;
  onClose: () => void;
  providers: Array<{ id: string; name: string }>;
  onSelect: (providerId: string) => Promise<void>;
  error?: string | null;
}

const providerIcons: Record<string, React.ReactNode> = {
  privy: <Mail className="w-5 h-5" />,
  "stellar-wallets-kit": <Wallet className="w-5 h-5" />,
  "smart-account-kit": <KeyRound className="w-5 h-5" />,
};

export function WalletProviderModal({
  open,
  onClose,
  providers,
  onSelect,
  error,
}: WalletProviderModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    setLoadingId(id);
    try {
      await onSelect(id);
      onClose();
    } catch {
      // Error message is set by the parent via the error prop.
    } finally {
      setLoadingId(null);
    }
  };

  const handleClose = () => {
    if (loadingId === "privy") {
      privyProvider.cancelConnect();
    }
    setLoadingId(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={loadingId ? undefined : handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
          >
            <div className="w-full max-w-sm bg-[#0a0a0a] border border-[#262626] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
                <div>
                  <h2
                    id="wallet-modal-title"
                    className="text-sm font-semibold text-white"
                  >
                    Connect Wallet
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {loadingId
                      ? "Complete sign-in in the popup…"
                      : "Choose how you want to sign in"}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 space-y-2">
                {providers.map((provider) => {
                  const isLoading = loadingId === provider.id;
                  const isDisabled = loadingId !== null && !isLoading;

                  return (
                    <button
                      key={provider.id}
                      onClick={() => handleSelect(provider.id)}
                      disabled={isDisabled || isLoading}
                      className={cn(
                        "w-full flex items-center gap-4 px-4 py-3.5 rounded-lg border transition-all duration-150 cursor-pointer text-left",
                        "border-[#262626] bg-[#111111] hover:border-[#404040] hover:bg-[#1a1a1a]",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                        isLoading && "border-[#404040] bg-[#1a1a1a]",
                      )}
                    >
                      <span className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#262626] text-neutral-400">
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          (providerIcons[provider.id] ?? (
                            <Wallet className="w-5 h-5" />
                          ))
                        )}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {provider.name}
                        </p>
                      </div>

                      {!isLoading && (
                        <ArrowRight className="w-4 h-4 text-neutral-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-5 py-3 border-t border-[#262626]">
                {error && (
                  <p className="text-xs text-red-400 text-center mb-2">
                    {error}
                  </p>
                )}
                <p className="text-[10px] text-neutral-600 text-center">
                  By connecting, you agree to the{" "}
                  <span className="text-neutral-400">Terms of Service</span>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
