"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  PortfolioPerformancePoint,
  PortfolioPerformanceResponse,
} from "@/mocks/fixtures/portfolioPerformance";

export type { PortfolioPerformancePoint, PortfolioPerformanceResponse };

export type TimeRange = "1M" | "3M" | "ALL";

const TIME_RANGE_DAYS: Record<TimeRange, number> = {
  "1M": 30,
  "3M": 90,
  ALL: Infinity,
};

export interface UsePortfolioPerformanceReturn {
  data: PortfolioPerformancePoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function usePortfolioPerformance(
  walletAddress: string | null | undefined,
  range: TimeRange = "3M",
): UsePortfolioPerformanceReturn {
  const [data, setData] = useState<PortfolioPerformancePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!walletAddress) {
      const timer = setTimeout(() => {
        setData([]);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const url = `${API_BASE}/portfolio/performance?address=${encodeURIComponent(walletAddress!)}`;
        const res = await fetch(url);

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(
            body.message ?? `Failed to load performance data (${res.status})`,
          );
        }

        const json = (await res.json()) as PortfolioPerformanceResponse;

        if (cancelled) return;

        // Trim to the requested time range
        const maxDays = TIME_RANGE_DAYS[range];
        const trimmed =
          maxDays === Infinity
            ? json.points
            : json.points.slice(-maxDays);

        setData(trimmed);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load portfolio performance.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, range, fetchKey]);

  return { data, isLoading, error, refetch };
}
