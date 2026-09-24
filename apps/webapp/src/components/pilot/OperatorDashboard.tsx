"use client";

import { ErrorBoundary, SectionErrorFallback } from "@/components/ui";
import { usePayoutPaused, usePilotCycles } from "@/hooks/usePilotContract";
import { useWallet } from "@/components/auth/hooks";
import {
  pilotAllyAddress,
  PilotAllyNotConfiguredError,
} from "@/services/pilot/config";
import { CycleStatusTimeline } from "./CycleStatusTimeline";
import { EvidenceReviewQueue } from "./EvidenceReviewQueue";
import { RecordEvidenceCosignPanel } from "./RecordEvidenceCosignPanel";
import { ExitCosignPanel } from "./ExitCosignPanel";

/**
 * The operator's view: what still needs a decision, and the record it produces.
 */
export function OperatorDashboard() {
  const {
    cycles,
    timeline,
    isLoading,
    error,
    lastUpdatedAt,
    connectionStatus,
    refetch,
  } = usePilotCycles();
  const { isPaused } = usePayoutPaused();
  const { address, signTransaction } = useWallet();

  let allyAddress: string | null = null;
  try {
    allyAddress = pilotAllyAddress();
  } catch (configError) {
    if (!(configError instanceof PilotAllyNotConfiguredError))
      throw configError;
  }

  return (
    <div className="space-y-6">
      <ErrorBoundary fallback={<SectionErrorFallback onReset={refetch} />}>
        <EvidenceReviewQueue
          cycles={cycles}
          isLoading={isLoading}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
          connectionStatus={connectionStatus}
          isPaused={isPaused}
          onRefresh={refetch}
        />
      </ErrorBoundary>

      {address && allyAddress && (
        <ErrorBoundary fallback={<SectionErrorFallback onReset={refetch} />}>
          <RecordEvidenceCosignPanel
            operatorAddress={address}
            allyAddress={allyAddress}
            signTransaction={signTransaction}
            onRecorded={refetch}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary fallback={<SectionErrorFallback onReset={refetch} />}>
        <CycleStatusTimeline
          timeline={timeline}
          isLoading={isLoading}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
          connectionStatus={connectionStatus}
          onRefresh={refetch}
        />
      </ErrorBoundary>

      {address && allyAddress && (
        <ErrorBoundary fallback={<SectionErrorFallback onReset={refetch} />}>
          <ExitCosignPanel
            operatorAddress={address}
            allyAddress={allyAddress}
            signTransaction={signTransaction}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
