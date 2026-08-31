"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardCheck, ExternalLink, Hash, Wallet } from "lucide-react";
import type { PilotEvidenceStatus } from "@real-estate-defi/shared";
import {
  Button,
  Card,
  EmptyState,
  FreshnessIndicator,
  Input,
  SectionErrorFallback,
  SkeletonText,
} from "@/components/ui";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import { useWallet } from "@/components/auth/hooks";
import type { PilotEvidenceDetail } from "@/services/pilot/reads";
import {
  reviewEvidence,
  startReview,
  type SignXdr,
} from "@/services/pilot/writes";
import { EvidenceStatusBadge } from "./EvidenceSubmissionForm";
import { formatCycleLabel, formatUsdc, shortenHash } from "./format";

/** Statuses the operator still has something to do about. */
const ACTIONABLE: PilotEvidenceStatus[] = [
  "submitted",
  "under_review",
  "approved",
];

/** Wallet capabilities the queue needs, so the view can be exercised directly. */
export interface OperatorWallet {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void> | void;
  signTransaction: SignXdr;
}

interface EvidenceReviewQueueProps {
  cycles: PilotEvidenceDetail[];
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  isPaused?: boolean;
  onRefresh: () => void;
}

interface QueueItemProps {
  cycle: PilotEvidenceDetail;
  isPaused: boolean;
  onDone: () => void;
  wallet: OperatorWallet;
}

function QueueItem({ cycle, isPaused, onDone, wallet }: QueueItemProps) {
  const t = useTranslations("Pilot");
  const { address, signTransaction } = wallet;
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"open" | "approve" | "reject" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const status = cycle.evidence?.status;
  const canReview = status === "submitted" || status === "under_review";
  const canDistribute = status === "approved" && !cycle.distribution;

  async function run(
    action: "open" | "approve" | "reject",
    operation: () => Promise<unknown>,
  ) {
    if (!address) {
      setError(t("queue.connectFirst"));
      return;
    }
    setPending(action);
    setError(null);
    try {
      await operation();
      setReason("");
      onDone();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : t("queue.actionFailed"),
      );
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;
  const blocked = busy || isPaused || !address;

  return (
    <li className="border-b border-white/5 py-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">
              {formatCycleLabel(cycle.cycleId)}
            </p>
            {status && <EvidenceStatusBadge status={status} />}
          </div>
          {cycle.totalIncome !== undefined && (
            <p className="mt-1 text-xs text-neutral-400">
              {t("queue.reported", { amount: formatUsdc(cycle.totalIncome) })}
            </p>
          )}
          {cycle.evidenceHashHex && (
            <p className="mt-1 flex items-center gap-1.5 break-all text-xs text-neutral-500">
              <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {shortenHash(cycle.evidenceHashHex)}
            </p>
          )}
          {cycle.evidenceLink && (
            <a
              href={cycle.evidenceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t("queue.openStatement")}
            </a>
          )}
        </div>
      </div>

      {canReview && (
        <div className="mt-4 space-y-3">
          <Input
            label={t("queue.reasonLabel")}
            placeholder={t("queue.reasonPlaceholder")}
            value={reason}
            disabled={blocked}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {status === "submitted" && (
              <Button
                variant="secondary"
                size="sm"
                disabled={blocked}
                isLoading={pending === "open"}
                onClick={() =>
                  void run("open", () =>
                    startReview(
                      address as string,
                      cycle.cycleId,
                      signTransaction,
                    ),
                  )
                }
              >
                {t("queue.startReview")}
              </Button>
            )}
            <Button
              size="sm"
              disabled={blocked}
              isLoading={pending === "approve"}
              onClick={() =>
                void run("approve", () =>
                  reviewEvidence(
                    {
                      operator: address as string,
                      cycleId: cycle.cycleId,
                      approved: true,
                      reason: reason.trim(),
                    },
                    signTransaction,
                  ),
                )
              }
            >
              {t("queue.approve")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={blocked || reason.trim().length === 0}
              isLoading={pending === "reject"}
              onClick={() =>
                void run("reject", () =>
                  reviewEvidence(
                    {
                      operator: address as string,
                      cycleId: cycle.cycleId,
                      approved: false,
                      reason: reason.trim(),
                    },
                    signTransaction,
                  ),
                )
              }
            >
              {t("queue.reject")}
            </Button>
          </div>
          <p className="text-xs text-neutral-500">{t("queue.reasonHint")}</p>
        </div>
      )}

      {canDistribute && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <p className="text-xs text-neutral-300">
            {t("queue.readyToDistribute")}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {t("queue.distributeCosignNotice")}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Operator review queue.
 *
 * The queue is not a table of pending rows kept somewhere: it is every cycle
 * whose on-chain evidence record is still waiting on a human decision.
 */
export function EvidenceReviewQueue(props: EvidenceReviewQueueProps) {
  const { address, isConnected, connect, signTransaction } = useWallet();

  return (
    <EvidenceReviewQueueView
      {...props}
      wallet={{ address, isConnected, connect, signTransaction }}
    />
  );
}

/**
 * The queue itself, with the wallet passed in.
 *
 * Separating this from the hook keeps the connected and disconnected states
 * reachable in tests and stories without mocking the wallet module out from
 * under the rest of the suite.
 */
export function EvidenceReviewQueueView({
  cycles,
  isLoading,
  error,
  lastUpdatedAt,
  connectionStatus,
  isPaused = false,
  onRefresh,
  wallet,
}: EvidenceReviewQueueProps & { wallet: OperatorWallet }) {
  const t = useTranslations("Pilot");
  const { isConnected, connect } = wallet;

  const queue = cycles.filter(
    (cycle) =>
      cycle.evidence !== undefined &&
      ACTIONABLE.includes(cycle.evidence.status) &&
      !cycle.distribution,
  );

  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-white">{t("queue.title")}</h2>
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

  return (
    <Card variant="bordered">
      {header}

      {!isConnected && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            {t("queue.connectNotice")}
          </p>
          <Button size="sm" variant="secondary" onClick={() => void connect()}>
            {t("queue.connect")}
          </Button>
        </div>
      )}

      {isPaused && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        >
          {t("queue.pausedNotice")}
        </p>
      )}

      {queue.length === 0 ? (
        <EmptyState
          title={t("queue.emptyTitle")}
          description={t("queue.emptyDescription")}
          icon={
            <ClipboardCheck
              className="h-5 w-5 text-neutral-500"
              aria-hidden="true"
            />
          }
        />
      ) : (
        <ul className="divide-y divide-white/5">
          {queue.map((cycle) => (
            <QueueItem
              key={cycle.cycleId}
              cycle={cycle}
              isPaused={isPaused}
              onDone={onRefresh}
              wallet={wallet}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
