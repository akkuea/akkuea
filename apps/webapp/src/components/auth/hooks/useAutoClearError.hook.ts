"use client";

import { useEffect } from "react";

const DEFAULT_ERROR_TTL_MS = 5_000;

/** Clears a displayed error after a short TTL so stale messages do not linger. */
export function useAutoClearError(
  error: string | null | undefined,
  onClear: () => void,
  ttlMs = DEFAULT_ERROR_TTL_MS,
) {
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onClear, ttlMs);
    return () => clearTimeout(timer);
  }, [error, onClear, ttlMs]);
}
