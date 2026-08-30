"use client";

import { useTranslations } from "next-intl";
import { Coins, ShieldCheck, ShieldAlert, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FreshnessIndicator,
  SectionErrorFallback,
  SkeletonText,
} from "@/components/ui";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import { useWallet } from "@/components/auth/hooks";
import type { PilotHoldings } from "@/services/pilot/reads";
import { formatBaseUnits, formatUsdc } from "./format";

interface InvestorHoldingsCardProps {
  holdings: PilotHoldings | null;
  /** Total distributed to all holders to date, in USDC stroops. */
  totalDistributed: bigint;
  isLoading: boolean;
  error: string | null;
  isDisconnected: boolean;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  onRefresh: () => void;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/**
 * The connected investor's position in the pilot.
 *
 * Share of supply is what determines their cut of every distribution, so it is
 * shown next to the balance rather than left for the investor to work out.
 */
export function InvestorHoldingsCard({
  holdings,
  totalDistributed,
  isLoading,
  error,
  isDisconnected,
  lastUpdatedAt,
  connectionStatus,
  onRefresh,
}: InvestorHoldingsCardProps) {
  const t = useTranslations("Pilot");
  const { connect } = useWallet();

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">
        {t("holdings.title")}
      </h2>
      {!isDisconnected && (
        <FreshnessIndicator
          lastUpdatedAt={lastUpdatedAt}
          connectionStatus={connectionStatus}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );

  if (isDisconnected) {
    return (
      <Card variant="bordered">
        {header}
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Wallet className="h-6 w-6 text-neutral-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-white">
              {t("holdings.connectTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t("holdings.connectDescription")}
            </p>
          </div>
          <Button onClick={() => void connect()}>
            {t("holdings.connect")}
          </Button>
        </div>
      </Card>
    );
  }

  if (isLoading && !holdings) {
    return (
      <Card variant="bordered">
        {header}
        <SkeletonText lines={3} />
      </Card>
    );
  }

  if (error && !holdings) {
    return (
      <Card variant="bordered">
        {header}
        <SectionErrorFallback onReset={onRefresh} message={error} />
      </Card>
    );
  }

  if (!holdings || holdings.balance === BigInt(0)) {
    return (
      <Card variant="bordered">
        {header}
        <EmptyState
          title={t("holdings.emptyTitle")}
          description={t("holdings.emptyDescription")}
          icon={
            <Coins className="h-5 w-5 text-neutral-500" aria-hidden="true" />
          }
        />
      </Card>
    );
  }

  const sharePercent =
    holdings.totalSupply > BigInt(0)
      ? Number((holdings.balance * BigInt(10_000)) / holdings.totalSupply) / 100
      : 0;

  // The investor's cut of everything paid out so far, using the same truncating
  // split the contract applies per holder.
  const yourDistributions =
    holdings.totalSupply > BigInt(0)
      ? (totalDistributed * holdings.balance) / holdings.totalSupply
      : BigInt(0);

  return (
    <Card variant="bordered">
      {header}

      {error && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        >
          {t("holdings.staleReading")} {error}
        </p>
      )}

      <div className="mb-4">
        <Badge variant={holdings.whitelisted ? "success" : "danger"} dot>
          <span className="inline-flex items-center gap-1.5">
            {holdings.whitelisted ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {holdings.whitelisted
              ? t("holdings.whitelisted")
              : t("holdings.notWhitelisted")}
          </span>
        </Badge>
        {!holdings.whitelisted && (
          <p className="mt-2 text-xs text-neutral-500">
            {t("holdings.notWhitelistedHint")}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label={t("holdings.tokensHeld")}
          value={`${formatBaseUnits(holdings.balance, holdings.decimals)} ${holdings.symbol}`}
        />
        <Stat
          label={t("holdings.shareOfSupply")}
          value={`${sharePercent.toFixed(2)}%`}
          hint={t("holdings.shareHint", {
            supply: formatBaseUnits(holdings.totalSupply, holdings.decimals),
          })}
        />
        <Stat
          label={t("holdings.distributedToYou")}
          value={formatUsdc(yourDistributions)}
          hint={t("holdings.distributedHint")}
        />
      </div>
    </Card>
  );
}
