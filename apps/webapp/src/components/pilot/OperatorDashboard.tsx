"use client";

import { ErrorBoundary, SectionErrorFallback } from "@/components/ui";
import { usePayoutPaused, usePilotCycles } from "@/hooks/usePilotContract";
import { CycleStatusTimeline } from "./CycleStatusTimeline";
import { EvidenceReviewQueue } from "./EvidenceReviewQueue";

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
    </div>
  );
}
