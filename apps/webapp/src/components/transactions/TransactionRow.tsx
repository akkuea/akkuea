"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Banknote,
  Zap,
  ShoppingCart,
  Tag,
  Gift,
  ExternalLink,
} from "lucide-react";
import type { Transaction } from "@real-estate-defi/shared";
import { Badge } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

/** Stellar Expert explorer base URL (testnet) */
const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/testnet/tx";

/** Config for each transaction type — icon, colour, label */
const TYPE_CONFIG: Record<
  Transaction["type"],
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    label: string;
  }
> = {
  deposit: {
    icon: ArrowDownLeft,
    color: "text-[#00ff88]",
    bg: "bg-[#00ff88]/10",
    label: "Deposit",
  },
  withdraw: {
    icon: ArrowUpRight,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    label: "Withdraw",
  },
  borrow: {
    icon: Banknote,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    label: "Borrow",
  },
  repay: {
    icon: Repeat,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Repay",
  },
  liquidation: {
    icon: Zap,
    color: "text-red-400",
    bg: "bg-red-500/10",
    label: "Liquidation",
  },
  buy_shares: {
    icon: ShoppingCart,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    label: "Buy Shares",
  },
  sell_shares: {
    icon: Tag,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    label: "Sell Shares",
  },
  dividend: {
    icon: Gift,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Dividend",
  },
};

const STATUS_VARIANT: Record<
  Transaction["status"],
  "success" | "warning" | "danger" | "info" | "outline"
> = {
  confirmed: "success",
  pending: "warning",
  submitting: "info",
  failed: "danger",
  not_found: "outline",
};

/** Shorten a 64-char hex hash for display */
function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

export interface TransactionRowProps {
  transaction: Transaction;
}

/**
 * Renders a single transaction row with type badge, amount, status,
 * timestamp, and a clickable hash linking to Stellar Expert.
 */
export function TransactionRow({ transaction }: TransactionRowProps) {
  const cfg = TYPE_CONFIG[transaction.type];
  const Icon = cfg.icon;
  const statusVariant = STATUS_VARIANT[transaction.status];

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-[#0a0a0a] transition-colors">
      {/* Type icon */}
      <div
        className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-4 h-4 ${cfg.color}`} aria-hidden="true" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">{cfg.label}</span>
          <Badge variant={statusVariant} className="text-[10px]">
            {transaction.status}
          </Badge>
        </div>
        <p className="text-xs text-neutral-500 font-mono mt-0.5">
          {new Date(transaction.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Amount + asset */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-medium text-white font-mono">
          {formatCurrency(parseFloat(transaction.amount))}{" "}
          <span className="text-neutral-500 text-xs">{transaction.asset}</span>
        </p>

        {/* Hash → Stellar Expert link */}
        {transaction.hash ? (
          <a
            href={`${STELLAR_EXPERT_BASE}/${transaction.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-[#ff3e00] hover:underline font-mono mt-0.5"
            aria-label={`View transaction ${transaction.hash} on Stellar Expert`}
          >
            {shortenHash(transaction.hash)}
            <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-[10px] text-neutral-600 font-mono mt-0.5">
            No hash
          </span>
        )}
      </div>
    </div>
  );
}
