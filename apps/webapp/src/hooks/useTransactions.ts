"use client";

import { useState, useEffect, useCallback } from "react";
import type { Transaction, TransactionFilter } from "@real-estate-defi/shared";
import { transactionsApi } from "@/services/api";

export interface UseTransactionsReturn {
  /** Accumulated list of transactions across all loaded pages */
  transactions: Transaction[];
  /** True while any fetch is in-flight */
  isLoading: boolean;
  /** Non-null when the latest fetch has failed */
  error: string | null;
  /** True when there is a next page available */
  hasMore: boolean;
  /** Load the next page and append results */
  loadMore: () => void;
  /** Re-fetch from the beginning (resets cursor) */
  refetch: () => void;
}

/**
 * Fetches paginated transactions from the API.
 *
 * @param filter   - Optional filter (type, status, from, to, asset, since, until)
 * @param pageSize - Number of items per page (default 20)
 */
export function useTransactions(
  filter?: TransactionFilter,
  pageSize = 20,
): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  /** Stable serialisation of the filter for the dependency array */
  const filterKey = filter ? JSON.stringify(filter) : "";

  /** Reset everything and re-fetch from page 1 */
  const refetch = useCallback(() => {
    setTransactions([]);
    setCursor(undefined);
    setHasMore(false);
    setError(null);
    setFetchKey((k) => k + 1);
  }, []);

  /** Fetch a page (initial or next) */
  const fetchPage = useCallback(
    async (nextCursor?: string, append = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await transactionsApi.getTransactions({
          ...filter,
          limit: pageSize,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        });

        setTransactions((prev) =>
          append ? [...prev, ...result.items] : result.items,
        );
        setCursor(result.nextCursor);
        setHasMore(!!result.nextCursor);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load transactions. Please try again.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey, pageSize],
  );

  /** Initial fetch (and re-fetch when filter/key changes) */
  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey, filterKey]);

  /** Load more — appends next page */
  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && cursor) {
      fetchPage(cursor, true);
    }
  }, [isLoading, hasMore, cursor, fetchPage]);

  return { transactions, isLoading, error, hasMore, loadMore, refetch };
}
