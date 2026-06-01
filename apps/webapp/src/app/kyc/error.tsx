"use client";

import { useEffect } from "react";
import { PageErrorFallback } from "@/components/ui";
import { GridBackground } from "@/components/landing";

export default function KYCError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[KYCError]", error);
  }, [error]);

  return (
    <div className="noise-bg w-full h-full min-h-screen relative flex items-center justify-center py-20 px-[4%]">
      <GridBackground />
      <PageErrorFallback onReset={reset} />
    </div>
  );
}
