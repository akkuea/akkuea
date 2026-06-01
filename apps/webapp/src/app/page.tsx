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
import { ErrorBoundary } from "@/components/ui";
import { pageTransition } from "@/lib/animations";

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
      <main>
        <ErrorBoundary>
          <Hero />
          <AnimatedStats />
          <Features />
          <HowItWorks />
          <CTA />
        </ErrorBoundary>
      </main>
      <Footer />
    </motion.div>
  );
}
