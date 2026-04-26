"use client";

import { useMemo } from "react";
import type { BorrowPosition } from "@real-estate-defi/shared";

export type HealthFactorStatus = "safe" | "warning" | "critical" | "none";

export interface UseHealthFactorReturn {
  /**
   * Computed health factor:
   *  - Infinity when there are no open borrows (no risk)
   *  - `sum(collateralAmount * liquidationThreshold%) / sum(principal + accruedInterest)`
   *    uses the pool-level `liquidationThreshold` from the borrow position record.
   *    Since `BorrowPosition` carries a `healthFactor` already, we can average those.
   */
  healthFactor: number;
  /** Human-readable status tier */
  status: HealthFactorStatus;
}

/**
 * Derives a single aggregate health factor from all open borrow positions.
 *
 * We average the individual `healthFactor` values reported by the API
 * (each `BorrowPosition` already carries a computed healthFactor from the
 * contract), weighted by principal. If there are no borrows, returns Infinity.
 */
export function useHealthFactor(
  allBorrows: BorrowPosition[],
): UseHealthFactorReturn {
  return useMemo(() => {
    const openBorrows = allBorrows.filter((b) => parseFloat(b.principal) > 0);

    if (openBorrows.length === 0) {
      return { healthFactor: Infinity, status: "none" as HealthFactorStatus };
    }

    // Weighted average by principal
    let totalWeight = 0;
    let weightedHF = 0;

    for (const borrow of openBorrows) {
      const principal = parseFloat(borrow.principal);
      const accruedInterest = parseFloat(borrow.accruedInterest);
      const debt = principal + accruedInterest;

      if (debt > 0) {
        totalWeight += debt;
        weightedHF += borrow.healthFactor * debt;
      }
    }

    const hf = totalWeight > 0 ? weightedHF / totalWeight : Infinity;
    const rounded = Math.round(hf * 100) / 100;

    let status: HealthFactorStatus;
    if (!isFinite(rounded)) {
      status = "none";
    } else if (rounded >= 1.5) {
      status = "safe";
    } else if (rounded >= 1.1) {
      status = "warning";
    } else {
      status = "critical";
    }

    return { healthFactor: rounded, status };
  }, [allBorrows]);
}
