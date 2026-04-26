"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Inbox,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from "@/components/ui";
import type { TransactionFilter } from "@real-estate-defi/shared";
import { useTransactions } from "@/hooks/useTransactions";
import { TransactionRow } from "./TransactionRow";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Skeleton Row — shown while loading
// ---------------------------------------------------------------------------

function TransactionRowSkeleton() {
  return (
    <div
      className="p-4 flex items-center gap-4 animate-pulse"
      role="status"
      aria-label="Loading transaction"
    >
      <div className="w-10 h-10 bg-[#262626] rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-[#262626] rounded w-24" />
        <div className="h-2 bg-[#262626] rounded w-32" />
      </div>
      <div className="space-y-2 text-right">
        <div className="h-3 bg-[#262626] rounded w-20 ml-auto" />
        <div className="h-2 bg-[#262626] rounded w-28 ml-auto" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <Inbox
        className="w-8 h-8 mx-auto mb-3 text-neutral-600"
        aria-hidden="true"
      />
      <p className="text-sm text-neutral-500">No transactions yet</p>
      <p className="text-xs text-neutral-600 mt-1">
        Your transaction history will appear here once you interact with a
        lending pool.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="py-8 text-center" role="alert">
      <AlertCircle
        className="w-6 h-6 mx-auto mb-3 text-red-400"
        aria-hidden="true"
      />
      <p className="text-sm text-red-400 mb-4">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
        aria-label="Retry loading transactions"
      >
        Retry
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export interface TransactionHistoryProps {
  /** Optional filter to scope the transactions (type, status, address…) */
  filter?: TransactionFilter;
  /** Number of items per page (default 20) */
  pageSize?: number;
  /** Whether the section starts collapsed */
  defaultCollapsed?: boolean;
  /** Custom title (defaults to "Transaction History") */
  title?: string;
}

/**
 * Reusable, API-connected transaction history component.
 *
 * Renders a collapsible card with loading skeletons, empty state,
 * error state + retry, paginated transaction rows with Stellar Expert links.
 */
export function TransactionHistory({
  filter,
  pageSize = 20,
  defaultCollapsed = true,
  title = "Transaction History",
}: TransactionHistoryProps) {
  const { transactions, isLoading, error, hasMore, loadMore, refetch } =
    useTransactions(filter, pageSize);

  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  return (
    <Card noPadding>
      <CardHeader className="p-4 border-b border-[#262626]">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between cursor-pointer"
          aria-expanded={isExpanded}
          aria-controls="transaction-history-panel"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-neutral-500" aria-hidden="true" />
            <CardTitle>{title}</CardTitle>
          </div>
          {isExpanded ? (
            <ChevronUp
              className="w-4 h-4 text-neutral-500"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              className="w-4 h-4 text-neutral-500"
              aria-hidden="true"
            />
          )}
        </button>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="transaction-history-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="divide-y divide-[#1a1a1a]">
              {/* Loading state — skeleton rows */}
              {isLoading && transactions.length === 0 && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TransactionRowSkeleton key={i} />
                  ))}
                </>
              )}

              {/* Error state */}
              {error && transactions.length === 0 && (
                <ErrorState message={error} onRetry={refetch} />
              )}

              {/* Empty state */}
              {!isLoading && !error && transactions.length === 0 && (
                <EmptyState />
              )}

              {/* Transaction rows */}
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}

              {/* Load More / Loading indicator */}
              {transactions.length > 0 && (
                <div className="p-4 text-center">
                  {isLoading ? (
                    <p className="text-xs text-neutral-500">Loading more…</p>
                  ) : hasMore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      aria-label="Load more transactions"
                    >
                      Load More
                    </Button>
                  ) : (
                    <p className="text-xs text-neutral-600">
                      All transactions loaded
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
