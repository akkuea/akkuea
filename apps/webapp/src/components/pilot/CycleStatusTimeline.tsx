"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock, FileWarning } from "lucide-react";
import type {
  PilotCycleTimeline,
  PilotCycleTimelineEntry,
} from "@real-estate-defi/shared";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import {
  Card,
  EmptyState,
  FreshnessIndicator,
  SectionErrorFallback,
  SkeletonText,
  Stepper,
} from "@/components/ui";
import { CycleStatusBadge } from "./CycleStatusBadge";
import { formatCycleLabel, formatUnixDate, formatUsdc } from "./format";

interface CycleStatusTimelineProps {
  timeline: PilotCycleTimeline;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  onRefresh: () => void;
}

/**
 * Index of the step the Stepper should treat as current.
 *
 * Every cycle whose money has actually landed counts as complete, so the marker
 * sits on the first cycle still owed. A fully paid history puts it past the end,
 * which is what marks the last cycle complete rather than in progress.
 */
function currentStepFor(entries: PilotCycleTimelineEntry[]): number {
  const firstUnsettled = entries.findIndex(
    (entry) => entry.status !== "on_time" && entry.status !== "late",
  );
  return firstUnsettled === -1 ? entries.length : firstUnsettled;
}

function EscalationNotice({ missed }: { missed: number }) {
  const t = useTranslations("Pilot");

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-medium text-white">
          {t("timeline.escalationTitle", { count: missed })}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("timeline.escalationDescription")}
        </p>
      </div>
    </div>
  );
}

function CycleRow({ entry }: { entry: PilotCycleTimelineEntry }) {
  const t = useTranslations("Pilot");
  const { cycle, status } = entry;

  return (
    <li className="flex flex-col gap-2 border-b border-white/5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">
            {formatCycleLabel(cycle.cycleId)}
          </p>
          <CycleStatusBadge status={status} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {cycle.distribution
            ? t("timeline.expectedAndPaid", {
                date: formatUnixDate(cycle.expectedAt),
                paidDate: formatUnixDate(cycle.distribution.distributedAt),
              })
            : t("timeline.expected", {
                date: formatUnixDate(cycle.expectedAt),
              })}
        </p>
        {cycle.evidence?.reviewReason && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
            <FileWarning
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>{cycle.evidence.reviewReason}</span>
          </p>
        )}
      </div>
      <p className="shrink-0 text-sm text-neutral-300 sm:text-right">
        {cycle.distribution ? formatUsdc(cycle.distribution.holderAmount) : "-"}
      </p>
    </li>
  );
}

/**
 * Cycle-by-cycle payment history for the pilot.
 *
 * The point of showing every cycle, rather than a single balance, is that a
 * pattern of reliability is the thing an investor is actually assessing.
 */
export function CycleStatusTimeline({
  timeline,
  isLoading,
  error,
  lastUpdatedAt,
  connectionStatus,
  onRefresh,
}: CycleStatusTimelineProps) {
  const t = useTranslations("Pilot");
  const { entries, escalated, consecutiveMissed } = timeline;

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">
        {t("timeline.title")}
      </h2>
      <FreshnessIndicator
        lastUpdatedAt={lastUpdatedAt}
        connectionStatus={connectionStatus}
        onRefresh={onRefresh}
      />
    </div>
  );

  if (isLoading && entries.length === 0) {
    return (
      <Card variant="bordered">
        {header}
        <SkeletonText lines={5} />
      </Card>
    );
  }

  if (error && entries.length === 0) {
    return (
      <Card variant="bordered">
        {header}
        <SectionErrorFallback onReset={onRefresh} message={error} />
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card variant="bordered">
        {header}
        <EmptyState
          title={t("timeline.emptyTitle")}
          description={t("timeline.emptyDescription")}
          icon={
            <CalendarClock
              className="h-5 w-5 text-neutral-500"
              aria-hidden="true"
            />
          }
        />
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      {header}

      {error && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        >
          {t("timeline.staleReading")} {error}
        </p>
      )}

      {escalated && (
        <div className="mb-6">
          <EscalationNotice missed={consecutiveMissed} />
        </div>
      )}

      <div className="mb-6 overflow-x-auto">
        <Stepper
          steps={entries.map((entry) => ({
            id: entry.cycle.cycleId,
            title: formatCycleLabel(entry.cycle.cycleId),
            description: formatUnixDate(entry.cycle.expectedAt),
          }))}
          currentStep={currentStepFor(entries)}
        />
      </div>

      <ul className="divide-y divide-white/5">
        {entries.map((entry) => (
          <CycleRow key={entry.cycle.cycleId} entry={entry} />
        ))}
      </ul>
    </Card>
  );
}
