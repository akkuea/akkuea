"use client";

import React from "react";
import { motion } from "framer-motion";

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      {/* City grid illustration: a 5x5 mini grid as visual */}
      <div
        className="mx-auto mb-8 grid gap-1.5 rounded-2xl bg-land-surface/80 border border-land-border/80 p-4 w-fit shadow-2xl shadow-land-accent/20"
        style={{ gridTemplateColumns: "repeat(5, 2.5rem)" }}
      >
        {SAMPLE_TILES.map((color, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.02, type: "spring", stiffness: 100 }}
            whileHover={{ scale: 1.1, filter: "brightness(1.2)" }}
            className="h-10 w-10 rounded-lg cursor-pointer transition-shadow shadow-md"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <h1 className="mb-4 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-land-fg to-land-accent bg-clip-text text-transparent">
        Welcome to Akkuea Land
      </h1>

      <div className="space-y-4 mb-8 max-w-sm mx-auto">
        <p className="text-sm text-land-fg-muted leading-relaxed">
          Explore and buy virtual properties in a dynamic, live city grid. Earn
          steady rental income in real-time as the city thrives.
        </p>
        <p className="text-sm text-land-fg-muted leading-relaxed">
          Your Stellar wallet has been set up securely through Pollar. You
          don&apos;t need any prior blockchain experience or fees to play.
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="rounded-xl bg-land-accent-fill px-10 py-3.5 text-sm font-bold text-land-on-accent hover:bg-land-accent-fill/90 transition-all duration-200 shadow-lg shadow-land-accent-fill/20 hover:shadow-land-accent-fill/35"
      >
        Get Started
      </motion.button>
    </motion.div>
  );
}

// Decorative city grid, drawn from the design tokens in globals.css so the
// illustration tracks the palette instead of pinning its own hex values.
const TILE_TOKENS = [
  "var(--land-surface)",
  "var(--land-surface-raised)",
  "var(--land-border)",
  "var(--land-border-hover)",
] as const;

// Fixed pattern (not random) so the grid renders identically on server and client.
const SAMPLE_TILES = [
  0, 1, 0, 2, 0, 2, 3, 1, 0, 3, 0, 2, 1, 3, 2, 3, 0, 2, 1, 0, 1, 3, 0, 2, 3,
].map((i) => TILE_TOKENS[i]);
