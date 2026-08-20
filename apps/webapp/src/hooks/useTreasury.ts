"use client";

import { useCallback, useEffect, useState } from "react";
import {
  treasuryApi,
  type TreasuryHistory,
  type TreasuryPortfolio,
} from "@/services/api/treasury";

export interface UseTreasuryReturn {
  portfolio: TreasuryPortfolio | null;
  history: TreasuryHistory | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads the treasury position and its recorded history.
 *
 * The portfolio is the load-bearing call: if it fails there is nothing honest
 * to display, so its failure is the hook's error. History is supplementary, so
 * a history failure leaves `history` null rather than blanking the panel.
 */
export function useTreasury(): UseTreasuryReturn {
  const [portfolio, setPortfolio] = useState<TreasuryPortfolio | null>(null);
  const [history, setHistory] = useState<TreasuryHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [nextPortfolio, nextHistory] = await Promise.all([
          treasuryApi.getPortfolio(),
          treasuryApi.getHistory().catch(() => null),
        ]);

        if (cancelled) return;
        setPortfolio(nextPortfolio);
        setHistory(nextHistory);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not read the treasury position.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  return { portfolio, history, isLoading, error, refetch };
}
