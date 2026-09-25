"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, FileText, Hash, Loader2 } from "lucide-react";
import { Button, Card, Input, Textarea } from "@/components/ui";
import {
  hashEvidenceFile,
  type EvidenceDigest,
} from "@/services/pilot/evidenceHash";
import {
  prepareRecordEvidence,
  summarizeRecordEvidence,
  finalizeAndSubmitRecordEvidence,
  CosignError,
  type RecordEvidenceSummary,
} from "@/services/pilot/cosign";
import type { SignXdr } from "@/services/pilot/writes";
import { shortenHash } from "./format";

interface RecordEvidenceCosignPanelProps {
  operatorAddress: string;
  allyAddress: string;
  signTransaction: SignXdr;
  onRecorded?: () => void;
}

type Step =
  | { name: "compose" }
  | { name: "preparing" }
  | { name: "prepared"; payloadJson: string; summary: RecordEvidenceSummary }
  | { name: "finalizing"; payloadJson: string }
  | { name: "done"; hash: string };

/**
 * The operator's half of the dual-signed `record_evidence` shortcut: both
 * parties jointly commit an already-approved cycle's evidence in a single
 * co-signed transaction, instead of the ally submitting and the operator
 * reviewing as two separate steps. See `cosign.ts`'s doc comment on
 * `prepareRecordEvidence` for how this differs from that review lifecycle.
 */
export function RecordEvidenceCosignPanel({
  operatorAddress,
  allyAddress,
  signTransaction,
  onRecorded,
}: RecordEvidenceCosignPanelProps) {
  const t = useTranslations("Pilot");
  const [step, setStep] = useState<Step>({ name: "compose" });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [returnedPayload, setReturnedPayload] = useState("");

  const [cycleId, setCycleId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [digest, setDigest] = useState<EvidenceDigest | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [evidenceLink, setEvidenceLink] = useState("");
  const [totalIncome, setTotalIncome] = useState("");

  const parsedIncome = useMemo(() => {
    const value = Number.parseFloat(totalIncome);
    if (!Number.isFinite(value) || value <= 0) return null;
    return BigInt(Math.round(value * 10 ** 7));
  }, [totalIncome]);

  const canPrepare =
    cycleId.trim().length > 0 &&
    digest !== null &&
    !isHashing &&
    evidenceLink.trim().length > 0 &&
    parsedIncome !== null;

  async function handleFileChange(selected: File | null) {
    setFile(selected);
    setDigest(null);
    setError(null);
    if (!selected) return;
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

  async function prepare() {
    if (!canPrepare || !digest || parsedIncome === null) return;
    setError(null);
    setStep({ name: "preparing" });
    try {
      const { payloadJson } = await prepareRecordEvidence({
        operator: operatorAddress,
        ally: allyAddress,
        cycleId: cycleId.trim(),
        evidenceHash: digest.bytes,
        evidenceLink: evidenceLink.trim(),
        totalIncome: parsedIncome,
      });
      const summary = summarizeRecordEvidence(payloadJson);
      setStep({ name: "prepared", payloadJson, summary });
    } catch (prepareError) {
      setStep({ name: "compose" });
      setError(describeError(prepareError, t("queue.actionFailed")));
    }
  }

  async function finalize(payloadJson: string) {
    setError(null);
    setStep({ name: "finalizing", payloadJson });
    try {
      const { hash } = await finalizeAndSubmitRecordEvidence({
        payloadJson,
        operatorAddress,
        signTransaction,
      });
      setStep({ name: "done", hash });
      onRecorded?.();
    } catch (finalizeError) {
      setStep({
        name: "prepared",
        payloadJson,
        summary: summarizeRecordEvidence(payloadJson),
      });
      setError(describeError(finalizeError, t("queue.actionFailed")));
    }
  }

  function copyPayload(payloadJson: string) {
    void navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step.name === "done") {
    return (
      <Card variant="bordered">
        <p className="text-xs text-emerald-300">
          {t("cosign.recordEvidenceDistributed", {
            hash: step.hash.slice(0, 12),
          })}
        </p>
      </Card>
    );
  }

  if (step.name === "compose" || step.name === "preparing") {
    return (
      <Card variant="bordered">
        <h2 className="mb-1 text-sm font-semibold text-white">
          {t("cosign.recordEvidenceTitle")}
        </h2>
        <p className="mb-4 text-xs text-neutral-400">
          {t("cosign.recordEvidenceHint")}
        </p>
        <div className="space-y-4">
          <Input
            label={t("cosign.cycleIdLabel")}
            placeholder="2026-09"
            value={cycleId}
            disabled={step.name === "preparing"}
            onChange={(event) => setCycleId(event.target.value)}
          />

          <div>
            <label
              htmlFor="record-evidence-file"
              className="mb-2 block text-sm font-medium text-neutral-300"
            >
              {t("submission.fileLabel")}
            </label>
            <input
              id="record-evidence-file"
              type="file"
              disabled={step.name === "preparing"}
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
            disabled={step.name === "preparing"}
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
            disabled={step.name === "preparing"}
            onChange={(event) => setTotalIncome(event.target.value)}
          />

          <Button
            size="sm"
            isLoading={step.name === "preparing"}
            disabled={!canPrepare}
            onClick={() => void prepare()}
          >
            {t("cosign.prepareButton")}
          </Button>

          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
      </Card>
    );
  }

  const summary =
    step.name === "prepared"
      ? step.summary
      : summarizeRecordEvidence(step.payloadJson);
  const payloadJson = step.payloadJson;

  return (
    <Card variant="bordered">
      <div className="space-y-3">
        <p className="text-xs font-medium text-white">
          {t("cosign.summaryTitle")}
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-neutral-500">{t("cosign.summaryContract")}</dt>
          <dd className="truncate text-neutral-200">
            {shortenHash(summary.contractId)}
          </dd>
          <dt className="text-neutral-500">{t("cosign.summaryCycle")}</dt>
          <dd className="text-neutral-200">{summary.cycleId}</dd>
          <dt className="text-neutral-500">{t("cosign.summaryOperator")}</dt>
          <dd className="truncate text-neutral-200">{summary.operator}</dd>
          <dt className="text-neutral-500">{t("cosign.summaryAlly")}</dt>
          <dd className="truncate text-neutral-200">{summary.ally}</dd>
          <dt className="text-neutral-500">
            {t("cosign.summaryEvidenceHash")}
          </dt>
          <dd className="text-neutral-200">
            {shortenHash(summary.evidenceHash)}
          </dd>
        </dl>

        {summary.readyToFinalize ? (
          <Button
            size="sm"
            isLoading={step.name === "finalizing"}
            onClick={() => void finalize(payloadJson)}
          >
            {t("cosign.finalizeButton")}
          </Button>
        ) : (
          <>
            <p className="text-xs text-neutral-400">
              {t("cosign.needsSignatureFrom", {
                addresses: summary.stillNeedsSignatureFrom.join(", "),
              })}
            </p>
            <div>
              <p className="mb-1 text-xs text-neutral-500">
                {t("cosign.shareLabel")}
              </p>
              <Textarea
                readOnly
                rows={3}
                value={payloadJson}
                className="text-[10px]"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => copyPayload(payloadJson)}
              >
                {copied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied ? t("cosign.copied") : t("cosign.copyButton")}
              </Button>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-500">
                {t("cosign.pasteAllyResponseLabel")}
              </p>
              <Textarea
                rows={3}
                value={returnedPayload}
                placeholder={t("cosign.pasteAllyResponsePlaceholder")}
                className="text-[10px]"
                onChange={(event) => setReturnedPayload(event.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                disabled={returnedPayload.trim().length === 0}
                onClick={() => void finalize(returnedPayload.trim())}
              >
                {t("cosign.checkResponseButton")}
              </Button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof CosignError) return error.message;
  return error instanceof Error ? error.message : fallback;
}
