"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import {
  prepareExecuteDistribution,
  summarizeExecuteDistribution,
  finalizeAndSubmitExecuteDistribution,
  CosignError,
  type ExecuteDistributionSummary,
} from "@/services/pilot/cosign";
import type { SignXdr } from "@/services/pilot/writes";
import { formatUsdc } from "./format";

const RATE_DENOMINATOR = BigInt(10_000_000);

/** Renders `min_eurc_per_usdc` (a rate scaled by `RATE_DENOMINATOR`) as a
 * human price, or a plain "not required" note when it is zero, matching the
 * contract's own "zero is valid only when nobody wants EURC" semantics. */
function formatEurcFloor(minEurcPerUsdc: bigint, noEurcLabel: string): string {
  if (minEurcPerUsdc === BigInt(0)) return noEurcLabel;
  const whole = minEurcPerUsdc / RATE_DENOMINATOR;
  const frac = minEurcPerUsdc % RATE_DENOMINATOR;
  return `${whole}.${frac.toString().padStart(7, "0")} EURC / USDC`;
}

interface DistributionCosignPanelProps {
  operatorAddress: string;
  allyAddress: string;
  cycleId: string;
  totalDistributableUsdc: bigint;
  signTransaction: SignXdr;
  onDistributed: () => void;
}

type Step =
  | { name: "idle" }
  | { name: "preparing" }
  | { name: "prepared"; payloadJson: string; summary: ExecuteDistributionSummary }
  | { name: "finalizing"; payloadJson: string }
  | { name: "done"; hash: string };

/**
 * The operator's half of the two-party distribution flow: prepare an
 * `execute_distribution` invocation, share it with the ally out of band (a
 * link, a message, a QR code - this component only produces the payload
 * string), then paste the ally's co-signed response back in to finalize and
 * submit.
 *
 * See docs/strategy/decision-log.md, "Two-party signing payload transport",
 * for why this is a payload to copy rather than something submitted to a
 * server: no relay is involved anywhere in this flow.
 */
export function DistributionCosignPanel({
  operatorAddress,
  allyAddress,
  cycleId,
  totalDistributableUsdc,
  signTransaction,
  onDistributed,
}: DistributionCosignPanelProps) {
  const t = useTranslations("Pilot");
  const [step, setStep] = useState<Step>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [returnedPayload, setReturnedPayload] = useState("");

  async function prepare() {
    setError(null);
    setStep({ name: "preparing" });
    try {
      const { payloadJson } = await prepareExecuteDistribution({
        operator: operatorAddress,
        ally: allyAddress,
        cycleId,
        totalDistributableUsdc,
      });
      const summary = summarizeExecuteDistribution(payloadJson);
      setStep({ name: "prepared", payloadJson, summary });
    } catch (prepareError) {
      setStep({ name: "idle" });
      setError(describeError(prepareError, t("queue.actionFailed")));
    }
  }

  async function finalize(payloadJson: string) {
    setError(null);
    setStep({ name: "finalizing", payloadJson });
    try {
      const { hash } = await finalizeAndSubmitExecuteDistribution({
        payloadJson,
        operatorAddress,
        signTransaction,
      });
      setStep({ name: "done", hash });
      onDistributed();
    } catch (finalizeError) {
      setStep({ name: "prepared", payloadJson, summary: summarizeExecuteDistribution(payloadJson) });
      setError(describeError(finalizeError, t("queue.actionFailed")));
    }
  }

  function copyPayload(payloadJson: string) {
    void navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step.name === "idle" || step.name === "preparing") {
    return (
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
        <p className="text-xs text-neutral-300">{t("queue.readyToDistribute")}</p>
        <p className="mt-1 text-xs text-neutral-500">{t("cosign.prepareHint")}</p>
        <Button
          size="sm"
          className="mt-3"
          isLoading={step.name === "preparing"}
          onClick={() => void prepare()}
        >
          {t("cosign.prepareButton")}
        </Button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (step.name === "done") {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
        <p className="text-xs text-emerald-300">
          {t("cosign.distributed", { hash: step.hash.slice(0, 12) })}
        </p>
      </div>
    );
  }

  const summary =
    step.name === "prepared" ? step.summary : summarizeExecuteDistribution(step.payloadJson);
  const payloadJson = step.payloadJson;

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-xs font-medium text-white">{t("cosign.summaryTitle")}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-neutral-500">{t("cosign.summaryCycle")}</dt>
        <dd className="text-neutral-200">{summary.cycleId}</dd>
        <dt className="text-neutral-500">{t("cosign.summaryOperator")}</dt>
        <dd className="truncate text-neutral-200">{summary.operator}</dd>
        <dt className="text-neutral-500">{t("cosign.summaryAlly")}</dt>
        <dd className="truncate text-neutral-200">{summary.ally}</dd>
        <dt className="text-neutral-500">{t("cosign.summaryTotal")}</dt>
        <dd className="text-neutral-200">{formatUsdc(totalDistributableUsdc)}</dd>
        <dt className="text-neutral-500">{t("cosign.summaryEurcFloor")}</dt>
        <dd className="text-neutral-200">{formatEurcFloor(summary.minEurcPerUsdc, t("cosign.noEurcHolders"))}</dd>
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
  );
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof CosignError) {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}
