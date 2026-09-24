"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Copy, Check } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";
import {
  prepareExit,
  summarizeExit,
  finalizeAndSubmitExit,
  CosignError,
  type ExitSummary,
} from "@/services/pilot/cosign";
import type { SignXdr } from "@/services/pilot/writes";

interface ExitCosignPanelProps {
  operatorAddress: string;
  allyAddress: string;
  signTransaction: SignXdr;
  onExited?: () => void;
}

type Step =
  | { name: "compose" }
  | { name: "confirming" }
  | { name: "preparing" }
  | { name: "prepared"; payloadJson: string; summary: ExitSummary }
  | { name: "finalizing"; payloadJson: string }
  | { name: "done"; hash: string };

/**
 * The operator's half of the dual-signed `exit` flow. Permanently terminates
 * the ally/property relationship (see `cosign.ts`'s doc comment on
 * `prepareExit`), so this is the one panel in the pilot dashboard that
 * requires an explicit "yes, permanently" confirmation before it will even
 * build the transaction, on top of both parties still having to sign it.
 */
export function ExitCosignPanel({
  operatorAddress,
  allyAddress,
  signTransaction,
  onExited,
}: ExitCosignPanelProps) {
  const t = useTranslations("Pilot");
  const [step, setStep] = useState<Step>({ name: "compose" });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [returnedPayload, setReturnedPayload] = useState("");

  async function prepare() {
    if (reason.trim().length === 0) return;
    setError(null);
    setStep({ name: "preparing" });
    try {
      const { payloadJson } = await prepareExit({
        operator: operatorAddress,
        ally: allyAddress,
        reason: reason.trim(),
      });
      const summary = summarizeExit(payloadJson);
      setStep({ name: "prepared", payloadJson, summary });
    } catch (prepareError) {
      setStep({ name: "compose" });
      setError(describeError(prepareError, t));
    }
  }

  async function finalize(payloadJson: string) {
    setError(null);
    setStep({ name: "finalizing", payloadJson });
    try {
      const { hash } = await finalizeAndSubmitExit({
        payloadJson,
        operatorAddress,
        signTransaction,
      });
      setStep({ name: "done", hash });
      onExited?.();
    } catch (finalizeError) {
      setStep({ name: "prepared", payloadJson, summary: summarizeExit(payloadJson) });
      setError(describeError(finalizeError, t));
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
        <p className="text-xs text-red-300">
          {t("cosign.exitDone", { hash: step.hash.slice(0, 12) })}
        </p>
      </Card>
    );
  }

  if (
    step.name === "compose" ||
    step.name === "confirming" ||
    step.name === "preparing"
  ) {
    return (
      <Card variant="bordered">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">{t("cosign.exitTitle")}</h2>
        </div>
        <p className="mb-4 text-xs text-neutral-400">{t("cosign.exitHint")}</p>

        <Textarea
          label={t("cosign.exitReasonLabel")}
          rows={3}
          value={reason}
          disabled={step.name === "preparing"}
          placeholder={t("cosign.exitReasonPlaceholder")}
          onChange={(event) => {
            setReason(event.target.value);
            setStep({ name: "compose" });
          }}
        />

        {step.name !== "confirming" ? (
          <Button
            size="sm"
            variant="danger"
            className="mt-3"
            disabled={reason.trim().length === 0}
            onClick={() => setStep({ name: "confirming" })}
          >
            {t("cosign.exitButton")}
          </Button>
        ) : (
          <div className="mt-3 space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3">
            <p className="text-xs text-red-300">{t("cosign.exitConfirmNotice")}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                isLoading={step.name === "preparing"}
                onClick={() => void prepare()}
              >
                {t("cosign.exitConfirmButton")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setStep({ name: "compose" })}
              >
                {t("cosign.exitCancelButton")}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </Card>
    );
  }

  const summary =
    step.name === "prepared" ? step.summary : summarizeExit(step.payloadJson);
  const payloadJson = step.payloadJson;

  return (
    <Card variant="bordered">
      <div className="space-y-3">
        <p className="text-xs font-medium text-white">{t("cosign.summaryTitle")}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-neutral-500">{t("cosign.summaryOperator")}</dt>
          <dd className="truncate text-neutral-200">{summary.operator}</dd>
          <dt className="text-neutral-500">{t("cosign.summaryAlly")}</dt>
          <dd className="truncate text-neutral-200">{summary.ally}</dd>
          <dt className="text-neutral-500">{t("cosign.exitReasonLabel")}</dt>
          <dd className="text-neutral-200">{summary.reason}</dd>
        </dl>

        {summary.readyToFinalize ? (
          <Button
            size="sm"
            variant="danger"
            isLoading={step.name === "finalizing"}
            onClick={() => void finalize(payloadJson)}
          >
            {t("cosign.exitConfirmButton")}
          </Button>
        ) : (
          <>
            <p className="text-xs text-neutral-400">
              {t("cosign.needsSignatureFrom", {
                addresses: summary.stillNeedsSignatureFrom.join(", "),
              })}
            </p>
            <div>
              <p className="mb-1 text-xs text-neutral-500">{t("cosign.shareLabel")}</p>
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
              <p className="mb-1 text-xs text-neutral-500">{t("cosign.pasteAllyResponseLabel")}</p>
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

function describeError(error: unknown, t: (key: string) => string): string {
  if (error instanceof CosignError) return error.message;
  return error instanceof Error ? error.message : t("queue.actionFailed");
}
