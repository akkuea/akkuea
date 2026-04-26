"use client";

import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import {
  Hero,
  AnimatedStats,
  Features,
  HowItWorks,
  CTA,
} from "@/components/landing";
import TransactionHistory from "@/components/transactions/TransactionHistory";
import { Transaction } from "@real-estate-defi/shared/src/types";
import { pageTransition } from "@/lib/animations";

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx_1",
    type: "share_purchase",
    amount: 1500,
    from: "GB...",
    to: "GA...",
    timestamp: new Date("2026-04-25T14:30:00Z"),
    txHash: "7b4e9f8a2c1d6e5b4a3f2e1d0c9b8a7f6e5d4c3b2a10987654321fedcba09876",
    status: "confirmed",
  },
  {
    id: "tx_2",
    type: "deposit",
    amount: 5000,
    from: "GB...",
    timestamp: new Date("2026-04-26T00:10:00Z"),
    txHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    status: "pending",
  },
];

export default function Home() {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-black noise-bg"
    >
      <Navbar />
      <main className="space-y-20 pb-20">
        <Hero />
        <AnimatedStats />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TransactionHistory transactions={MOCK_TRANSACTIONS} />
        </div>
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />
    </motion.div>
  );
}
