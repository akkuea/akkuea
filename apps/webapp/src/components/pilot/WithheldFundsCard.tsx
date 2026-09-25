"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, HandCoins, Wallet } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { claimWithheld, type SignXdr } from "@/services/pilot/writes";
import { formatUsdc } from "./format";

/** Wallet capabilities the card needs, so the view can be exercised directly. */
export interface WithheldWallet {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void> | void;
  signTransaction: SignXdr;
}

interface WithheldFundsCardProps {
  /** USDC reserved for this holder after a failed EURC swap leg, in stroops. */
  withheld: bigint;
  /** Called after a successful claim so the parent can re-read the chain. */
  onClaimed?: () => void;
}

/**
 * USDC the contract is holding for this holder.
 *
 * A failed EURC swap leg isolates that holder's share instead of aborting the
 * cycle, and the contract reserves it on-chain. This card is the release path:
 * a plain claim, paid in USDC, that works even while the contract is paused or
 * the pilot has exited, because the money already belongs to the holder.
 */
export function WithheldFundsCard(props: WithheldFundsCardProps) {
  const { address, isConnected, connect, signTransaction } = useWallet();

  return (
    <WithheldFundsCardView
      {...props}
      wallet={{ address, isConnected, connect, signTransaction }}
    />
  );
}

/** The card itself, with the wallet passed in for tests and stories. */
export function WithheldFundsCardView({
  withheld,
  onClaimed,
  wallet,
}: WithheldFundsCardProps & { wallet: WithheldWallet }) {
  const t = useTranslations("Pilot");
  const { address, isConnected, connect, signTransaction } = wallet;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  // Nothing reserved and nothing just claimed: there is no state to show.
  if (withheld <= BigInt(0) && !claimed) {
    return null;
  }

  if (!isConnected) {
    return (
      <Card variant="bordered">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Wallet className="h-6 w-6 text-neutral-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-white">
              {t("withheld.connectTitle")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {t("withheld.connectDescription", {
                amount: formatUsdc(withheld),
              })}
            </p>
          </div>
          <Button onClick={() => void connect()}>
            {t("withheld.connect")}
          </Button>
        </div>
      </Card>
    );
  }

  async function claim() {
    if (!address) {
      setError(t("withheld.connectFirst"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await claimWithheld(address, signTransaction);
      setClaimed(true);
      onClaimed?.();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : t("withheld.actionFailed"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card variant="bordered">
      <div className="mb-4 flex items-center gap-2">
        <HandCoins className="h-5 w-5 text-amber-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">
          {t("withheld.title")}
        </h2>
      </div>

      <p className="text-2xl font-semibold text-white">
        {formatUsdc(withheld)}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {t("withheld.explanation")}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}

      {claimed && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("withheld.claimed")}
        </p>
      )}

      <div className="mt-4">
        <Button
          size="sm"
          disabled={pending || withheld <= BigInt(0)}
          isLoading={pending}
          onClick={() => void claim()}
        >
          {t("withheld.claim")}
        </Button>
      </div>
    </Card>
  );
}
