"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  TrendingUp,
  Shield,
  Calculator,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Percent,
  DollarSign,
  Coins,
  FileText,
  ChevronDown,
  ChevronUp,
  Wallet,
} from "lucide-react";
import { Navbar, Footer } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Modal,
  Toggle,
} from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { formatCurrency, cn } from "@/lib/utils";
import { Form, FormInput } from "@/components/forms";
import {
  createLendingActionSchema,
  type LendingActionFormValues,
} from "@/schemas/forms";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
  fadeInUp,
} from "@/lib/animations";

// Mock lending pools data
const lendingPools = [
  {
    id: 1,
    name: "USDC Stable Pool",
    asset: "USDC",
    totalLiquidity: 5000000,
    utilization: 72,
    supplyAPY: 5.2,
    borrowAPY: 7.8,
    collateralFactor: 75,
    available: 1400000,
    yourDeposit: 25000,
    yourBorrow: 0,
    icon: "💵",
  },
  {
    id: 2,
    name: "XLM Native Pool",
    asset: "XLM",
    totalLiquidity: 2000000,
    utilization: 65,
    supplyAPY: 4.5,
    borrowAPY: 6.5,
    collateralFactor: 70,
    available: 700000,
    yourDeposit: 0,
    yourBorrow: 5000,
    icon: "⭐",
  },
  {
    id: 3,
    name: "RWA Collateral Pool",
    asset: "RWA",
    totalLiquidity: 10000000,
    utilization: 45,
    supplyAPY: 8.5,
    borrowAPY: 12.0,
    collateralFactor: 60,
    available: 5500000,
    yourDeposit: 50000,
    yourBorrow: 0,
    icon: "🏢",
  },
];

// Mock audit logs
const auditLogs = [
  {
    id: 1,
    action: "Deposit",
    pool: "USDC Stable Pool",
    amount: 10000,
    timestamp: "2025-01-15 14:32:00",
    txHash: "0x1234...5678",
    status: "completed",
  },
  {
    id: 2,
    action: "Borrow",
    pool: "XLM Native Pool",
    amount: 5000,
    timestamp: "2025-01-14 09:15:00",
    txHash: "0xabcd...efgh",
    status: "completed",
  },
  {
    id: 3,
    action: "Repay",
    pool: "XLM Native Pool",
    amount: 2500,
    timestamp: "2025-01-12 18:45:00",
    txHash: "0x9876...5432",
    status: "completed",
  },
  {
    id: 4,
    action: "Withdraw",
    pool: "RWA Collateral Pool",
    amount: 15000,
    timestamp: "2025-01-10 11:20:00",
    txHash: "0xijkl...mnop",
    status: "completed",
  },
];

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

    // Compound interest calculation
    const finalAmount = principal * Math.pow(1 + rate, years);
    const interest = finalAmount - principal;
    const monthlyYield = interest / months;

    return {
      finalAmount,
      interest,
      monthlyYield,
    };
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
            leftIcon={<DollarSign className="w-4 h-4" />}
          />
          <Input
            label="Duration (months)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            leftIcon={<Clock className="w-4 h-4" />}
          />
          <Input
            label="APY (%)"
            type="number"
            value={apy}
            onChange={(e) => setApy(e.target.value)}
            leftIcon={<Percent className="w-4 h-4" />}
          />
        </div>

        <div className="p-6 bg-gradient-to-br from-[#00ff88]/5 to-[#ff3e00]/5 border border-[#00ff88]/20 rounded-lg">
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

interface PoolActionModalProps {
  pool: (typeof lendingPools)[0] | null;
  action: "supply" | "borrow" | "withdraw" | "repay";
  isOpen: boolean;
  onClose: () => void;
}

function PoolActionModal({
  pool,
  action,
  isOpen,
  onClose,
}: PoolActionModalProps) {
  if (!pool) return null;

  const actionConfig = {
    supply: {
      title: "Supply to Pool",
      description: "Earn interest by supplying liquidity",
      buttonText: "Supply",
      apy: pool.supplyAPY,
    },
    borrow: {
      title: "Borrow from Pool",
      description: "Borrow against your collateral",
      buttonText: "Borrow",
      apy: pool.borrowAPY,
    },
    withdraw: {
      title: "Withdraw",
      description: "Withdraw your deposited funds",
      buttonText: "Withdraw",
      apy: pool.supplyAPY,
    },
    repay: {
      title: "Repay Loan",
      description: "Repay your outstanding loan",
      buttonText: "Repay",
      apy: pool.borrowAPY,
    },
  };

  const config = actionConfig[action];
  const maxAmount =
    action === "supply" || action === "borrow"
      ? pool.available
      : action === "withdraw"
        ? pool.yourDeposit
        : pool.yourBorrow;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      description={config.description}
    >
      <Form
        schema={createLendingActionSchema({
          maxAmount,
          asset: pool.asset,
        })}
        defaultValues={{ amount: "", zkPrivacy: false }}
        successMessage="Transaction submitted."
        onSubmit={async () => {
          // Simulate an async on-chain call
          await new Promise((resolve) => setTimeout(resolve, 1200));
          // Keep success visible briefly, then close
          setTimeout(() => onClose(), 600);
        }}
      >
        {({ watch, setValue, formState }) => {
          const zkPrivacy = watch("zkPrivacy");
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] border border-[#262626] rounded-lg">
                <span className="text-3xl">{pool.icon}</span>
                <div>
                  <p className="font-semibold text-white">{pool.name}</p>
                  <p className="text-xs text-neutral-500">{pool.asset}</p>
                </div>
                <Badge variant="success" className="ml-auto">
                  {config.apy}% APY
                </Badge>
              </div>

              <FormInput<LendingActionFormValues>
                name="amount"
                label={`Amount (${pool.asset})`}
                type="number"
                placeholder="0.00"
                leftIcon={<Coins className="w-4 h-4" />}
                hint={`Available: ${formatCurrency(maxAmount)}`}
                disabled={formState.isSubmitting}
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
                    <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="text-xs">
                      Your transaction amount and balance will be hidden from
                      public view. Only you can see the full details.
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Summary */}
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
                disabled={!formState.isValid}
              >
                {config.buttonText}
              </Button>
            </div>
          );
        }}
      </Form>
    </Modal>
  );
}

export default function LendingPage() {
  const { isConnected, connect, isConnecting } = useWallet();
  const [selectedPool, setSelectedPool] = useState<
    (typeof lendingPools)[0] | null
  >(null);
  const [actionType, setActionType] = useState<
    "supply" | "borrow" | "withdraw" | "repay"
  >("supply");
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);

  const totalDeposited = lendingPools.reduce(
    (acc, pool) => acc + pool.yourDeposit,
    0,
  );
  const totalBorrowed = lendingPools.reduce(
    (acc, pool) => acc + pool.yourBorrow,
    0,
  );

  const openPoolAction = (
    pool: (typeof lendingPools)[0],
    action: "supply" | "borrow" | "withdraw" | "repay",
  ) => {
    setSelectedPool(pool);
    setActionType(action);
  };

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
              <Wallet className="w-8 h-8 text-neutral-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">DeFi Lending</h1>
            <p className="text-sm text-neutral-500 max-w-md mb-8">
              Connect your wallet to access lending pools. Supply liquidity to
              earn yields or borrow against your tokenized real estate
              collateral.
            </p>
            <Button
              size="lg"
              onClick={connect}
              isLoading={isConnecting}
              leftIcon={<Wallet className="w-4 h-4" />}
              isSecure
            >
              Connect Wallet
            </Button>
          </motion.div>
        </main>
        <Footer />
      </motion.div>
    );
  }

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
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div
            variants={staggerItem}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-white">DeFi Lending</h1>
              <p className="text-sm text-neutral-500 mt-1">
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
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )
                }
              >
                {hideBalances ? "Show" : "Hide"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCalculator(true)}
                leftIcon={<Calculator className="w-4 h-4" />}
              >
                Calculator
              </Button>
            </div>
          </motion.div>

          {/* Overview Stats */}
          <motion.div
            variants={staggerItem}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">
                    Total Supplied
                  </p>
                  <p className="text-xl font-bold text-white mt-1 font-mono">
                    {hideBalances ? "••••••" : formatCurrency(totalDeposited)}
                  </p>
                  <p className="text-xs text-[#00ff88] mt-1">+5.8% avg APY</p>
                </div>
                <div className="p-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                  <TrendingUp className="w-4 h-4 text-[#00ff88]" />
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
                    {hideBalances ? "••••••" : formatCurrency(totalBorrowed)}
                  </p>
                  <p className="text-xs text-amber-400 mt-1">6.5% APR</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Landmark className="w-4 h-4 text-amber-400" />
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
                    Deposits - Borrows
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">
                    Health Factor
                  </p>
                  <p className="text-xl font-bold text-[#00ff88] mt-1 font-mono">
                    2.45
                  </p>
                  <p className="text-xs text-neutral-600 mt-1 font-mono">
                    Safe (&gt;1.5)
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                  <Shield className="w-4 h-4 text-[#00ff88]" />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Lending Pools */}
          <motion.div variants={staggerItem}>
            <Card noPadding>
              <CardHeader className="p-4 border-b border-[#262626]">
                <div className="flex items-center justify-between">
                  <CardTitle>Lending Pools</CardTitle>
                  <Badge variant="info" dot>
                    3 Active Pools
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="divide-y divide-[#1a1a1a]">
                {lendingPools.map((pool) => (
                  <div
                    key={pool.id}
                    className="p-4 hover:bg-[#0a0a0a] transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                      {/* Pool Info */}
                      <div className="flex items-center gap-4 lg:w-1/4">
                        <span className="text-3xl">{pool.icon}</span>
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
                            {formatCurrency(pool.totalLiquidity)}
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
                                className="h-full bg-gradient-to-r from-[#ff3e00] to-[#00ff88]"
                                style={{ width: `${pool.utilization}%` }}
                              />
                            </div>
                            <span className="text-xs text-white font-mono">
                              {pool.utilization}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Your Position */}
                      {(pool.yourDeposit > 0 || pool.yourBorrow > 0) && (
                        <div className="p-3 bg-[#0a0a0a] border border-[#262626] rounded-lg lg:w-48">
                          <p className="text-[10px] text-neutral-600 mb-2 uppercase tracking-wider">
                            Your Position
                          </p>
                          {pool.yourDeposit > 0 && (
                            <p className="text-xs text-white font-mono">
                              Supplied:{" "}
                              {hideBalances
                                ? "••••"
                                : formatCurrency(pool.yourDeposit)}
                            </p>
                          )}
                          {pool.yourBorrow > 0 && (
                            <p className="text-xs text-amber-400 font-mono">
                              Borrowed:{" "}
                              {hideBalances
                                ? "••••"
                                : formatCurrency(pool.yourBorrow)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 lg:w-auto">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openPoolAction(pool, "supply")}
                        >
                          Supply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPoolAction(pool, "borrow")}
                        >
                          Borrow
                        </Button>
                        {pool.yourDeposit > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPoolAction(pool, "withdraw")}
                          >
                            Withdraw
                          </Button>
                        )}
                        {pool.yourBorrow > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPoolAction(pool, "repay")}
                          >
                            Repay
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* ZK Privacy Info */}
          <motion.div variants={staggerItem}>
            <Card variant="gradient">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Shield className="w-5 h-5 text-blue-400" />
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

          {/* Audit Logs */}
          <motion.div variants={staggerItem}>
            <Card noPadding>
              <CardHeader className="p-4 border-b border-[#262626]">
                <button
                  onClick={() => setShowAuditLogs(!showAuditLogs)}
                  className="w-full flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-neutral-500" />
                    <CardTitle>Audit Logs</CardTitle>
                  </div>
                  {showAuditLogs ? (
                    <ChevronUp className="w-4 h-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  )}
                </button>
              </CardHeader>
              <AnimatePresence>
                {showAuditLogs && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="divide-y divide-[#1a1a1a]">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-4 flex items-center gap-4"
                        >
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              log.action === "Deposit" ||
                                log.action === "Supply"
                                ? "bg-[#00ff88]/10"
                                : log.action === "Borrow"
                                  ? "bg-amber-500/10"
                                  : "bg-[#1a1a1a]",
                            )}
                          >
                            {log.status === "completed" ? (
                              <CheckCircle2
                                className={cn(
                                  "w-4 h-4",
                                  log.action === "Deposit" ||
                                    log.action === "Supply"
                                    ? "text-[#00ff88]"
                                    : log.action === "Borrow"
                                      ? "text-amber-400"
                                      : "text-neutral-500",
                                )}
                              />
                            ) : (
                              <Clock className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {log.action}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {log.pool}
                              </Badge>
                            </div>
                            <p className="text-xs text-neutral-500 font-mono">
                              {log.timestamp}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-white font-mono">
                              {formatCurrency(log.amount)}
                            </p>
                            <a
                              href="#"
                              className="text-[10px] text-[#ff3e00] hover:underline font-mono cursor-pointer"
                            >
                              {log.txHash}
                            </a>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </motion.div>
      </main>
      <Footer />

      {/* Modals */}
      <YieldCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
      <PoolActionModal
        pool={selectedPool}
        action={actionType}
        isOpen={!!selectedPool}
        onClose={() => setSelectedPool(null)}
      />
    </motion.div>
  );
}
