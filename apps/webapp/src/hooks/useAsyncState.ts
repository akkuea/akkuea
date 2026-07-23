"use client";

import { useCallback, useRef, useState } from "react";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

interface UseAsyncStateOptions<T> {
  /** Given successfully-loaded data, is it "empty" for UI purposes? */
  isEmpty?: (data: T | null) => boolean;
}

interface UseAsyncStateResult<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  isSuccess: boolean;
  /** Run the async function. Callers decide when (mount, param change, retry click). */
  execute: () => Promise<T | undefined>;
  /** Alias for execute — reads better at retry call sites. */
  retry: () => Promise<T | undefined>;
  /** Push new data in directly (e.g. from a live-update stream) without a loading flash. */
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function useAsyncState<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncStateOptions<T> = {},
): UseAsyncStateResult<T> {
  const { isEmpty: isEmptyFn } = options;
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Depends on asyncFn's identity so callers whose fetcher changes (e.g. a
  // route param changes) get a fresh `execute` — see property detail page.
  const execute = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setError(null);
    try {
      const result = await asyncFn();
      if (requestId !== requestIdRef.current) {
        return undefined;
      }
      setData(result);
      setStatus("success");
      return result;
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return undefined;
      }
      setError(getErrorMessage(err));
      setStatus("error");
      return undefined;
    }
  }, [asyncFn]);

  const setDataDirectly = useCallback(
    (updater: T | ((prev: T | null) => T)) => {
      setData((prev) =>
        typeof updater === "function"
          ? (updater as (prev: T | null) => T)(prev)
          : updater,
      );
      setStatus("success");
    },
    [],
  );

  const isEmptyResult =
    status === "success" && (isEmptyFn ? isEmptyFn(data) : false);

  return {
    status,
    data,
    error,
    isLoading: status === "idle" || status === "loading",
    isError: status === "error",
    isEmpty: isEmptyResult,
    isSuccess: status === "success" && !isEmptyResult,
    execute,
    retry: execute,
    setData: setDataDirectly,
  };
}
