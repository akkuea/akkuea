import { formatCycleId } from "@/services/pilot/cycles";

/**
 * The cycle the ally is currently reporting on.
 *
 * The month just ended is the one with income to report, so the current
 * calendar month is not it: on 3 April the ally is reporting March.
 */
export function currentCycleId(now: Date = new Date()): string {
  const month = now.getUTCMonth();
  return month === 0
    ? formatCycleId(now.getUTCFullYear() - 1, 12)
    : formatCycleId(now.getUTCFullYear(), month);
}
