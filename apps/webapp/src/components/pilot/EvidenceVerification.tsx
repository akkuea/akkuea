"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  SearchCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import {
  verifyEvidenceBytes,
  verifyEvidenceDocument,
  type EvidenceVerification as EvidenceVerificationResult,
} from "@/services/pilot/evidenceVerify";
import { shortenHash } from "./format";

interface EvidenceVerificationProps {
  /** Link the ally supplied alongside the on-chain digest. */
  evidenceLink: string;
  /** Lowercase hex SHA-256 digest recorded on-chain. */
  evidenceHashHex: string;
}

/**
 * Verify that a cycle's linked document matches the digest on-chain.
 *
 * The digest alone proves nothing unless someone checks the document against
 * it, so this control fetches the link, re-hashes it in the browser, and
 * reports match, mismatch, or unreachable. A source the browser cannot fetch
 * (CORS, an offline mirror, an expired link) is reported as unreachable rather
 * than mismatch, and the user can hash a copy they downloaded themselves
 * through the same code path.
 */
export function EvidenceVerification({
  evidenceLink,
  evidenceHashHex,
}: EvidenceVerificationProps) {
  const t = useTranslations("Pilot");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<EvidenceVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verifyLink() {
    setPending(true);
    setError(null);
    try {
      setResult(await verifyEvidenceDocument(evidenceLink, evidenceHashHex));
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : t("verify.failed"),
      );
    } finally {
      setPending(false);
    }
  }

  async function verifyFile(file: File | null) {
    if (!file) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      setResult(
        await verifyEvidenceBytes(await file.arrayBuffer(), evidenceHashHex),
      );
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : t("verify.failed"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        isLoading={pending}
        onClick={() => void verifyLink()}
      >
        <span className="inline-flex items-center gap-1.5">
          {!pending && (
            <SearchCheck className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {t("verify.action")}
        </span>
      </Button>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      {result?.status === "match" && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("verify.match")}
        </p>
      )}

      {result?.status === "mismatch" && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t("verify.mismatch")}{" "}
            <span className="break-all text-neutral-400">
              {result.actualHex ? shortenHash(result.actualHex) : ""}
            </span>
          </span>
        </div>
      )}

      {result?.status === "unreachable" && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="flex items-start gap-1.5 text-xs text-amber-200">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              {t("verify.unreachable")}
              {result.reason ? ` (${result.reason})` : ""}
            </span>
          </p>
          <p className="text-xs text-neutral-400">{t("verify.fileFallback")}</p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-cyan-400 hover:underline">
            {pending ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {t("verify.chooseFile")}
            <input
              type="file"
              className="sr-only"
              disabled={pending}
              onChange={(event) =>
                void verifyFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
