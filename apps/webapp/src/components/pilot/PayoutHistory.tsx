"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, History } from "lucide-react";
import {
  Badge,
  Card,
  EmptyState,
  FreshnessIndicator,
  SkeletonText,
  SectionErrorFallback,
} from "@/components/ui";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import type { PilotSettlementCycle } from "@/services/pilot/reads";
import { formatCycleLabel, formatSettlementAmount, formatUsdc } from "./format";

interface PayoutHistoryProps {
  cycles: PilotSettlementCycle[];
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  onRefresh: () => void;
  /** Explorer page for the payout contract, for independent inspection. */
  explorerUrl?: string;
}

function CycleRow({
  cycle,
  explorerUrl,
}: {
  cycle: PilotSettlementCycle;
  explorerUrl?: string;
}) {
  const t = useTranslations("Pilot");
  const { settlement, summary } = cycle;

  return (
    <li className="flex flex-col gap-2 border-b border-white/5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white">
            {formatCycleLabel(cycle.cycleId)}
          </p>
          {settlement?.withheld && (
            <Badge variant="warning" dot>
              {t("history.withheldBadge")}
            </Badge>
          )}
          {settlement && !settlement.withheld && (
            <Badge
              variant={settlement.currency === "eurc" ? "info" : "success"}
              dot
            >
              {t(`history.currency.${settlement.currency}`)}
            </Badge>
          )}
        </div>

        {settlement?.withheld ? (
          <p className="mt-1 text-xs text-amber-300">
            {t("history.withheldRow", {
              amount: formatUsdc(settlement.usdcShare),
            })}
          </p>
        ) : settlement ? (
          <p className="mt-1 text-xs text-neutral-500">
            {t("history.paidAs", {
              amount: formatSettlementAmount(
                settlement.amount,
                settlement.currency,
              ),
            })}
          </p>
        ) : summary ? (
          <p className="mt-1 text-xs text-neutral-500">
            {t("history.noPayout")}
          </p>
        ) : (
          <p className="mt-1 text-xs text-neutral-500">
            {t("history.notDistributed")}
          </p>
        )}

        {explorerUrl && summary && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {t("history.verifyOnChain")}
          </a>
        )}
      </div>

      <p className="shrink-0 text-sm text-neutral-200 sm:text-right">
        {settlement && !settlement.withheld
          ? formatSettlementAmount(settlement.amount, settlement.currency)
          : "-"}
      </p>
    </li>
  );
}

/**
 * What this investor actually received, cycle by cycle.
 *
 * Every row is rendered from the contract's stored settlement record, which is
 * written at distribution time. The view therefore never depends on the RPC
 * still retaining a cycle's events, and it can never show a number that the
 * contract did not actually transfer. For the same reason it does not
 * recompute a share from the investor's current token balance, which may have
 * changed since the cycle ran.
 */
export function PayoutHistory({
  cycles,
  isLoading,
  error,
  lastUpdatedAt,
  connectionStatus,
  onRefresh,
  explorerUrl,
}: PayoutHistoryProps) {
  const t = useTranslations("Pilot");

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">{t("history.title")}</h2>
      <FreshnessIndicator
        lastUpdatedAt={lastUpdatedAt}
        connectionStatus={connectionStatus}
        onRefresh={onRefresh}
      />
    </div>
  );

  if (isLoading && cycles.length === 0) {
    return (
      <Card variant="bordered">
        {header}
        <SkeletonText lines={4} />
      </Card>
    );
  }

  if (error && cycles.length === 0) {
    return (
      <Card variant="bordered">
        {header}
        <SectionErrorFallback onReset={onRefresh} message={error} />
      </Card>
    );
  }

  const distributed = cycles.filter(
    (cycle) => cycle.summary !== undefined || cycle.settlement !== undefined,
  );

  if (distributed.length === 0) {
    return (
      <Card variant="bordered">
        {header}
        <EmptyState
          title={t("history.emptyTitle")}
          description={t("history.emptyDescription")}
          icon={
            <History className="h-5 w-5 text-neutral-500" aria-hidden="true" />
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
          {t("history.staleReading")} {error}
        </p>
      )}

      <ul className="divide-y divide-white/5">
        {distributed.map((cycle) => (
          <CycleRow
            key={cycle.cycleId}
            cycle={cycle}
            explorerUrl={explorerUrl}
          />
        ))}
      </ul>
    </Card>
  );
}
