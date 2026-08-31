"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  FileText,
  Hash,
  Link2,
  Loader2,
  Wallet,
} from "lucide-react";
import type { PilotEvidenceStatus } from "@real-estate-defi/shared";
import { Badge, Button, Card, Input } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import {
  hashEvidenceFile,
  type EvidenceDigest,
} from "@/services/pilot/evidenceHash";
import { submitEvidence, type SignXdr } from "@/services/pilot/writes";
import { formatCycleLabel, shortenHash } from "./format";

const EVIDENCE_STATUS_VARIANTS: Record<
  PilotEvidenceStatus,
  "default" | "info" | "success" | "danger" | "warning"
> = {
  submitted: "info",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  disputed: "danger",
};

export function EvidenceStatusBadge({
  status,
}: {
  status: PilotEvidenceStatus;
}) {
  const t = useTranslations("Pilot");

  return (
    <Badge variant={EVIDENCE_STATUS_VARIANTS[status]} dot>
      {t(`evidenceStatus.${status}`)}
    </Badge>
  );
}

/** Wallet capabilities the form needs, so the view can be exercised directly. */
export interface EvidenceSubmissionWallet {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void> | void;
  signTransaction: SignXdr;
}

interface EvidenceSubmissionFormProps {
  /** Cycle being reported, as `YYYY-MM`. */
  cycleId: string;
  /** Status already on-chain for this cycle, when there is one. */
  currentStatus?: PilotEvidenceStatus;
  /** Operator's reason, shown so a rejected ally knows what to fix. */
  reviewReason?: string;
  /** True when the payout contract is paused, which blocks every submission. */
  isPaused?: boolean;
  /** Called after a successful submission so the parent can re-read the chain. */
  onSubmitted?: () => void;
}

/**
 * Ally-facing evidence submission.
 *
 * The statement file never leaves the browser. It is hashed locally and only
 * the digest, plus a link the ally controls, is written on-chain. A cycle that
 * was rejected can be corrected and submitted again; one already approved
 * cannot, and the form says so rather than letting the signature fail.
 */
export function EvidenceSubmissionForm(props: EvidenceSubmissionFormProps) {
  const { address, isConnected, connect, signTransaction } = useWallet();

  return (
    <EvidenceSubmissionFormView
      {...props}
      wallet={{ address, isConnected, connect, signTransaction }}
    />
  );
}

/**
 * The form itself, with the wallet passed in.
 *
 * Separating this from the hook keeps the connected states reachable in tests
 * and stories without mocking a module out from under the rest of the suite.
 */
export function EvidenceSubmissionFormView({
  cycleId,
  currentStatus,
  reviewReason,
  isPaused = false,
  onSubmitted,
  wallet,
}: EvidenceSubmissionFormProps & { wallet: EvidenceSubmissionWallet }) {
  const t = useTranslations("Pilot");
  const { address, isConnected, connect, signTransaction } = wallet;

  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<EvidenceDigest | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [totalIncome, setTotalIncome] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const isLocked = currentStatus !== undefined && currentStatus !== "rejected";

  const parsedIncome = useMemo(() => {
    const value = Number.parseFloat(totalIncome);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    // USDC carries 7 decimals on Stellar; round rather than truncate so a
    // cent entered by the ally is not silently dropped.
    return BigInt(Math.round(value * 10 ** 7));
  }, [totalIncome]);

  const canSubmit =
    isConnected &&
    !isLocked &&
    !isPaused &&
    !isSubmitting &&
    !isHashing &&
    digest !== null &&
    evidenceLink.trim().length > 0 &&
    parsedIncome !== null;

  async function handleFileChange(selected: File | null) {
    setFile(selected);
    setDigest(null);
    setError(null);
    if (!selected) {
      return;
    }

    setIsHashing(true);
    try {
      setDigest(await hashEvidenceFile(selected));
    } catch (hashError) {
      setError(
        hashError instanceof Error
          ? hashError.message
          : t("submission.hashUnavailable"),
      );
    } finally {
      setIsHashing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !address || !digest || parsedIncome === null) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitEvidence(
        {
          ally: address,
          cycleId,
          evidenceHash: digest.bytes,
          evidenceLink: evidenceLink.trim(),
          totalIncome: parsedIncome,
        },
        signTransaction,
      );
      setTxHash(result.hash);
      onSubmitted?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("submission.submitFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <Card variant="bordered">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Wallet className="h-6 w-6 text-neutral-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-white">
              {t("submission.connectTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t("submission.connectDescription")}
            </p>
          </div>
          <Button onClick={() => void connect()}>
            {t("submission.connect")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {t("submission.title", { cycle: formatCycleLabel(cycleId) })}
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            {t("submission.subtitle")}
          </p>
        </div>
        {currentStatus && <EvidenceStatusBadge status={currentStatus} />}
      </div>

      {reviewReason && currentStatus === "rejected" && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {t("submission.rejectedPrefix", { reason: reviewReason })}
        </p>
      )}

      {isPaused && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        >
          {t("submission.pausedNotice")}
        </p>
      )}

      {isLocked && !isPaused && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-400"
        >
          {t("submission.lockedNotice")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="evidence-file"
            className="mb-2 block text-sm font-medium text-neutral-300"
          >
            {t("submission.fileLabel")}
          </label>
          <input
            id="evidence-file"
            type="file"
            disabled={isLocked || isPaused || isSubmitting}
            onChange={(event) =>
              void handleFileChange(event.target.files?.[0] ?? null)
            }
            className="block w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white disabled:cursor-not-allowed disabled:opacity-50"
          />
          {file && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {file.name}
            </p>
          )}
          {isHashing && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              {t("submission.hashing")}
            </p>
          )}
          {digest && (
            <p className="mt-2 flex items-center gap-1.5 break-all text-xs text-emerald-400">
              <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {shortenHash(digest.hex)}
            </p>
          )}
        </div>

        <Input
          label={t("submission.linkLabel")}
          placeholder="https://"
          value={evidenceLink}
          disabled={isLocked || isPaused || isSubmitting}
          leftIcon={<Link2 className="h-4 w-4" aria-hidden="true" />}
          hint={t("submission.linkHint")}
          onChange={(event) => setEvidenceLink(event.target.value)}
        />

        <Input
          label={t("submission.amountLabel")}
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={totalIncome}
          disabled={isLocked || isPaused || isSubmitting}
          onChange={(event) => setTotalIncome(event.target.value)}
        />

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}

        {txHash && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("submission.submitted")}
          </p>
        )}

        <Button type="submit" disabled={!canSubmit} isLoading={isSubmitting}>
          {t("submission.submit")}
        </Button>
      </form>
    </Card>
  );
}
