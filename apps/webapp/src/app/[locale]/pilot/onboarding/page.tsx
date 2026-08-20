"use client";

import { GridBackground } from "@/components/landing";
import { ErrorBoundary } from "@/components/ui";
import { WhitelistOnboardingForm } from "@/components/pilot/WhitelistOnboardingForm";

export default function PilotOnboardingPage() {
  return (
    <div className="noise-bg w-full h-full min-h-screen relative flex items-center justify-center py-20 px-[4%]">
      <GridBackground />
      <ErrorBoundary>
        <WhitelistOnboardingForm />
      </ErrorBoundary>
    </div>
  );
}
