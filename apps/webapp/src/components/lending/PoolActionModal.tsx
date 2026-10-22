"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Coins,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { LendingPool } from "@akkuea/shared";
import { Modal, Badge, Button, Toggle } from "@/components/ui";
import { Form, FormInput } from "@/components/forms";
import {
  createLendingActionSchema,
  type LendingActionFormValues,
} from "@/schemas/forms";
import { lendingApi } from "@/services/api";
import { formatAssetAmount } from "@/lib/utils";
import type { OptimisticAction } from "@/hooks/useLendingPools";

export type PoolAction = "supply" | "borrow" | "withdraw" | "repay";

export interface PoolActionModalProps {
  pool: LendingPool | null;
  action: PoolAction;
  isOpen: boolean;
  onClose: () => void;
  /** Connected wallet address - required for real TX submission */
  userAddress?: string | null;
  /** The user's deposit in this pool, in the pool's asset; caps withdraw */
  userDeposit?: number;
  /** The user's debt in this pool (principal plus accrued interest); caps repay */
  userDebt?: number;
  /** Callback fired after a successful transaction so the parent can refetch */
  onSuccess?: () => void;
  /** Apply an optimistic update to the UI before on-chain confirmation */
  applyOptimisticUpdate?: (
    action: OptimisticAction,
    poolId: string,
    amount: number,
    pool: LendingPool,
  ) => string;
  /** Mark an optimistic snapshot as confirmed */
  commitOptimisticUpdate?: (snapshotId: string) => void;
  /** Revert an optimistic snapshot on failure */
  rollbackOptimisticUpdate?: (snapshotId: string) => void;
}

/** How long the success view stays up before the modal closes itself */
export const AUTO_CLOSE_DELAY_MS = 2500;

/** Stellar assets use 7 decimal places */
const AMOUNT_DECIMALS = 7;

/** Present a valid 64-hex-char Stellar-style tx hash in a shortened form */
function shortenTxHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

/**
 * What caps the amount of an action:
 * - `userDeposit`: what the user has supplied to the pool
 * - `userDebt`: what the user owes the pool, principal plus accrued interest
 * - `poolLiquidity`: what the pool can lend out right now
 * - `none`: no upper bound (a deposit can always grow the pool)
 */
type ActionLimit = "userDeposit" | "userDebt" | "poolLiquidity" | "none";

const ACTION_CONFIG: Record<
  PoolAction,
  {
    title: string;
    description: string;
    buttonText: string;
    apyKey: "supplyAPY" | "borrowAPY";
    limit: ActionLimit;
    /** Validation message when the amount is above the limit */
    limitMessage: (formattedLimit: string) => string;
  }
> = {
  supply: {
    title: "Supply to Pool",
    description: "Earn interest by supplying liquidity",
    buttonText: "Supply",
    apyKey: "supplyAPY",
    limit: "none",
    limitMessage: () => "",
  },
  borrow: {
    title: "Borrow from Pool",
    description: "Borrow against your collateral",
    buttonText: "Borrow",
    apyKey: "borrowAPY",
    limit: "poolLiquidity",
    limitMessage: (limit) =>
      `Amount cannot exceed the pool's available liquidity of ${limit}`,
  },
  withdraw: {
    title: "Withdraw",
    description: "Withdraw your deposited funds",
    buttonText: "Withdraw",
    apyKey: "supplyAPY",
    limit: "userDeposit",
    limitMessage: (limit) => `Amount cannot exceed your deposit of ${limit}`,
  },
  repay: {
    title: "Repay Loan",
    description: "Repay your outstanding loan",
    buttonText: "Repay",
    apyKey: "borrowAPY",
    limit: "userDebt",
    limitMessage: (limit) => `Amount cannot exceed your debt of ${limit}`,
  },
};

function toLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Rounding hides float noise from summing rows, e.g. 0.7 + 0.1.
  return Number(value.toFixed(AMOUNT_DECIMALS));
}

/** The largest amount the action accepts, or null when it has no cap. */
export function getActionLimit(
  action: PoolAction,
  pool: LendingPool,
  userDeposit = 0,
  userDebt = 0,
): number | null {
  switch (ACTION_CONFIG[action].limit) {
    case "userDeposit":
      return toLimit(userDeposit);
    case "userDebt":
      return toLimit(userDebt);
    case "poolLiquidity":
      return toLimit(parseFloat(pool.availableLiquidity));
    case "none":
      return null;
  }
}

/**
 * PoolActionModal
 *
 * Handles Supply / Borrow / Withdraw / Repay actions against a `LendingPool`.
 * Submits real Stellar transactions via the `lendingApi` service layer.
 * Uses optimistic UI: the change is reflected immediately, and rolled back
 * if the transaction fails.
 */
export function PoolActionModal({
  pool,
  action,
  isOpen,
  onClose,
  userAddress,
  userDeposit = 0,
  userDebt = 0,
  onSuccess,
  applyOptimisticUpdate,
  commitOptimisticUpdate,
  rollbackOptimisticUpdate,
}: PoolActionModalProps) {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  /** The pending auto-close after a success, so it can be cancelled */
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Bumped every time the modal closes. A transaction that settles after its
   * modal was closed sees a different session and does not schedule a close,
   * which would otherwise close whatever modal is open by then.
   */
  const sessionRef = useRef(0);

  const clearAutoClose = useCallback(() => {
    if (autoCloseTimerRef.current !== null) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  // Cancel the auto-close when the parent closes the modal, and on unmount.
  useEffect(() => {
    if (!isOpen) {
      clearAutoClose();
      sessionRef.current += 1;
    }
  }, [isOpen, clearAutoClose]);

  useEffect(
    () => () => {
      clearAutoClose();
      sessionRef.current += 1;
    },
    [clearAutoClose],
  );

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
  const maxAmount = getActionLimit(action, pool, userDeposit, userDebt);
  const formattedLimit =
    maxAmount === null ? null : formatAssetAmount(maxAmount, pool.asset);
  const canSubmit = Boolean(userAddress);

  const handleClose = () => {
    clearAutoClose();
    sessionRef.current += 1;
    setTxHash(null);
    setTxError(null);
    setPendingTx(false);
    onClose();
  };

  const handleSubmit = async (values: LendingActionFormValues) => {
    if (!userAddress) {
      throw new Error(
        "Connect your wallet before submitting a lending action.",
      );
    }

    const amount = parseFloat(values.amount);
    const session = sessionRef.current;
    let snapshotId: string | null = null;

    try {
      // 1. Apply optimistic update immediately so the UI reflects the change
      //    before the on-chain transaction confirms.
      if (applyOptimisticUpdate) {
        snapshotId = applyOptimisticUpdate(
          action as OptimisticAction,
          pool.id,
          amount,
          pool,
        );
      }

      setPendingTx(true);
      setTxError(null);

      // 2. Submit the actual transaction to the backend / Soroban
      if (action === "supply") {
        await lendingApi.deposit(pool.id, { userAddress, amount });
      } else if (action === "withdraw") {
        await lendingApi.withdraw(pool.id, { userAddress, amount });
      } else if (action === "borrow") {
        await lendingApi.borrow(pool.id, {
          userAddress,
          collateralAmount: amount,
          collateralAsset: pool.assetAddress,
          borrowAmount: amount,
        });
      } else {
        await lendingApi.repay(pool.id, { userAddress, amount });
      }

      // 3. Transaction confirmed - commit the optimistic snapshot so the
      //    next refetch replaces it with authoritative data.
      if (snapshotId && commitOptimisticUpdate) {
        commitOptimisticUpdate(snapshotId);
      }
      onSuccess?.();

      // The modal was closed while the transaction was in flight: leave
      // whatever is open now alone.
      if (session !== sessionRef.current) return;

      setTxHash(`submitted-${Date.now()}`);

      // Auto-close after showing the hash
      clearAutoClose();
      autoCloseTimerRef.current = setTimeout(() => {
        autoCloseTimerRef.current = null;
        handleClose();
      }, AUTO_CLOSE_DELAY_MS);
    } catch (err) {
      // 4. Transaction failed - rollback the optimistic update so the UI
      //    reverts to the previous state.
      if (snapshotId && rollbackOptimisticUpdate) {
        rollbackOptimisticUpdate(snapshotId);
      }

      if (session !== sessionRef.current) return;

      const message =
        err instanceof Error ? err.message : "Transaction failed.";
      setTxError(message);
      setPendingTx(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={cfg.title}
      description={cfg.description}
    >
      {/* Pending state - waiting for on-chain confirmation */}
      {pendingTx && !txHash ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#ff3e00]/10 border border-[#ff3e00]/30 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-[#ff3e00] animate-spin" />
          </div>
          <div>
            <p className="text-base font-semibold text-white mb-1">
              Confirming transaction
            </p>
            <p className="text-xs text-neutral-500">
              Waiting for Soroban on-chain confirmation…
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <div className="h-1.5 bg-[#262626] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#ff3e00] rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 15, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      ) : txError ? (
        /* Error state - transaction failed, optimistic update was rolled back */
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-white mb-1">
              Transaction failed
            </p>
            <p className="text-xs text-red-400 mb-3">{txError}</p>
            <p className="text-xs text-neutral-500">
              Your balances have been reverted.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTxError(null);
            }}
          >
            Try Again
          </Button>
        </div>
      ) : txHash ? (
        /* Success state - show TX hash */
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-[#00ff88]" />
          </div>
          <div>
            <p className="text-base font-semibold text-white mb-1">
              Action submitted
            </p>
            <p className="text-xs text-neutral-500 mb-3">{successMessage}</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#ff3e00] font-mono">
              {shortenTxHash(txHash)}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </span>
          </div>
        </div>
      ) : (
        <Form
          schema={createLendingActionSchema({
            maxAmount,
            asset: pool.asset,
            maxMessage:
              formattedLimit === null
                ? undefined
                : cfg.limitMessage(formattedLimit),
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
                  <div
                    className="rounded-lg border border-[#ff3e00]/40 bg-[#7c2d12]/80 p-4 text-sm text-white"
                    role="alert"
                  >
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
                  hint={
                    formattedLimit === null
                      ? undefined
                      : `Available: ${formattedLimit}`
                  }
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
                <div
                  className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-lg space-y-2"
                  role="status"
                >
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
