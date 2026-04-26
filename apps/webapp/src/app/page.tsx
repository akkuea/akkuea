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
import { Transaction } from "@real-estate-defi/shared";
import { pageTransition } from "@/lib/animations";

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    type: "buy_shares",
    amount: "1500.00",
    asset: "USDC",
    from: "GB777777777777777777777777777777777777777777777777777777",
    to: "GA666666666666666666666666666666666666666666666666666666",
    timestamp: "2026-04-25T14:30:00Z",
    hash: "7b4e9f8a2c1d6e5b4a3f2e1d0c9b8a7f6e5d4c3b2a10987654321fedcba09876",
    status: "confirmed",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    type: "deposit",
    amount: "5000.00",
    asset: "XLM",
    from: "GB777777777777777777777777777777777777777777777777777777",
    timestamp: "2026-04-26T00:10:00Z",
    hash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
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
