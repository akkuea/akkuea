"use client";

import { motion } from "framer-motion";
import { Navbar, Footer } from "@/components/layout";
import { ErrorBoundary, SectionErrorFallback } from "@/components/ui";
import { TreasuryPanel } from "@/components/treasury";
import { pageTransition } from "@/lib/animations";

export default function TreasuryPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <motion.main
        variants={pageTransition}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"
      >
        <ErrorBoundary fallback={<SectionErrorFallback />}>
          <TreasuryPanel />
        </ErrorBoundary>
      </motion.main>
      <Footer />
    </div>
  );
}
