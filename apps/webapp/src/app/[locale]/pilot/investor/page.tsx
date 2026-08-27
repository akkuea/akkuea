"use client";

import { useTranslations } from "next-intl";
import { GridBackground } from "@/components/landing";
import { ErrorBoundary, PageErrorFallback } from "@/components/ui";
import { InvestorDashboard } from "@/components/pilot/InvestorDashboard";

export default function PilotInvestorPage() {
  const t = useTranslations("Pilot");

  return (
    <div className="noise-bg relative min-h-screen w-full px-[4%] py-20">
      <GridBackground />
      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            {t("investor.pageTitle")}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {t("investor.pageSubtitle")}
          </p>
        </header>
        <ErrorBoundary fallback={<PageErrorFallback />}>
          <InvestorDashboard />
        </ErrorBoundary>
      </div>
    </div>
  );
}
