"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Building2,
  TrendingUp,
  DollarSign,
  PieChart,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Navbar, Footer } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
} from "@/components/ui";
import { useWallet } from "@/components/auth/hooks";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import {
  AllocationChart,
  PropertyReportCard,
  StatsSkeleton,
  PropertiesListSkeleton,
} from "@/components/portfolio";
import { formatCurrency, cn, truncateAddress } from "@/lib/utils";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
  fadeInUp,
} from "@/lib/animations";

export default function DashboardPage() {
  const { address, balance, isConnected, connect, isConnecting } = useWallet();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const { properties, borrows, summary, isLoading, error, refetch } =
    usePortfolio(isConnected ? address : null);
  const { healthFactor, status: hfStatus } = useHealthFactor(borrows);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
            <h1 className="text-2xl font-bold text-white mb-3">
              Connect Your Wallet
            </h1>
            <p className="text-sm text-neutral-500 max-w-md mb-8">
              Connect your Stellar wallet to view your portfolio, manage
              investments, and access DeFi features.
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

  const hfColor =
    hfStatus === "safe"
      ? "text-[#00ff88]"
      : hfStatus === "warning"
        ? "text-amber-400"
        : hfStatus === "critical"
          ? "text-red-400"
          : "text-neutral-500";

  const hfBg =
    hfStatus === "safe"
      ? "bg-[#00ff88]/10 border-[#00ff88]/20"
      : hfStatus === "warning"
        ? "bg-amber-500/10 border-amber-500/20"
        : hfStatus === "critical"
          ? "bg-red-500/10 border-red-500/20"
          : "bg-neutral-800/50 border-neutral-700";

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
          className="space-y-6"
        >
          {/* Header */}
          <motion.div
            variants={staggerItem}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Your portfolio overview
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                aria-label="Refresh"
              >
                <RefreshCw
                  className={cn("w-4 h-4", isLoading && "animate-spin")}
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBalance(!showBalance)}
              >
                {showBalance ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </motion.div>

          {/* Error banner */}
          {error && (
            <motion.div
              variants={staggerItem}
              className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
              <button
                onClick={refetch}
                className="ml-auto text-xs text-red-400 underline"
              >
                Retry
              </button>
            </motion.div>
          )}

          {/* Wallet Card */}
          <motion.div variants={staggerItem}>
            <Card variant="gradient" className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff3e00]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <p className="text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">
                    Wallet Address
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">
                      {truncateAddress(address || "", 8)}
                    </span>
                    <button
                      onClick={copyAddress}
                      className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-white transition-colors"
                      aria-label="Copy address"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={`https://stellar.expert/explorer/public/account/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-white transition-colors"
                      aria-label="View on explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">
                    Wallet Balance
                  </p>
                  <p className="text-xl font-bold text-white font-mono">
                    {showBalance
                      ? formatCurrency(parseFloat(balance || "0"))
                      : "••••••"}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={staggerItem}>
            {isLoading && properties.length === 0 ? (
              <StatsSkeleton />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        Portfolio Value
                      </p>
                      <p className="text-xl font-bold text-white mt-1 font-mono">
                        {showBalance
                          ? formatCurrency(summary.totalValue)
                          : "••••••"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">Estimated</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20">
                      <DollarSign className="w-4 h-4 text-[#00ff88]" />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        Properties
                      </p>
                      <p className="text-xl font-bold text-white mt-1 font-mono">
                        {summary.propertyCount}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 font-mono">
                        {summary.propertyCount === 0
                          ? "No holdings"
                          : `${summary.propertyCount} asset${summary.propertyCount !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#ff3e00]/10 border border-[#ff3e00]/20">
                      <Building2 className="w-4 h-4 text-[#ff3e00]" />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        Avg. Yield
                      </p>
                      <p className="text-xl font-bold text-white mt-1 font-mono">
                        {summary.avgYield > 0
                          ? `${summary.avgYield.toFixed(2)}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Supply APY
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <PieChart className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                        Health Factor
                      </p>
                      <p
                        className={cn(
                          "text-xl font-bold mt-1 font-mono",
                          hfColor,
                        )}
                      >
                        {hfStatus === "none"
                          ? "—"
                          : isFinite(healthFactor)
                            ? healthFactor.toFixed(2)
                            : "∞"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 capitalize">
                        {hfStatus === "none" ? "No borrows" : hfStatus}
                      </p>
                    </div>
                    <div className={cn("p-2 rounded-lg border", hfBg)}>
                      <TrendingUp className={cn("w-4 h-4", hfColor)} />
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </motion.div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Properties List */}
            <motion.div variants={staggerItem} className="lg:col-span-2">
              <Card noPadding>
                <CardHeader className="p-4 border-b border-[#262626]">
                  <div className="flex items-center justify-between">
                    <CardTitle>Your Properties</CardTitle>
                    {summary.totalBorrowed > 0 && (
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {showBalance
                          ? `${formatCurrency(summary.totalBorrowed)} borrowed`
                          : "••••"}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="divide-y divide-[#1a1a1a]">
                  {isLoading && properties.length === 0 ? (
                    <PropertiesListSkeleton />
                  ) : properties.length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <Building2 className="w-8 h-8 text-neutral-700 mb-3" />
                      <p className="text-sm text-neutral-500">
                        No properties in your portfolio yet.
                      </p>
                      <p className="text-xs text-neutral-600 mt-1">
                        Browse the marketplace to start investing.
                      </p>
                    </div>
                  ) : (
                    properties.map((item) => (
                      <PropertyReportCard
                        key={item.property.id}
                        item={item}
                        showValue={showBalance}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column */}
            <motion.div variants={staggerItem} className="space-y-4">
              {/* Allocation Chart */}
              {(properties.length > 0 || isLoading) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Allocation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoading && properties.length === 0 ? (
                      <div className="flex justify-center py-4">
                        <div className="w-24 h-24 rounded-full bg-[#1a1a1a] animate-pulse" />
                      </div>
                    ) : (
                      <AllocationChart
                        allocation={summary.allocationByType}
                        totalValue={summary.totalValue}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Active Borrows */}
              {borrows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Active Loans</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {borrows.map((borrow) => (
                      <div
                        key={borrow.id}
                        className="p-3 bg-[#0a0a0a] border border-[#262626] rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Borrowed
                          </span>
                          <span className="text-xs font-medium text-white font-mono">
                            {showBalance
                              ? formatCurrency(parseFloat(borrow.principal))
                              : "••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Accrued Interest
                          </span>
                          <span className="text-xs text-amber-400 font-mono">
                            {showBalance
                              ? formatCurrency(
                                  parseFloat(borrow.accruedInterest),
                                )
                              : "••••"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Health Factor
                          </span>
                          <Badge
                            variant={
                              borrow.healthFactor >= 1.5
                                ? "success"
                                : borrow.healthFactor >= 1.1
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {borrow.healthFactor.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Deposits */}
              {summary.totalDeposited > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Deposits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 p-3 bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg">
                      <Shield className="w-4 h-4 text-[#00ff88] shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-white">
                          Total Deposited
                        </p>
                        <p className="text-sm font-bold text-[#00ff88] font-mono mt-0.5">
                          {showBalance
                            ? formatCurrency(summary.totalDeposited)
                            : "••••••"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state */}
              {!isLoading &&
                properties.length === 0 &&
                borrows.length === 0 &&
                summary.totalDeposited === 0 && (
                  <Card>
                    <CardContent className="py-6 text-center space-y-3">
                      <div className="flex items-center gap-2 justify-center text-neutral-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <Clock className="w-4 h-4" />
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-neutral-500">
                        Activity will appear here once you start investing.
                      </p>
                    </CardContent>
                  </Card>
                )}
            </motion.div>
          </div>
        </motion.div>
      </main>
      <Footer />
    </motion.div>
  );
}
