"use client";

import { captureErrorSafely } from "@akkuea/shared";

import { useEffect } from "react";
import { Navbar, Footer } from "@/components/layout";
import { PageErrorFallback } from "@/components/ui";

export default function MarketplaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MarketplaceError]", error);
    captureErrorSafely(error, {
      context: "webapp-route-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <PageErrorFallback onReset={reset} />
      </main>
      <Footer />
    </div>
  );
}
