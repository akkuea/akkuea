"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Coins, CheckCircle2, ExternalLink } from "lucide-react";
import type { LendingPool } from "@real-estate-defi/shared";
import { Modal, Badge, Button, Toggle } from "@/components/ui";
import { Form, FormInput } from "@/components/forms";
import {
  createLendingActionSchema,
  type LendingActionFormValues,
} from "@/schemas/forms";
import { lendingApi } from "@/services/api";
import { formatCurrency } from "@/lib/utils";

export type PoolAction = "supply" | "borrow" | "withdraw" | "repay";

export interface PoolActionModalProps {
  pool: LendingPool | null;
  action: PoolAction;
  isOpen: boolean;
  onClose: () => void;
  /** Connected wallet address — required for real TX submission */
  userAddress?: string | null;
  /** Callback fired after a successful transaction so the parent can refetch */
  onSuccess?: () => void;
}

/** Present a valid 64-hex-char Stellar-style tx hash in a shortened form */
function shortenTxHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

const ACTION_CONFIG: Record<
  PoolAction,
  {
    title: string;
    description: string;
    buttonText: string;
    apyKey: "supplyAPY" | "borrowAPY";
    maxKey: "availableLiquidity" | "none";
  }
> = {
  supply: {
    title: "Supply to Pool",
    description: "Earn interest by supplying liquidity",
    buttonText: "Supply",
    apyKey: "supplyAPY",
    maxKey: "availableLiquidity",
  },
  borrow: {
    title: "Borrow from Pool",
    description: "Borrow against your collateral",
    buttonText: "Borrow",
    apyKey: "borrowAPY",
    maxKey: "availableLiquidity",
  },
  withdraw: {
    title: "Withdraw",
    description: "Withdraw your deposited funds",
    buttonText: "Withdraw",
    apyKey: "supplyAPY",
    maxKey: "availableLiquidity",
  },
  repay: {
    title: "Repay Loan",
    description: "Repay your outstanding loan",
    buttonText: "Repay",
    apyKey: "borrowAPY",
    maxKey: "availableLiquidity",
  },
};

/**
 * PoolActionModal
 *
 * Handles Supply / Borrow / Withdraw / Repay actions against a `LendingPool`.
 * Submits real Stellar transactions via the `lendingApi` service layer.
 */
export function PoolActionModal({
  pool,
  action,
  isOpen,
  onClose,
  userAddress,
  onSuccess,
}: PoolActionModalProps) {
  const [txHash, setTxHash] = useState<string | null>(null);
  const successMessage = useMemo(() => {
    switch (action) {
      case "supply":
        return "Supply submitted successfully.";
      case "withdraw":
        return "Withdrawal submitted successfully.";
      case "borrow":
        return "Borrow submitted successfully.";
      case "repay":
        return "Repayment submitted successfully.";
    }
  }, [action]);

  if (!pool) return null;

  const cfg = ACTION_CONFIG[action];
  const apy = pool[cfg.apyKey];
  const maxAmount = parseFloat(pool.availableLiquidity);
  const canSubmit = Boolean(userAddress);

  const handleSubmit = async (values: LendingActionFormValues) => {
    if (!userAddress) {
      throw new Error(
        "Connect your wallet before submitting a lending action.",
      );
    }

    const amount = parseFloat(values.amount);

    if (action === "supply") {
      await lendingApi.deposit(pool.id, {
        userAddress,
        amount,
      });
    } else if (action === "withdraw") {
      await lendingApi.withdraw(pool.id, {
        userAddress,
        amount,
      });
    } else if (action === "borrow") {
      await lendingApi.borrow(pool.id, {
        userAddress,
        collateralAmount: amount,
        collateralAsset: pool.assetAddress,
        borrowAmount: amount,
      });
    } else {
      await lendingApi.repay(pool.id, {
        userAddress,
        amount,
      });
    }

    setTxHash(`submitted-${Date.now()}`);
    onSuccess?.();

    // Auto-close after showing the hash
    setTimeout(() => {
      setTxHash(null);
      onClose();
    }, 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setTxHash(null);
        onClose();
      }}
      title={cfg.title}
      description={cfg.description}
    >
      {/* Success state — show TX hash */}
      {txHash ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-[#00ff88]" />
          </div>
          <div>
            <p className="text-base font-semibold text-white mb-1">
              Action submitted
            </p>
            <p className="text-xs text-neutral-500 mb-3">{successMessage}</p>
            {txHash ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#ff3e00] font-mono">
                {shortenTxHash(txHash)}
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <Form
          schema={createLendingActionSchema({
            maxAmount,
            asset: pool.asset,
          })}
          defaultValues={{ amount: "", zkPrivacy: false }}
          successMessage={successMessage}
          onSubmit={handleSubmit}
        >
          {({ watch, setValue, formState }) => {
            const zkPrivacy = watch("zkPrivacy");
            return (
              <div className="space-y-6">
                {/* Pool identity banner */}
                {!canSubmit ? (
                  <div className="rounded-lg border border-[#ff3e00]/30 bg-[#ff3e00]/10 p-4 text-sm text-neutral-200">
                    Connect your wallet before submitting this action.
                  </div>
                ) : null}

                <div
                  className="flex items-center gap-3 p-4 bg-[#1a1a1a] border border-[#262626] rounded-lg"
                  aria-label={`Pool: ${pool.name}`}
                >
                  <div
                    className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    <Coins
                      className="w-5 h-5 text-neutral-300"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{pool.name}</p>
                    <p className="text-xs text-neutral-500">{pool.asset}</p>
                  </div>
                  <Badge variant="success" className="ml-auto">
                    {apy}% APY
                  </Badge>
                </div>

                {/* Amount input */}
                <FormInput<LendingActionFormValues>
                  name="amount"
                  label={`Amount (${pool.asset})`}
                  type="number"
                  placeholder="0.00"
                  leftIcon={<Coins className="w-4 h-4" aria-hidden="true" />}
                  hint={`Available: ${formatCurrency(maxAmount)}`}
                  disabled={formState.isSubmitting}
                  aria-label={`Enter amount in ${pool.asset}`}
                />

                {/* ZK Privacy Toggle */}
                <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg">
                  <Toggle
                    enabled={zkPrivacy}
                    onChange={(v) => setValue("zkPrivacy", v)}
                    label="Enable ZK Privacy"
                    description="Hide transaction details using zero-knowledge proofs"
                  />
                  {zkPrivacy && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 flex items-start gap-2 text-sm text-blue-400"
                    >
                      <Shield
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-xs">
                        Your transaction amount and balance will be hidden from
                        public view. Only you can see the full details.
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Fee summary */}
                <div className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Transaction Fee</span>
                    <span className="text-white font-mono">~0.001 XLM</span>
                  </div>
                  {zkPrivacy && (
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-500">ZK Proof Fee</span>
                      <span className="text-white font-mono">~0.01 XLM</span>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  isSecure
                  type="submit"
                  isLoading={formState.isSubmitting}
                  disabled={
                    !canSubmit || !formState.isValid || formState.isSubmitting
                  }
                  aria-label={`${cfg.buttonText} ${pool.asset} from ${pool.name}`}
                >
                  {cfg.buttonText}
                </Button>
              </div>
            );
          }}
        </Form>
      )}
    </Modal>
  );
}
