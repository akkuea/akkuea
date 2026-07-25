"use client";

import { useEffect } from "react";
import { Navbar, Footer } from "@/components/layout";
import { PageErrorFallback } from "@/components/ui";

/**
 * Root-level error boundary. Catches unhandled errors from any page that
 * doesn't have its own `error.tsx`. Includes Navbar + Footer so users can
 * always navigate away.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <PageErrorFallback onReset={reset} />
      </main>
      <Footer />
    </div>
  );
}
