"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import type { PilotSettlementCurrency } from "@akkuea/shared";
import { Badge, Button, Card, Toggle } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { setCurrencyPreference, type SignXdr } from "@/services/pilot/writes";

/** Wallet capabilities the control needs, so the view can be exercised directly. */
export interface SettlementWallet {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void> | void;
  signTransaction: SignXdr;
}

interface EurcPreferenceFormProps {
  /** The preference currently stored on-chain for this holder. */
  currentPreference: PilotSettlementCurrency;
  /** True when the payout contract is paused, which blocks the change. */
  isPaused?: boolean;
  /** Called after a successful change so the parent can re-read the chain. */
  onUpdated?: () => void;
}

/**
 * The investor's settlement-currency choice.
 *
 * Reads the current preference from the contract and signs
 * `set_currency_preference` with the connected wallet, which is the only party
 * allowed to change it. The risk of choosing EURC, that the swap can fail and
 * leave the share withheld, is stated before the choice rather than discovered
 * after a cycle.
 */
export function EurcPreferenceForm(props: EurcPreferenceFormProps) {
  const { address, isConnected, connect, signTransaction } = useWallet();

  return (
    <EurcPreferenceFormView
      {...props}
      wallet={{ address, isConnected, connect, signTransaction }}
    />
  );
}

/** The control itself, with the wallet passed in for tests and stories. */
export function EurcPreferenceFormView({
  currentPreference,
  isPaused = false,
  onUpdated,
  wallet,
}: EurcPreferenceFormProps & { wallet: SettlementWallet }) {
  const t = useTranslations("Pilot");
  const { address, isConnected, connect, signTransaction } = wallet;

  const [selected, setSelected] =
    useState<PilotSettlementCurrency>(currentPreference);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const wantsEurc = selected === "eurc";
  const changed = selected !== currentPreference;

  async function save() {
    if (!address) {
      setError(t("eurc.connectFirst"));
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await setCurrencyPreference(
        { holder: address, currency: selected },
        signTransaction,
      );
      setSaved(true);
      onUpdated?.();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : t("eurc.actionFailed"),
      );
    } finally {
      setPending(false);
    }
  }

  if (!isConnected) {
    return (
      <Card variant="bordered">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Wallet className="h-6 w-6 text-neutral-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-white">
              {t("eurc.connectTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t("eurc.connectDescription")}
            </p>
          </div>
          <Button onClick={() => void connect()}>{t("eurc.connect")}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{t("eurc.title")}</h2>
        <Badge variant={wantsEurc ? "info" : "default"} dot>
          {t(`eurc.current.${currentPreference}`)}
        </Badge>
      </div>

      <p className="mb-4 text-xs text-neutral-500">{t("eurc.subtitle")}</p>

      {isPaused && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
        >
          {t("eurc.pausedNotice")}
        </p>
      )}

      <Toggle
        enabled={wantsEurc}
        disabled={pending || isPaused}
        onChange={(enabled) => {
          setSelected(enabled ? "eurc" : "usdc");
          setSaved(false);
        }}
        label={t("eurc.toggleLabel")}
        description={t("eurc.toggleDescription")}
      />

      {wantsEurc && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
            aria-hidden="true"
          />
          <p className="text-xs text-amber-200">{t("eurc.riskNotice")}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("eurc.saved")}
        </p>
      )}

      <div className="mt-4">
        <Button
          size="sm"
          disabled={pending || isPaused || !changed}
          isLoading={pending}
          onClick={() => void save()}
        >
          {t("eurc.save")}
        </Button>
      </div>
    </Card>
  );
}
