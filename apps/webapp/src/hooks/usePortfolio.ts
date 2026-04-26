"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  PropertyInfo,
  BorrowPosition,
  DepositPosition,
} from "@real-estate-defi/shared";
import { propertyApi } from "@/services/api/properties";
import { lendingApi } from "@/services/api/lending";
import { userApi } from "@/services/api/users";

export interface PortfolioProperty {
  property: PropertyInfo;
  shares: number;
  /** Estimated value = shares * pricePerShare */
  estimatedValue: number;
  /** Yield from pool supplyAPY if available, else 0 */
  yieldRate: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalBorrowed: number;
  totalDeposited: number;
  avgYield: number;
  propertyCount: number;
  allocationByType: Record<string, number>;
}

export interface UsePortfolioReturn {
  properties: PortfolioProperty[];
  borrows: BorrowPosition[];
  deposits: DepositPosition[];
  summary: PortfolioSummary;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY_SUMMARY: PortfolioSummary = {
  totalValue: 0,
  totalBorrowed: 0,
  totalDeposited: 0,
  avgYield: 0,
  propertyCount: 0,
  allocationByType: {},
};

export function usePortfolio(userAddress?: string | null): UsePortfolioReturn {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [borrows, setBorrows] = useState<BorrowPosition[]>([]);
  const [deposits, setDeposits] = useState<DepositPosition[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!userAddress) {
      setProperties([]);
      setBorrows([]);
      setDeposits([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch portfolio index, all properties, and lending pools in parallel
        const [portfolioIndex, allProperties, pools] = await Promise.all([
          userApi.getPortfolio(userAddress!).catch(() => ({
            properties: [],
            deposits: [],
            borrows: [],
          })),
          propertyApi.getAll({ limit: 100 }).catch(() => ({ data: [] })),
          lendingApi.getPools().catch(() => []),
        ]);

        if (cancelled) return;

        // Build a map for quick lookup
        const propertyMap = new Map(allProperties.data.map((p) => [p.id, p]));

        // Resolve portfolio properties with estimated values
        const portfolioProperties: PortfolioProperty[] =
          portfolioIndex.properties
            .map(({ propertyId, shares }) => {
              const property = propertyMap.get(propertyId);
              if (!property) return null;
              const pricePerShare = parseFloat(property.pricePerShare);
              const estimatedValue = shares * pricePerShare;
              return { property, shares, estimatedValue, yieldRate: 0 };
            })
            .filter((p): p is PortfolioProperty => p !== null);

        // Fetch user positions across all pools
        const positionResults = await Promise.all(
          pools.map(async (pool) => {
            const [userDeposits, userBorrows] = await Promise.all([
              lendingApi
                .getUserDeposits(pool.id, userAddress!)
                .catch(() => [] as DepositPosition[]),
              lendingApi
                .getUserBorrows(pool.id, userAddress!)
                .catch(() => [] as BorrowPosition[]),
            ]);
            return { pool, userDeposits, userBorrows };
          }),
        );

        if (cancelled) return;

        const allBorrows = positionResults.flatMap((r) => r.userBorrows);
        const allDeposits = positionResults.flatMap((r) => r.userDeposits);

        // Compute summary
        const totalValue = portfolioProperties.reduce(
          (s, p) => s + p.estimatedValue,
          0,
        );
        const totalBorrowed = allBorrows.reduce(
          (s, b) => s + parseFloat(b.principal) + parseFloat(b.accruedInterest),
          0,
        );
        const totalDeposited = allDeposits.reduce(
          (s, d) => s + parseFloat(d.amount) + parseFloat(d.accruedInterest),
          0,
        );

        // Allocation by property type
        const allocationByType: Record<string, number> = {};
        for (const { property, estimatedValue } of portfolioProperties) {
          const type = property.propertyType;
          allocationByType[type] =
            (allocationByType[type] ?? 0) + estimatedValue;
        }

        // Avg yield: weighted by deposit amount across pools
        let weightedYield = 0;
        let totalDepositWeight = 0;
        for (const { pool, userDeposits } of positionResults) {
          const depositTotal = userDeposits.reduce(
            (s, d) => s + parseFloat(d.amount),
            0,
          );
          if (depositTotal > 0) {
            weightedYield += pool.supplyAPY * depositTotal;
            totalDepositWeight += depositTotal;
          }
        }
        const avgYield =
          totalDepositWeight > 0 ? weightedYield / totalDepositWeight : 0;

        setProperties(portfolioProperties);
        setBorrows(allBorrows);
        setDeposits(allDeposits);
        setSummary({
          totalValue,
          totalBorrowed,
          totalDeposited,
          avgYield,
          propertyCount: portfolioProperties.length,
          allocationByType,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load portfolio.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userAddress, fetchKey]);

  return { properties, borrows, deposits, summary, isLoading, error, refetch };
}
