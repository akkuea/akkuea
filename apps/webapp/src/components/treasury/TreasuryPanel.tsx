"use client";

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ExternalLink,
  PauseCircle,
  RefreshCw,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  SkeletonCard,
} from "@/components/ui";
import { useTreasury } from "@/hooks/useTreasury";
import type {
  TreasuryHistoryEntry,
  TreasuryPosition,
} from "@/services/api/treasury";
import { cn, truncateAddress } from "@/lib/utils";

/**
 * Render an asset amount that arrived from the API as a decimal string.
 *
 * The string is kept as the source of truth and only trimmed for display —
 * never parsed into a float and re-rendered — so what a reader sees always
 * matches what the ledger holds.
 */
function formatAssetAmount(value: string, maxDecimals = 4): string {
  const [whole, fraction = ""] = value.split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, "");

  return trimmed ? `${groupedWhole}.${trimmed}` : groupedWhole;
}

function isZero(value: string): boolean {
  return /^0(\.0*)?$/.test(value);
}

function VenueCard({
  position,
  t,
}: {
  position: TreasuryPosition;
  t: ReturnType<typeof useTranslations>;
}) {
  const empty = isZero(position.positionValue);

  return (
    <Card variant="bordered" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">
            {position.label}
          </h3>
          <p className="mt-1 text-sm text-zinc-400">{position.strategy}</p>
        </div>
        {position.paused ? (
          <Badge variant="warning">
            <PauseCircle className="h-3 w-3" aria-hidden="true" />
            {t("paused")}
          </Badge>
        ) : (
          <Badge variant="outline">{position.provider}</Badge>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {t("positionValue")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
          {formatAssetAmount(position.positionValue)}{" "}
          <span className="text-base font-normal text-zinc-400">
            {position.assetCode}
          </span>
        </p>
        {empty ? (
          <p className="mt-1 text-sm text-zinc-500">{t("noDepositYet")}</p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">
            {t("sharesHeld", {
              shares: formatAssetAmount(position.shares),
            })}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-sm">
        <div>
          <dt className="text-zinc-500">{t("vaultTotal")}</dt>
          <dd className="tabular-nums text-zinc-300">
            {formatAssetAmount(position.vaultTotalManaged)} {position.assetCode}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("vaultFee")}</dt>
          <dd className="tabular-nums text-zinc-300">
            {(position.fees.vaultBps / 100).toFixed(2)}%
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-4 text-sm">
        <a
          href={position.explorer.vault}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
        >
          {t("viewVault")}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        {position.explorer.account && (
          <a
            href={position.explorer.account}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
          >
            {t("viewAccount")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <p className="text-xs text-zinc-600">
        {t("contractId", { id: truncateAddress(position.vaultContractId, 6) })}
      </p>
    </Card>
  );
}

function HistoryRow({
  entry,
  t,
}: {
  entry: TreasuryHistoryEntry;
  t: ReturnType<typeof useTranslations>;
}) {
  const failed = entry.status === "failed";

  return (
    <tr className="border-b border-zinc-800/60 last:border-0">
      <td className="py-2 pr-4 text-zinc-400">
        {new Date(entry.createdAt).toLocaleDateString()}
      </td>
      <td className="py-2 pr-4 text-zinc-300">
        {t(`operation.${entry.operation}`)}
      </td>
      <td className="py-2 pr-4 tabular-nums text-zinc-300">
        {entry.amount ? formatAssetAmount(entry.amount) : "—"} {entry.assetCode}
      </td>
      <td className="py-2 pr-4">
        <span
          className={cn(
            "text-xs",
            failed ? "text-red-400" : "text-emerald-400",
          )}
        >
          {failed
            ? (entry.errorName ?? t("status.failed"))
            : t("status.submitted")}
        </span>
      </td>
      <td className="py-2">
        {entry.explorerUrl ? (
          <a
            href={entry.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
          >
            {t("viewTx")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Treasury panel for the Phase 1a treasury track.
 *
 * Every figure shown is read from the vault contracts by the API at request
 * time and passed through as a decimal string. There are no placeholder
 * numbers here: an empty position renders as an empty position, and a venue
 * that could not be read says so rather than being quietly dropped.
 */
export function TreasuryPanel() {
  const t = useTranslations("Treasury");
  const { portfolio, history, isLoading, error, refetch } = useTreasury();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <Card variant="bordered" className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <p className="text-sm">{t("readFailed")}</p>
        </div>
        <p className="text-sm text-zinc-500">{error}</p>
        <Button variant="secondary" onClick={refetch}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("retry")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card variant="gradient">
        <CardHeader className="p-0">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("whatThisIs")}</CardDescription>
        </CardHeader>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          {t("whyItExists")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {t("howToVerify")}
        </p>
      </Card>

      {portfolio.positions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {portfolio.positions.map((position) => (
            <VenueCard key={position.venue} position={position} t={t} />
          ))}
        </div>
      ) : (
        <Card variant="bordered">
          <p className="text-sm text-zinc-400">{t("noVenuesConfigured")}</p>
        </Card>
      )}

      {portfolio.unavailable.length > 0 && (
        <Card variant="bordered" className="space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <p className="text-sm font-medium">{t("venuesUnavailable")}</p>
          </div>
          <ul className="space-y-1 text-sm text-zinc-500">
            {portfolio.unavailable.map((entry) => (
              <li key={entry.venue}>
                <span className="text-zinc-400">{entry.venue}</span>:{" "}
                {entry.reason}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {history && history.transactions.length > 0 && (
        <Card variant="bordered">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
            <CardDescription>{t("historyNote")}</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4 font-medium">{t("column.date")}</th>
                  <th className="py-2 pr-4 font-medium">
                    {t("column.action")}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {t("column.amount")}
                  </th>
                  <th className="py-2 pr-4 font-medium">
                    {t("column.result")}
                  </th>
                  <th className="py-2 font-medium">{t("column.record")}</th>
                </tr>
              </thead>
              <tbody>
                {history.transactions.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-zinc-600">
        {t("readAtNote", {
          network: portfolio.network,
          account: portfolio.sourceAccount
            ? truncateAddress(portfolio.sourceAccount, 6)
            : t("noAccountConfigured"),
        })}
      </p>
    </div>
  );
}
