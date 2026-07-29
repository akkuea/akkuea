"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Landmark,
  TrendingUp,
  Shield,
  Calculator,
  Eye,
  EyeOff,
  Clock,
  Percent,
  DollarSign,
  Coins,
  Wallet,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Navbar, Footer } from "@/components/layout";
import { TransactionHistory } from "@/components/transactions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  ErrorBoundary,
  FreshnessIndicator,
  Input,
  Modal,
} from "@/components/ui";
import { useWallet, useWalletConnectModal } from "@/components/auth/hooks";
import { WalletProviderModal } from "@/components/auth/WalletProviderModal";
import { formatCurrency } from "@/lib/utils";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
  fadeInUp,
} from "@/lib/animations";
import type { LendingPool } from "@real-estate-defi/shared";
import { useLendingPools } from "@/hooks/useLendingPools";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import {
  PoolActionModal,
  type PoolAction,
} from "@/components/lending/PoolActionModal";

// ---------------------------------------------------------------------------
// Yield Calculator (retained, unchanged)
// ---------------------------------------------------------------------------

interface YieldCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

function YieldCalculator({ isOpen, onClose }: YieldCalculatorProps) {
  const [amount, setAmount] = useState("10000");
  const [duration, setDuration] = useState("12");
  const [apy, setApy] = useState("5.2");

  const earnings = useMemo(() => {
    const principal = parseFloat(amount) || 0;
    const rate = parseFloat(apy) / 100 || 0;
    const months = parseFloat(duration) || 0;
    const years = months / 12;
    const finalAmount = principal * Math.pow(1 + rate, years);
    const interest = finalAmount - principal;
    const monthlyYield = months > 0 ? interest / months : 0;
    return { finalAmount, interest, monthlyYield };
  }, [amount, duration, apy]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yield Calculator" size="lg">
      <div className="space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <Input
            label="Investment Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            leftIcon={<DollarSign className="w-4 h-4" aria-hidden="true" />}
            aria-label="Investment amount"
          />
          <Input
            label="Duration (months)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            leftIcon={<Clock className="w-4 h-4" aria-hidden="true" />}
            aria-label="Duration in months"
          />
          <Input
            label="APY (%)"
            type="number"
            value={apy}
            onChange={(e) => setApy(e.target.value)}
            leftIcon={<Percent className="w-4 h-4" aria-hidden="true" />}
            aria-label="Annual percentage yield"
          />
        </div>

        <div className="p-6 bg-linear-to-br from-[#00ff88]/5 to-[#ff3e00]/5 border border-[#00ff88]/20 rounded-lg">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">
                Total Earnings
              </p>
              <p className="text-xl font-bold text-[#00ff88] font-mono">
                {formatCurrency(earnings.interest)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">
                Final Amount
              </p>
              <p className="text-xl font-bold text-white font-mono">
                {formatCurrency(earnings.finalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">
                Monthly Yield
              </p>
              <p className="text-xl font-bold text-[#ff3e00] font-mono">
                {formatCurrency(earnings.monthlyYield)}
              </p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-neutral-600 text-center font-mono">
          *Calculations are estimates based on current APY rates. Actual returns
          may vary.
        </p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Skeleton - shown while pools are loading
// ---------------------------------------------------------------------------

function PoolRowSkeleton() {
  return (
    <div
      className="p-4 animate-pulse"
      role="status"
      aria-label="Loading pool data"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-4 lg:w-1/4">
          <div className="w-10 h-10 bg-[#262626] rounded-lg" />
          <div className="space-y-2">
            <div className="h-3 bg-[#262626] rounded w-28" />
            <div className="h-2 bg-[#262626] rounded w-12" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 bg-[#262626] rounded w-16" />
              <div className="h-3 bg-[#262626] rounded w-20" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-[#262626] rounded" />
          <div className="h-7 w-16 bg-[#262626] rounded" />
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="p-4 animate-pulse" role="status" aria-label="Loading stat">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-2 bg-[#262626] rounded w-24" />
          <div className="h-5 bg-[#262626] rounded w-20" />
          <div className="h-2 bg-[#262626] rounded w-16" />
        </div>
        <div className="w-8 h-8 bg-[#262626] rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function LendingPage() {
  const { isConnected, address, refreshBalance } = useWallet();
  const { openConnectModal, connectModalProps } = useWalletConnectModal();

  const {
    pools,
    userPositions,
    isLoading,
    error,
    refetch,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
  } = useLendingPools(isConnected ? address : null);

  // Flatten all borrow positions across all pools for health factor computation
  const allBorrows = useMemo(
    () => Object.values(userPositions).flatMap((pos) => pos.borrows),
    [userPositions],
  );

  const { healthFactor, status: hfStatus } = useHealthFactor(allBorrows);

  // Aggregate stats from real pool data + user positions
  const totalDeposited = useMemo(
    () =>
      Object.values(userPositions).reduce(
        (acc, pos) =>
          acc + pos.deposits.reduce((s, d) => s + parseFloat(d.amount), 0),
        0,
      ),
    [userPositions],
  );

  const totalBorrowed = useMemo(
    () =>
      Object.values(userPositions).reduce(
        (acc, pos) =>
          acc +
          pos.borrows.reduce(
            (s, b) =>
              s + parseFloat(b.principal) + parseFloat(b.accruedInterest),
            0,
          ),
        0,
      ),
    [userPositions],
  );

  /** Average supply APY across all active pools - computed dynamically */
  const avgSupplyAPY = useMemo(() => {
    const activePools = pools.filter((p) => p.isActive && !p.isPaused);
    if (activePools.length === 0) return null;
    const avg =
      activePools.reduce((s, p) => s + p.supplyAPY, 0) / activePools.length;
    return avg.toFixed(1);
  }, [pools]);

  /** Average borrow APR across active pools - for Total Borrowed card */
  const avgBorrowAPY = useMemo(() => {
    const activePools = pools.filter((p) => p.isActive && !p.isPaused);
    if (activePools.length === 0) return null;
    const avg =
      activePools.reduce((s, p) => s + p.borrowAPY, 0) / activePools.length;
    return avg.toFixed(1);
  }, [pools]);

  // Modal state
  const [selectedPool, setSelectedPool] = useState<LendingPool | null>(null);
  const [actionType, setActionType] = useState<PoolAction>("supply");
  const [showCalculator, setShowCalculator] = useState(false);

  const [hideBalances, setHideBalances] = useState(false);

  const openPoolAction = (pool: LendingPool, action: PoolAction) => {
    setSelectedPool(pool);
    setActionType(action);
  };

  // -------------------------------------------------------------------------
  // Health factor display helpers
  // -------------------------------------------------------------------------
  const hfColor =
    hfStatus === "safe"
      ? "text-[#00ff88]"
      : hfStatus === "warning"
        ? "text-amber-400"
        : hfStatus === "critical"
          ? "text-red-500"
          : "text-neutral-500";

  const hfBg =
    hfStatus === "safe"
      ? "bg-[#00ff88]/10 border-[#00ff88]/20"
      : hfStatus === "warning"
        ? "bg-amber-500/10 border-amber-500/20"
        : hfStatus === "critical"
          ? "bg-red-500/10 border-red-500/20"
          : "bg-[#1a1a1a] border-[#262626]";

  const hfLabel =
    hfStatus === "safe"
      ? "Safe (>1.5)"
      : hfStatus === "warning"
        ? "Warning (>1.1)"
        : hfStatus === "critical"
          ? "At Risk (<1.1)"
          : "No active borrows";

  const hfDisplayValue =
    hfStatus === "none"
      ? "-"
      : isFinite(healthFactor)
        ? healthFactor.toFixed(2)
        : "∞";

  // -------------------------------------------------------------------------
  // Helper: user's total deposit / borrow amount in a specific pool
  // -------------------------------------------------------------------------
  function poolUserDeposit(poolId: string): number {
    return (
      userPositions[poolId]?.deposits.reduce(
        (s, d) => s + parseFloat(d.amount),
        0,
      ) ?? 0
    );
  }

  function poolUserBorrow(poolId: string): number {
    return (
      userPositions[poolId]?.borrows.reduce(
        (s, b) => s + parseFloat(b.principal) + parseFloat(b.accruedInterest),
        0,
      ) ?? 0
    );
  }

  // -------------------------------------------------------------------------
  // Wallet gate
  // -------------------------------------------------------------------------
  if (!isConnected) {
    return (
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        className="min-h-screen bg-black"
      >
        <Navbar />
        <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center mb-6">
              <Wallet className="w-8 h-8 text-neutral-500" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">DeFi Lending</h1>
            <p className="text-sm text-neutral-500 max-w-md mb-8">
              Connect your wallet to access lending pools. Supply liquidity to
              earn yields or borrow against your tokenized real estate
              collateral.
            </p>
            <Button
              size="lg"
              onClick={openConnectModal}
              leftIcon={<Wallet className="w-4 h-4" aria-hidden="true" />}
              isSecure
              aria-label="Connect your wallet to access DeFi Lending"
            >
              Connect Wallet
            </Button>
          </motion.div>
        </main>
        <WalletProviderModal {...connectModalProps} />
        <Footer />
      </motion.div>
    );
  }

  // -------------------------------------------------------------------------
  // Connected view
  // -------------------------------------------------------------------------
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-black"
    >
      <Navbar />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <ErrorBoundary>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* ----------------------------------------------------------------
              Header
          ---------------------------------------------------------------- */}
            <motion.div
              variants={staggerItem}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-white">
                    DeFi Lending
                  </h1>
                  <FreshnessIndicator
                    lastUpdatedAt={lastUpdatedAt}
                    connectionStatus={connectionStatus}
                    isPolling={isPolling}
                    onRefresh={refetch}
                  />
                </div>
                <p className="text-sm text-neutral-500">
                  Supply liquidity to earn yields or borrow against your RWA
                  collateral
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHideBalances(!hideBalances)}
                  leftIcon={
                    hideBalances ? (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                  aria-label={hideBalances ? "Show balances" : "Hide balances"}
                >
                  {hideBalances ? "Show" : "Hide"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCalculator(true)}
                  leftIcon={
                    <Calculator className="w-4 h-4" aria-hidden="true" />
                  }
                  aria-label="Open yield calculator"
                >
                  Calculator
                </Button>
              </div>
            </motion.div>

            {/* ----------------------------------------------------------------
              Error Banner
          ---------------------------------------------------------------- */}
            {error && (
              <motion.div variants={staggerItem}>
                <div
                  role="alert"
                  className="flex items-center justify-between gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle
                      className="w-4 h-4 text-red-400 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refetch}
                    leftIcon={
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    }
                    aria-label="Retry loading lending pools"
                  >
                    Retry
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ----------------------------------------------------------------
              Overview Stats
          ---------------------------------------------------------------- */}
            <motion.div
              variants={staggerItem}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {/* Total Supplied */}
              {isLoading ? (
                <>
                  <Card>
                    <StatCardSkeleton />
                  </Card>
                  <Card>
                    <StatCardSkeleton />
                  </Card>
                  <Card>
                    <StatCardSkeleton />
                  </Card>
                  <Card>
                    <StatCardSkeleton />
                  </Card>
                </>
              ) : (
                <>
                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wider">
                          Total Supplied
                        </p>
                        <p className="text-xl font-bold text-white mt-1 font-mono">
                          {hideBalances
                            ? "••••••"
                            : formatCurrency(totalDeposited)}
                        </p>
                        {avgSupplyAPY !== null && (
                          <p className="text-xs text-[#00ff88] mt-1">
                            +{avgSupplyAPY}% avg APY
                          </p>
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                        <TrendingUp
                          className="w-4 h-4 text-[#00ff88]"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wider">
                          Total Borrowed
                        </p>
                        <p className="text-xl font-bold text-white mt-1 font-mono">
                          {hideBalances
                            ? "••••••"
                            : formatCurrency(totalBorrowed)}
                        </p>
                        {avgBorrowAPY !== null && (
                          <p className="text-xs text-amber-400 mt-1">
                            {avgBorrowAPY}% APR
                          </p>
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Landmark
                          className="w-4 h-4 text-amber-400"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wider">
                          Net Worth
                        </p>
                        <p className="text-xl font-bold text-white mt-1 font-mono">
                          {hideBalances
                            ? "••••••"
                            : formatCurrency(totalDeposited - totalBorrowed)}
                        </p>
                        <p className="text-xs text-neutral-600 mt-1 font-mono">
                          Deposits − Borrows
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <DollarSign
                          className="w-4 h-4 text-blue-400"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-neutral-500 uppercase tracking-wider">
                          Health Factor
                        </p>
                        <p
                          className={`text-xl font-bold mt-1 font-mono ${hfColor}`}
                          aria-label={`Health factor: ${hfDisplayValue}. Status: ${hfLabel}`}
                        >
                          {hfDisplayValue}
                        </p>
                        <p className="text-xs text-neutral-600 mt-1 font-mono">
                          {hfLabel}
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg border ${hfBg}`}>
                        <Shield
                          className={`w-4 h-4 ${hfColor}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </motion.div>

            {/* ----------------------------------------------------------------
              Lending Pools Table
          ---------------------------------------------------------------- */}
            <motion.div variants={staggerItem}>
              <Card noPadding>
                <CardHeader className="p-4 border-b border-[#262626]">
                  <div className="flex items-center justify-between">
                    <CardTitle>Lending Pools</CardTitle>
                    {!isLoading && (
                      <Badge variant="info" dot>
                        {pools.filter((p) => p.isActive).length} Active Pool
                        {pools.filter((p) => p.isActive).length !== 1
                          ? "s"
                          : ""}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="divide-y divide-[#1a1a1a]">
                  {isLoading ? (
                    // Loading skeletons
                    Array.from({ length: 3 }).map((_, i) => (
                      <PoolRowSkeleton key={i} />
                    ))
                  ) : pools.length === 0 && !error ? (
                    // Empty state
                    <div className="py-12 text-center text-neutral-500">
                      <Coins
                        className="w-8 h-8 mx-auto mb-3 opacity-40"
                        aria-hidden="true"
                      />
                      <p className="text-sm">No lending pools available.</p>
                    </div>
                  ) : (
                    pools
                      .filter((pool) => pool.isActive)
                      .map((pool) => {
                        const deposit = poolUserDeposit(pool.id);
                        const borrow = poolUserBorrow(pool.id);
                        const available = parseFloat(pool.availableLiquidity);

                        return (
                          <div
                            key={pool.id}
                            className="p-4 hover:bg-[#0a0a0a] transition-colors"
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                              {/* Pool identity */}
                              <div className="flex items-center gap-4 lg:w-1/4">
                                <div
                                  className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center shrink-0"
                                  aria-label={pool.asset}
                                >
                                  <Coins
                                    className="w-5 h-5 text-neutral-300"
                                    aria-hidden="true"
                                  />
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-white">
                                    {pool.name}
                                  </h3>
                                  <p className="text-xs text-neutral-500 font-mono">
                                    {pool.asset}
                                  </p>
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:flex-1">
                                <div>
                                  <p className="text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">
                                    Total Liquidity
                                  </p>
                                  <p className="text-sm font-medium text-white font-mono">
                                    {formatCurrency(
                                      parseFloat(pool.totalDeposits),
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">
                                    Supply APY
                                  </p>
                                  <p className="text-sm font-medium text-[#00ff88] font-mono">
                                    {pool.supplyAPY}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">
                                    Borrow APY
                                  </p>
                                  <p className="text-sm font-medium text-amber-400 font-mono">
                                    {pool.borrowAPY}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">
                                    Utilization
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-[#262626] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-linear-to-r from-[#ff3e00] to-[#00ff88]"
                                        style={{
                                          width: `${pool.utilizationRate}%`,
                                        }}
                                        role="presentation"
                                      />
                                    </div>
                                    <span className="text-xs text-white font-mono">
                                      {pool.utilizationRate.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* User position (shown only when non-zero) */}
                              {(deposit > 0 || borrow > 0) && (
                                <div className="p-3 bg-[#0a0a0a] border border-[#262626] rounded-lg lg:w-48">
                                  <p className="text-[10px] text-neutral-600 mb-2 uppercase tracking-wider">
                                    Your Position
                                  </p>
                                  {deposit > 0 && (
                                    <p className="text-xs text-white font-mono">
                                      Supplied:{" "}
                                      {hideBalances
                                        ? "••••"
                                        : formatCurrency(deposit)}
                                    </p>
                                  )}
                                  {borrow > 0 && (
                                    <p className="text-xs text-amber-400 font-mono">
                                      Borrowed:{" "}
                                      {hideBalances
                                        ? "••••"
                                        : formatCurrency(borrow)}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex flex-wrap gap-2 lg:w-auto">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => openPoolAction(pool, "supply")}
                                  aria-label={`Supply to ${pool.name}`}
                                  disabled={pool.isPaused || available <= 0}
                                >
                                  Supply
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPoolAction(pool, "borrow")}
                                  aria-label={`Borrow from ${pool.name}`}
                                  disabled={pool.isPaused || available <= 0}
                                >
                                  Borrow
                                </Button>
                                {deposit > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      openPoolAction(pool, "withdraw")
                                    }
                                    aria-label={`Withdraw from ${pool.name}`}
                                  >
                                    Withdraw
                                  </Button>
                                )}
                                {borrow > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      openPoolAction(pool, "repay")
                                    }
                                    aria-label={`Repay loan in ${pool.name}`}
                                  >
                                    Repay
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* ----------------------------------------------------------------
              ZK Privacy Info Banner
          ---------------------------------------------------------------- */}
            <motion.div variants={staggerItem}>
              <Card variant="gradient">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Shield
                      className="w-5 h-5 text-blue-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white mb-2">
                      Zero-Knowledge Privacy
                    </h3>
                    <p className="text-xs text-neutral-500 mb-4">
                      Enable ZK privacy on any transaction to hide your balances
                      and transaction amounts from public view. Only you can see
                      the full details while maintaining full auditability.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info" dot>
                        ZK-SNARK Proofs
                      </Badge>
                      <Badge variant="info" dot>
                        Selective Disclosure
                      </Badge>
                      <Badge variant="info" dot>
                        Audit Compatible
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Transaction History */}
            <motion.div variants={staggerItem}>
              <TransactionHistory />
            </motion.div>
          </motion.div>
        </ErrorBoundary>
      </main>
      <Footer />

      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                               */}
      {/* ------------------------------------------------------------------ */}
      <YieldCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
      <PoolActionModal
        pool={selectedPool}
        action={actionType}
        isOpen={!!selectedPool}
        onClose={() => setSelectedPool(null)}
        userAddress={address}
        onSuccess={() => {
          refetch();
          void refreshBalance();
        }}
      />
    </motion.div>
  );
}
