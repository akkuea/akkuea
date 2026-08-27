"use client";

import { useTranslations } from "next-intl";
import { ErrorBoundary, SectionErrorFallback } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { usePilotCycles, usePilotHoldings } from "@/hooks/usePilotContract";
import { pilotPropertySplatUrl } from "@/services/pilot/config";
import { CycleStatusTimeline } from "./CycleStatusTimeline";
import { InvestorHoldingsCard } from "./InvestorHoldingsCard";
import { PropertyEvidencePanel } from "./PropertyEvidencePanel";

interface InvestorDashboardProps {
  /** Name of the ally property shown in the 3D evidence panel. */
  propertyName?: string;
}

/**
 * The investor's view: what they hold, how reliably the ally has paid, and what
 * the property actually looks like.
 *
 * Each section is wrapped on its own, so a failing holdings read cannot take
 * the payment history down with it.
 */
export function InvestorDashboard({ propertyName }: InvestorDashboardProps) {
  const t = useTranslations("Pilot");
  const { address } = useWallet();
  const cycles = usePilotCycles();
  const holdings = usePilotHoldings(address);

  return (
    <div className="space-y-6">
      <ErrorBoundary
        fallback={<SectionErrorFallback onReset={holdings.refetch} />}
      >
        <InvestorHoldingsCard
          holdings={holdings.holdings}
          totalDistributed={cycles.timeline.totalDistributed}
          isLoading={holdings.isLoading}
          error={holdings.error}
          isDisconnected={holdings.isDisconnected}
          lastUpdatedAt={holdings.lastUpdatedAt}
          connectionStatus={holdings.connectionStatus}
          onRefresh={holdings.refetch}
        />
      </ErrorBoundary>

      <ErrorBoundary
        fallback={<SectionErrorFallback onReset={cycles.refetch} />}
      >
        <CycleStatusTimeline
          timeline={cycles.timeline}
          isLoading={cycles.isLoading}
          error={cycles.error}
          lastUpdatedAt={cycles.lastUpdatedAt}
          connectionStatus={cycles.connectionStatus}
          onRefresh={cycles.refetch}
        />
      </ErrorBoundary>

      <ErrorBoundary fallback={<SectionErrorFallback />}>
        <PropertyEvidencePanel
          splatUrl={pilotPropertySplatUrl()}
          propertyName={propertyName ?? t("property.defaultName")}
        />
      </ErrorBoundary>
    </div>
  );
}
