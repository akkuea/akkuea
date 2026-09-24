"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, ShieldCheck } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import {
  summarizeCosignPayload,
  coSignPayloadAsAlly,
  CosignError,
  type AnyCosignSummary,
} from "@/services/pilot/cosign";
import { shortenHash } from "./format";

const RATE_DENOMINATOR = 10_000_000n;

function formatEurcFloor(minEurcPerUsdc: bigint, noEurcLabel: string): string {
  if (minEurcPerUsdc === 0n) return noEurcLabel;
  const whole = minEurcPerUsdc / RATE_DENOMINATOR;
  const frac = minEurcPerUsdc % RATE_DENOMINATOR;
  return `${whole}.${frac.toString().padStart(7, "0")} EURC / USDC`;
}

/** Wallet capabilities the panel needs, so the view can be exercised directly. */
export interface AllyCosignWallet {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void> | void;
  canSignAuthEntries: boolean;
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
}

/**
 * The ally's half of the two-party distribution flow: paste in the payload
 * the operator shared, review the same invocation-decoded summary the
 * operator saw, and sign it as the ally.
 *
 * This is a distinct component from `DistributionCosignPanel` (the
 * operator's side) rather than one component with a `role` switch: the two
 * halves run in genuinely separate browser sessions, on separate machines,
 * so there is no shared state or shared props to unify them around - only a
 * shared decode/summarize function.
 */
export function AllyCosignPanel() {
  const { address, isConnected, connect, signAuthEntry, canSignAuthEntries } =
    useWallet();

  return (
    <AllyCosignPanelView
      wallet={{ address, isConnected, connect, signAuthEntry, canSignAuthEntries }}
    />
  );
}

/**
 * The panel itself, with the wallet passed in.
 *
 * Separating this from the hook keeps the connected, unsupported-wallet, and
 * disconnected states reachable in tests and stories without mocking the
 * wallet module out from under the rest of the suite.
 */
export function AllyCosignPanelView({ wallet }: { wallet: AllyCosignWallet }) {
  const t = useTranslations("Pilot");
  const { address, isConnected, connect, signAuthEntry, canSignAuthEntries } =
    wallet;

  const [pasted, setPasted] = useState("");
  const [summary, setSummary] = useState<AnyCosignSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function review() {
    setError(null);
    setResult(null);
    setSummary(null);
    try {
      setSummary(summarizeCosignPayload(pasted.trim()));
    } catch (reviewError) {
      setError(describeError(reviewError));
    }
  }

  async function coSign() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const { payloadJson, summary: updated } = await coSignPayloadAsAlly({
        payloadJson: pasted.trim(),
        allyAddress: address,
        signAuthEntry,
      });
      setResult(payloadJson);
      setSummary(updated);
    } catch (coSignError) {
      setError(describeError(coSignError));
    } finally {
      setBusy(false);
    }
  }

  function copyResult() {
    if (!result) return;
    void navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card variant="bordered">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-cyan-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white">
          {t("cosign.allyPanelTitle")}
        </h2>
      </div>
      <p className="mb-3 text-xs text-neutral-400">{t("cosign.allyPanelHint")}</p>

      {!isConnected ? (
        <Button size="sm" variant="secondary" onClick={() => void connect()}>
          {t("queue.connect")}
        </Button>
      ) : !canSignAuthEntries ? (
        <p role="alert" className="text-xs text-amber-300">
          {t("cosign.walletCannotSignAuthEntries")}
        </p>
      ) : (
        <div className="space-y-3">
          <Textarea
            rows={4}
            value={pasted}
            placeholder={t("cosign.pasteRequestPlaceholder")}
            className="text-[10px]"
            onChange={(event) => {
              setPasted(event.target.value);
              setSummary(null);
              setResult(null);
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={pasted.trim().length === 0}
            onClick={review}
          >
            {t("cosign.reviewButton")}
          </Button>

          {summary && (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-xs font-medium text-white">
                {t("cosign.summaryTitle")}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {summary.kind === "execute_distribution" && (
                  <>
                    <dt className="text-neutral-500">{t("cosign.summaryCycle")}</dt>
                    <dd className="text-neutral-200">{summary.cycleId}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryOperator")}</dt>
                    <dd className="truncate text-neutral-200">{summary.operator}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryAlly")}</dt>
                    <dd className="truncate text-neutral-200">{summary.ally}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryEurcFloor")}</dt>
                    <dd className="text-neutral-200">
                      {formatEurcFloor(summary.minEurcPerUsdc, t("cosign.noEurcHolders"))}
                    </dd>
                  </>
                )}
                {summary.kind === "record_evidence" && (
                  <>
                    <dt className="text-neutral-500">{t("cosign.summaryCycle")}</dt>
                    <dd className="text-neutral-200">{summary.cycleId}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryOperator")}</dt>
                    <dd className="truncate text-neutral-200">{summary.operator}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryAlly")}</dt>
                    <dd className="truncate text-neutral-200">{summary.ally}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryEvidenceHash")}</dt>
                    <dd className="text-neutral-200">{shortenHash(summary.evidenceHash)}</dd>
                  </>
                )}
                {summary.kind === "exit" && (
                  <>
                    <dt className="text-neutral-500">{t("cosign.summaryOperator")}</dt>
                    <dd className="truncate text-neutral-200">{summary.operator}</dd>
                    <dt className="text-neutral-500">{t("cosign.summaryAlly")}</dt>
                    <dd className="truncate text-neutral-200">{summary.ally}</dd>
                    <dt className="text-neutral-500">{t("cosign.exitReasonLabel")}</dt>
                    <dd className="text-neutral-200">{summary.reason}</dd>
                  </>
                )}
              </dl>

              {summary.kind === "exit" && (
                <p className="text-xs text-red-300">{t("cosign.exitConfirmNotice")}</p>
              )}

              {!result && (
                <Button
                  size="sm"
                  isLoading={busy}
                  disabled={summary.ally !== address}
                  onClick={() => void coSign()}
                >
                  {t("cosign.coSignButton")}
                </Button>
              )}
            </div>
          )}

          {result && (
            <div>
              <p className="mb-1 text-xs text-neutral-500">
                {t("cosign.returnPayloadLabel")}
              </p>
              <Textarea
                readOnly
                rows={4}
                value={result}
                className="text-[10px]"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={copyResult}
              >
                {copied ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied ? t("cosign.copied") : t("cosign.copyButton")}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}
    </Card>
  );
}

function describeError(error: unknown): string {
  if (error instanceof CosignError) return error.message;
  return error instanceof Error ? error.message : String(error);
}
