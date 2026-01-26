"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
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
import { useWallet } from "@/context/WalletContext";
import {
  formatCurrency,
  formatPercentage,
  cn,
  truncateAddress,
} from "@/lib/utils";
import {
  pageTransition,
  staggerContainer,
  staggerItem,
  fadeInUp,
} from "@/lib/animations";

// Mock portfolio data
const portfolioData = {
  totalValue: 45320.5,
  totalChange: 12.5,
  properties: [
    {
      id: 1,
      name: "Lagos Waterfront Apartments",
      location: "Lagos, Nigeria",
      shares: 150,
      value: 15000,
      yield: 8.2,
      change: 5.3,
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400",
    },
    {
      id: 2,
      name: "Mexico City Commercial",
      location: "CDMX, Mexico",
      shares: 200,
      value: 20000,
      yield: 7.5,
      change: 8.1,
      image:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400",
    },
    {
      id: 3,
      name: "Nairobi Tech Hub",
      location: "Nairobi, Kenya",
      shares: 100,
      value: 10320.5,
      yield: 9.1,
      change: -2.1,
      image:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400",
    },
  ],
  loans: [
    {
      id: 1,
      collateral: "Lagos Waterfront Apartments",
      borrowed: 5000,
      interest: 4.5,
      dueDate: "2025-03-15",
      healthFactor: 1.85,
    },
  ],
};

const kycStatus = {
  status: "verified",
  level: "Tier 2",
  verifiedAt: "2024-12-01",
  documents: [
    { name: "ID Verification", status: "verified" },
    { name: "Address Proof", status: "verified" },
    { name: "Accreditation", status: "pending" },
  ],
};

export default function DashboardPage() {
  const { address, balance, isConnected, connect, isConnecting } = useWallet();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

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
                Welcome back! Here&apos;s your portfolio overview.
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                      className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-white transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href="#"
                      className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-white transition-colors cursor-pointer"
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
                    {showBalance ? formatCurrency(balance) : "******"}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            variants={staggerItem}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-neutral-600 uppercase tracking-wider">
                    Portfolio Value
                  </p>
                  <p className="text-xl font-bold text-white mt-1 font-mono">
                    {showBalance
                      ? formatCurrency(portfolioData.totalValue)
                      : "******"}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1 flex items-center gap-1",
                      portfolioData.totalChange >= 0
                        ? "text-[#00ff88]"
                        : "text-red-400",
                    )}
                  >
                    {portfolioData.totalChange >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {formatPercentage(portfolioData.totalChange)}
                  </p>
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
                    Properties Owned
                  </p>
                  <p className="text-xl font-bold text-white mt-1 font-mono">
                    {portfolioData.properties.length}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">
                    Across 3 countries
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
                    8.3%
                  </p>
                  <p className="text-xs text-[#00ff88] mt-1">
                    +0.5% this month
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
                    Active Loans
                  </p>
                  <p className="text-xl font-bold text-white mt-1 font-mono">
                    {portfolioData.loans.length}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">
                    {formatCurrency(5000)} borrowed
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Portfolio */}
            <motion.div variants={staggerItem} className="lg:col-span-2">
              <Card noPadding>
                <CardHeader className="p-4 border-b border-[#262626]">
                  <CardTitle>Your Properties</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-[#1a1a1a]">
                  {portfolioData.properties.map((property) => (
                    <div
                      key={property.id}
                      className="p-4 flex items-center gap-4 hover:bg-[#0a0a0a] transition-colors cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-lg bg-[#1a1a1a] overflow-hidden flex-shrink-0">
                        <Image
                          src={property.image}
                          alt={property.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white truncate">
                          {property.name}
                        </h3>
                        <p className="text-xs text-neutral-500">
                          {property.location}
                        </p>
                        <p className="text-[10px] text-neutral-600 mt-1 font-mono">
                          {property.shares} shares
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white font-mono">
                          {showBalance
                            ? formatCurrency(property.value)
                            : "****"}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-mono",
                            property.change >= 0
                              ? "text-[#00ff88]"
                              : "text-red-400",
                          )}
                        >
                          {formatPercentage(property.change)}
                        </p>
                        <Badge variant="success" className="mt-1">
                          {property.yield}% APY
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* KYC Status */}
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>KYC Status</CardTitle>
                    <Badge
                      variant={
                        kycStatus.status === "verified" ? "success" : "warning"
                      }
                      dot
                    >
                      {kycStatus.level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg">
                    <Shield className="w-4 h-4 text-[#00ff88]" />
                    <div>
                      <p className="text-xs font-medium text-white">
                        Identity Verified
                      </p>
                      <p className="text-[10px] text-neutral-600 font-mono">
                        Since {kycStatus.verifiedAt}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {kycStatus.documents.map((doc) => (
                      <div
                        key={doc.name}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-xs text-neutral-400">
                          {doc.name}
                        </span>
                        {doc.status === "verified" ? (
                          <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                        ) : doc.status === "pending" ? (
                          <Clock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full" size="sm">
                    Upgrade to Tier 3
                  </Button>
                </CardContent>
              </Card>

              {/* Active Loans */}
              {portfolioData.loans.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Active Loans</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {portfolioData.loans.map((loan) => (
                      <div
                        key={loan.id}
                        className="p-3 bg-[#0a0a0a] border border-[#262626] rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Collateral
                          </span>
                          <span className="text-xs text-white">
                            {loan.collateral}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Borrowed
                          </span>
                          <span className="text-xs font-medium text-white font-mono">
                            {formatCurrency(loan.borrowed)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Interest
                          </span>
                          <span className="text-xs text-white font-mono">
                            {loan.interest}% APR
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">
                            Health Factor
                          </span>
                          <Badge
                            variant={
                              loan.healthFactor >= 1.5 ? "success" : "warning"
                            }
                          >
                            {loan.healthFactor.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    ))}
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
