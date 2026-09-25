"use client";

import { useTranslations } from "next-intl";
import { ErrorBoundary, SectionErrorFallback } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import {
  usePilotCycles,
  usePilotHoldings,
  usePilotSettlement,
  usePilotState,
} from "@/hooks/usePilotContract";
import {
  pilotPayoutExplorerUrl,
  pilotPropertySplatUrl,
} from "@/services/pilot/config";
import { CycleStatusTimeline } from "./CycleStatusTimeline";
import { EurcPreferenceForm } from "./EurcPreferenceForm";
import { InvestorHoldingsCard } from "./InvestorHoldingsCard";
import { PayoutHistory } from "./PayoutHistory";
import { PilotStateBanner } from "./PilotStateBanner";
import { PropertyEvidencePanel } from "./PropertyEvidencePanel";
import { WithheldFundsCard } from "./WithheldFundsCard";

interface InvestorDashboardProps {
  /** Name of the ally property shown in the 3D evidence panel. */
  propertyName?: string;
}

/**
 * The investor's view: what they hold, what they were actually paid, what they
 * can still claim, and the property behind the income.
 *
 * Each section is wrapped on its own, so a failing holdings read cannot take
 * the payout history down with it. The terminal and paused banner sits above
 * everything, because an investor in a wound-down pilot must not be left
 * reading stale "pending" cycles with no explanation.
 */
export function InvestorDashboard({ propertyName }: InvestorDashboardProps) {
  const t = useTranslations("Pilot");
  const { address } = useWallet();
  const cycles = usePilotCycles();
  const holdings = usePilotHoldings(address);
  const settlement = usePilotSettlement(address);
  const state = usePilotState();

  return (
    <div className="space-y-6">
      <PilotStateBanner
        exitRecord={state.exitRecord}
        isPaused={state.isPaused}
      />

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

      {!settlement.isDisconnected && (
        <ErrorBoundary
          fallback={<SectionErrorFallback onReset={settlement.refetch} />}
        >
          <WithheldFundsCard
            withheld={settlement.settlement?.withheld ?? BigInt(0)}
            onClaimed={settlement.refetch}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary
        fallback={<SectionErrorFallback onReset={settlement.refetch} />}
      >
        <PayoutHistory
          cycles={settlement.settlement?.cycles ?? []}
          isLoading={settlement.isLoading}
          error={settlement.error}
          lastUpdatedAt={settlement.lastUpdatedAt}
          connectionStatus={settlement.connectionStatus}
          onRefresh={settlement.refetch}
          explorerUrl={pilotPayoutExplorerUrl()}
        />
      </ErrorBoundary>

      {!settlement.isDisconnected && (
        <ErrorBoundary
          fallback={<SectionErrorFallback onReset={settlement.refetch} />}
        >
          <EurcPreferenceForm
            currentPreference={settlement.settlement?.preference ?? "usdc"}
            isPaused={state.isPaused}
            onUpdated={settlement.refetch}
          />
        </ErrorBoundary>
      )}

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
