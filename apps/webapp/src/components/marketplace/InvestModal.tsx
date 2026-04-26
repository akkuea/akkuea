"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
  Wallet,
} from "lucide-react";
import type { PropertyInfo } from "@real-estate-defi/shared";
import { Badge, Button, Input, Modal } from "@/components/ui";
import { formatCurrency, truncateAddress, cn } from "@/lib/utils";
import { propertyApi } from "@/services/api/properties";
import { getPropertyImage, getPropertyTypeLabel } from "./marketplace.utils";

export interface InvestModalProps {
  property: PropertyInfo;
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  walletAddress?: string | null;
  onConnectWallet: () => Promise<void> | void;
  onInvestmentSuccess?: () => void;
}

function shortenTxHash(hash: string): string {
  if (hash.length <= 16) {
    return hash;
  }

  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export function InvestModal({
  property,
  isOpen,
  onClose,
  isConnected,
  walletAddress,
  onConnectWallet,
  onInvestmentSuccess,
}: InvestModalProps) {
  const [tokens, setTokens] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"usdc" | "fiat">("usdc");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTokens(1);
    setPaymentMethod("usdc");
    setIsSubmitting(false);
    setError(null);
    setTxHash(null);
  }, [isOpen, property.id]);

  const maxTokens = property.availableShares;
  const pricePerToken = parseFloat(property.pricePerShare);
  const totalCost = tokens * pricePerToken;

  const purchaseSummary = useMemo(
    () => ({
      tokens,
      totalCost,
      remainingShares: Math.max(0, property.availableShares - tokens),
    }),
    [property.availableShares, tokens, totalCost],
  );

  async function handleConfirmInvestment() {
    if (!walletAddress) {
      await onConnectWallet();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await propertyApi.buyShares(
        property.id,
        walletAddress,
        tokens,
      );
      setTxHash(result.transactionHash);
      onInvestmentSuccess?.();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We couldn't submit the transaction. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invest in Property"
      size="lg"
    >
      {txHash ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#00ff88]/30 bg-[#00ff88]/10">
            <CheckCircle2 className="h-7 w-7 text-[#00ff88]" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-white">
              Transaction submitted
            </p>
            <p className="text-sm text-neutral-400">
              Your investment request for {property.name} has been sent
              successfully.
            </p>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#ff3e00] hover:underline"
          >
            {shortenTxHash(txHash)}
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4 rounded-lg border border-[#262626] bg-[#1a1a1a] p-4">
            <Image
              src={getPropertyImage(property)}
              alt={property.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white">{property.name}</h3>
              <p className="text-sm text-neutral-500">
                {property.location.city}, {property.location.country}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={property.verified ? "success" : "outline"}>
                  {property.verified ? "Verified" : "Pending verification"}
                </Badge>
                <Badge variant="outline">
                  {getPropertyTypeLabel(property.propertyType)}
                </Badge>
              </div>
            </div>
          </div>

          {!isConnected && (
            <div className="rounded-lg border border-[#ff3e00]/30 bg-[#ff3e00]/10 p-4">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-5 w-5 text-[#ff3e00]" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">
                    Connect your wallet to invest
                  </p>
                  <p className="text-sm text-neutral-400">
                    We need a connected Stellar wallet before we can submit the
                    investment transaction.
                  </p>
                  <Button
                    variant="accent"
                    onClick={() => void onConnectWallet()}
                  >
                    Connect Wallet
                  </Button>
                </div>
              </div>
            </div>
          )}

          {walletAddress && (
            <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-4 text-xs font-mono text-neutral-400">
              Connected wallet:{" "}
              <span className="text-white">
                {truncateAddress(walletAddress)}
              </span>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-400">
              Number of Tokens
            </label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTokens((current) => Math.max(1, current - 1))}
                disabled={tokens <= 1 || isSubmitting}
              >
                -
              </Button>
              <Input
                type="number"
                min={1}
                max={Math.max(1, maxTokens)}
                value={tokens}
                onChange={(event) => {
                  const nextValue = parseInt(event.target.value, 10);
                  const boundedValue = Number.isNaN(nextValue)
                    ? 1
                    : Math.max(1, Math.min(maxTokens, nextValue));
                  setTokens(boundedValue);
                }}
                className="w-24 text-center"
                disabled={isSubmitting || maxTokens === 0}
                aria-label="Number of tokens"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setTokens((current) => Math.min(maxTokens, current + 1))
                }
                disabled={
                  tokens >= maxTokens || isSubmitting || maxTokens === 0
                }
              >
                +
              </Button>
            </div>
            <p className="mt-2 font-mono text-[10px] text-neutral-600">
              Price per token: {formatCurrency(pricePerToken)}.{" "}
              {property.availableShares.toLocaleString()} shares currently
              available.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-400">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["usdc", "fiat"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "cursor-pointer rounded-lg border-2 p-4 text-left transition-all",
                    paymentMethod === method
                      ? "border-[#00ff88] bg-[#00ff88]/10"
                      : "border-[#262626] hover:border-[#404040]",
                  )}
                >
                  <span className="font-medium text-white">
                    {method === "usdc" ? "USDC" : "Fiat"}
                  </span>
                  <p className="mt-1 text-xs text-neutral-500">
                    {method === "usdc"
                      ? "Pay with stablecoin"
                      : "Card / bank transfer"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-[#262626] bg-[#0a0a0a] p-4">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Tokens</span>
              <span className="font-mono text-white">
                {purchaseSummary.tokens}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">Price per Token</span>
              <span className="font-mono text-white">
                {formatCurrency(pricePerToken)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500">
                Remaining Shares After Purchase
              </span>
              <span className="font-mono text-white">
                {purchaseSummary.remainingShares.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#262626] pt-3">
              <span className="font-medium text-white">Total</span>
              <span className="font-mono text-xl font-bold text-white">
                {formatCurrency(purchaseSummary.totalCost)}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              isSecure
              isLoading={isSubmitting}
              disabled={maxTokens === 0}
              onClick={() => void handleConfirmInvestment()}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {isConnected ? "Confirm Investment" : "Connect Wallet"}
            </Button>
          </div>

          <p className="flex items-center justify-center gap-1 text-center font-mono text-[10px] text-neutral-600">
            <Lock className="h-3 w-3" />
            Secured by Stellar blockchain with institutional custody
          </p>
        </div>
      )}
    </Modal>
  );
}
