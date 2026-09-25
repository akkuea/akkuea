"use client";

import { useTranslations } from "next-intl";
import { OctagonAlert, PauseCircle } from "lucide-react";
import type { PilotExitRecord } from "@akkuea/shared";
import { formatUnixDate } from "./format";

interface PilotStateBannerProps {
  /** The terminal exit record, when the pilot has wound down. */
  exitRecord?: PilotExitRecord;
  /** True when the payout contract is paused. */
  isPaused?: boolean;
}

/**
 * The pilot's terminal and paused state, explained rather than implied.
 *
 * Both facts are read from contract storage: an exit is permanent and carries
 * the reason and timestamp its two signers recorded, while a pause is
 * reversible and operational. Showing the exit first, and never hiding a pause
 * behind it, is what lets an investor tell "temporarily paused" from "this
 * pilot is over" without trusting any off-chain bookkeeping.
 */
export function PilotStateBanner({
  exitRecord,
  isPaused = false,
}: PilotStateBannerProps) {
  const t = useTranslations("Pilot");

  if (!exitRecord && !isPaused) {
    return null;
  }

  return (
    <div className="space-y-3">
      {exitRecord && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4"
        >
          <OctagonAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-white">
              {t("state.exitTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-300">
              {t("state.exitReason", { reason: exitRecord.reason })}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t("state.exitAt", { date: formatUnixDate(exitRecord.at) })}
            </p>
          </div>
        </div>
      )}

      {isPaused && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <PauseCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-white">
              {t("state.pausedTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-300">
              {t("state.pausedDescription")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
