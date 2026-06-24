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
        className="mx-auto mb-8 grid gap-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 p-4 w-fit shadow-2xl shadow-indigo-950/20"
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

      <h1 className="mb-4 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
        Welcome to Akkuea Land
      </h1>

      <div className="space-y-4 mb-8 max-w-sm mx-auto">
        <p className="text-sm text-slate-400 leading-relaxed">
          Explore and buy virtual properties in a dynamic, live city grid. Earn
          steady rental income in real-time as the city thrives.
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          Your Stellar wallet has been set up securely through Pollar. You don't
          need any prior blockchain experience or fees to play.
        </p>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="rounded-xl bg-indigo-600 px-10 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all duration-200 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35"
      >
        Get Started
      </motion.button>
    </motion.div>
  );
}

// Curated harmonious neon city palette
const SAMPLE_TILES = [
  "#1e1b4b",
  "#312e81",
  "#1e1b4b",
  "#3730a3",
  "#1e1b4b",
  "#3730a3",
  "#4338ca",
  "#312e81",
  "#1e1b4b",
  "#4338ca",
  "#1e1b4b",
  "#3730a3",
  "#312e81",
  "#4338ca",
  "#3730a3",
  "#4338ca",
  "#1e1b4b",
  "#3730a3",
  "#312e81",
  "#1e1b4b",
  "#312e81",
  "#4338ca",
  "#1e1b4b",
  "#3730a3",
  "#4338ca",
];
