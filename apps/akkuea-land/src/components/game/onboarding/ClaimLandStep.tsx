"use client";

import React, { useState } from "react";
import { useGameWallet } from "@/hooks/useGameWallet";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Coins, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";

type Status = "idle" | "pending" | "done" | "error";

const STATUS_MESSAGE: Record<Status, string> = {
  idle: "Claim 1,000 LAND",
  pending: "Preparing your wallet on Stellar...",
  done: "1,000 LAND Received!",
  error: "Claim failed. Try again.",
};

export function ClaimLandStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const { signAndSubmitTx } = useGameWallet();
  const [status, setStatus] = useState<Status>("idle");

  const handleClaim = async () => {
    setStatus("pending");
    try {
      // Simulate/call transaction
      await signAndSubmitTx("placeholder-faucet-xdr");
      setStatus("done");
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-950/40 border border-indigo-500/20 text-3xl shadow-xl shadow-indigo-950/20">
        <motion.div
          animate={status === "pending" ? { rotate: 360 } : {}}
          transition={status === "pending" ? { repeat: Infinity, duration: 2, ease: "linear" } : {}}
        >
          <Coins className="h-10 w-10 text-indigo-400" />
        </motion.div>
        
        {status === "done" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5 }}
            className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg"
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>
        )}
      </div>

      <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-white">
        Get your starter LAND
      </h2>
      <p className="mb-8 text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
        LAND is the premium utility token of Akkuea Land. Reclaim 1,000 LAND from our testnet faucet for free to fund your very first property claim.
      </p>

      <div className="relative min-h-[160px] flex flex-col justify-start">
        <AnimatePresence mode="wait">
          {status === "done" ? (
            <motion.div
              key="done"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full"
            >
              <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/30 p-5 mb-6 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-black text-emerald-400 font-mono tracking-wide">
                    +1,000
                  </span>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    LAND
                  </span>
                </div>
                <p className="text-xs text-emerald-400/80">
                  Transaction successfully recorded on-chain
                </p>
                
                {/* Micro sparkle floaters */}
                <div className="absolute inset-x-0 top-0 overflow-hidden pointer-events-none h-full">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 50, opacity: 0, scale: 0.5 }}
                      animate={{ y: -30, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                      transition={{ delay: i * 0.15, duration: 1.5, repeat: Infinity }}
                      className="absolute text-emerald-400"
                      style={{
                        left: `${20 + i * 15}%`,
                        top: "10%"
                      }}
                    >
                      ✦
                    </motion.div>
                  ))}
                </div>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onNext}
                className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-500 transition-all duration-200 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                Continue to Claim Property
                <ArrowRight size={16} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="interactive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 w-full"
            >
              <motion.button
                whileHover={status === "idle" || status === "error" ? { scale: 1.02 } : {}}
                whileTap={status === "idle" || status === "error" ? { scale: 0.98 } : {}}
                onClick={handleClaim}
                disabled={status === "pending"}
                className={`w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                  status === "pending"
                    ? "bg-slate-800 border border-slate-700/60 text-slate-400 cursor-not-allowed"
                    : status === "error"
                      ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/10"
                      : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                }`}
              >
                {status === "pending" && <RefreshCw size={14} className="animate-spin" />}
                {STATUS_MESSAGE[status]}
              </motion.button>

              {status === "pending" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-indigo-400/80 animate-pulse"
                >
                  Confirming with sponsored transaction fee...
                </motion.p>
              )}

              {status === "error" && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400">
                  <AlertCircle size={14} />
                  <span>Transaction failed. Please make sure you have internet access.</span>
                </div>
              )}

              {(status === "idle" || status === "error") && (
                <button
                  onClick={onSkip}
                  className="w-full text-xs text-slate-400 hover:text-white transition duration-150 uppercase tracking-wider font-semibold"
                >
                  Skip this step
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
