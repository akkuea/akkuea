"use client";

import React, { useState } from "react";
import { useGameWallet } from "@/hooks/useGameWallet";
import { buildBuyFromTreasuryXdr, TREASURY_ADDRESS } from "@/lib/soroban-tx";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MapPin, CheckCircle, RefreshCw } from "lucide-react";
import { PilotCta } from "@/components/game/PilotCta";

// Generate a 5x5 grid of properties (coordinates 0,0 to 4,4)
const GRID_SIZE = 5;
const STARTER_PROPERTIES = Array.from(
  { length: GRID_SIZE * GRID_SIZE },
  (_, i) => ({
    id: i,
    x: i % GRID_SIZE,
    y: Math.floor(i / GRID_SIZE),
    isTreasury: (i * 7 + 3) % 2 === 0, // Mock some treasury properties (highlighted)
    name: `Sector ${i % GRID_SIZE},${Math.floor(i / GRID_SIZE)}`,
  }),
);

export function ClaimPropertyStep({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { address, signAndSubmitTx } = useGameWallet();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "celebrating">(
    "idle",
  );

  const handleClaim = async () => {
    if (selectedId === null || !address) return;
    setStatus("pending");
    try {
      const xdr = await buildBuyFromTreasuryXdr(
        address,
        String(selectedId),
        TREASURY_ADDRESS,
      );
      await signAndSubmitTx(xdr);
      setStatus("celebrating");
      // Stay on celebration for 3 seconds, then navigate
      setTimeout(onComplete, 3000);
    } catch {
      setStatus("idle");
    }
  };

  if (status === "celebrating") {
    return <CelebrationScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-land-fg flex items-center justify-center gap-2">
          <MapPin className="text-land-accent h-6 w-6" />
          Claim your first property
        </h2>
        <p className="text-sm text-land-fg-muted max-w-sm mx-auto leading-relaxed">
          Tap on any highlighted treasury tile on the grid below. It is yours
          completely free as a starting bonus!
        </p>
      </div>

      {/* 5x5 Grid Selector */}
      <div className="mx-auto max-w-xs bg-land-surface/60 border border-land-border/80 p-4 rounded-2xl shadow-xl">
        <div className="grid grid-cols-5 gap-2">
          {STARTER_PROPERTIES.map((prop) => {
            const isSelected = selectedId === prop.id;
            const canClaim = prop.isTreasury;

            return (
              <motion.button
                key={prop.id}
                type="button"
                whileHover={canClaim ? { scale: 1.08 } : {}}
                whileTap={canClaim ? { scale: 0.93 } : {}}
                onClick={() => canClaim && setSelectedId(prop.id)}
                disabled={!canClaim}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-150 ${
                  isSelected
                    ? "bg-land-accent-fill border border-land-accent-fill ring-2 ring-land-accent-fill scale-105 shadow-lg shadow-land-accent-fill/30"
                    : canClaim
                      ? "bg-land-surface-raised border border-land-border-hover/50 hover:bg-land-border-hover cursor-pointer"
                      : "bg-land-surface/40 border border-land-border/60 opacity-20 cursor-not-allowed"
                }`}
              >
                <span
                  className={`text-[10px] font-mono ${isSelected ? "text-land-on-accent font-bold" : "text-land-fg-muted"}`}
                >
                  {prop.x},{prop.y}
                </span>

                {canClaim && !isSelected && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-land-accent rounded-full animate-pulse" />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-between text-[10px] text-land-fg-muted px-1">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-land-surface-raised border border-land-border-hover/50" />
            <span>Treasury (Free)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-land-surface/40 opacity-20 border border-land-border" />
            <span>Unavailable</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <motion.button
          whileHover={
            selectedId !== null && status !== "pending" ? { scale: 1.02 } : {}
          }
          whileTap={
            selectedId !== null && status !== "pending" ? { scale: 0.98 } : {}
          }
          onClick={handleClaim}
          disabled={selectedId === null || status === "pending"}
          className={`w-full rounded-xl py-3.5 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
            selectedId === null
              ? "bg-land-surface-raised border border-land-border-hover text-land-fg-muted cursor-not-allowed"
              : status === "pending"
                ? "bg-land-surface-raised border border-land-border-hover text-land-fg-muted cursor-not-allowed"
                : "bg-land-accent-fill hover:bg-land-accent-fill/90 text-land-on-accent shadow-land-accent-fill/20"
          }`}
        >
          {status === "pending" && (
            <RefreshCw size={14} className="animate-spin" />
          )}
          {status === "pending"
            ? "Acquiring property..."
            : "Claim Free Property"}
        </motion.button>

        {status !== "pending" && (
          <button
            onClick={onSkip}
            className="w-full text-xs text-land-fg-muted hover:text-land-fg transition duration-150 uppercase tracking-wider font-semibold text-center"
          >
            Skip this step
          </button>
        )}

        <PilotCta />
      </div>
    </motion.div>
  );
}

function CelebrationScreen() {
  return (
    <div className="text-center relative min-h-[300px] flex flex-col items-center justify-center overflow-hidden">
      {/* Premium Full-screen Confetti Burst Simulation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {CONFETTI_PARTICLES.map((particle, i) => (
          <motion.div
            key={i}
            initial={{
              x: "50%",
              y: "50%",
              scale: 0.2,
              opacity: 1,
              rotate: 0,
            }}
            animate={{
              x: particle.x,
              y: particle.y,
              scale: [0.2, 1, 0.4],
              opacity: [1, 1, 0],
              rotate: [0, particle.rotate],
            }}
            transition={{
              duration: particle.duration,
              ease: "easeOut",
              delay: particle.delay,
            }}
            className="absolute rounded-sm w-3.5 h-3.5"
            style={{
              backgroundColor: particle.color,
              borderRadius: particle.shape === "circle" ? "50%" : "4px",
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="space-y-4 z-10"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-land-success/10 text-land-success border border-land-success/20 shadow-2xl">
          <CheckCircle className="h-10 w-10 text-land-success" />
        </div>

        <div>
          <h2 className="text-3xl font-black tracking-tight text-land-fg bg-gradient-to-r from-land-success to-land-accent bg-clip-text text-transparent">
            Welcome, Landowner!
          </h2>
          <p className="mt-2 text-sm text-land-fg-muted leading-relaxed max-w-xs mx-auto">
            You successfully claimed your first property on Stellar! We are
            loading the real-time city map for you now...
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// Generate 40 vibrant, multi-colored confetti particles with randomized properties
const CONFETTI_COLORS = [
  "var(--land-success)",
  "var(--land-accent)",
  "var(--land-gold)",
  "var(--tile-listed)",
  "var(--land-warning)",
  "var(--land-fg)",
  "var(--land-danger)",
];
interface ConfettiParticle {
  color: string;
  shape: string;
  x: string;
  y: string[];
  rotate: number;
  duration: number;
  delay: number;
}
const CONFETTI_PARTICLES: ConfettiParticle[] = Array.from(
  { length: 45 },
  (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    shape: i % 2 === 0 ? "circle" : "square",
    x: `${50 + (Math.random() - 0.5) * 160}%`,
    y: [`50%`, `${10 + Math.random() * 80}%`, `120%`],
    rotate: 360 * (Math.random() > 0.5 ? 2 : -2),
    duration: 2.5 + Math.random() * 0.8,
    delay: Math.random() * 0.2,
  }),
);
