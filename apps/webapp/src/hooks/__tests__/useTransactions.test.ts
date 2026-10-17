import "@/test/setup-dom";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

type ApiResult = {
  items: unknown[];
  nextCursor?: string;
};

const getTransactions =
  mock<(params?: unknown) => Promise<ApiResult>>();

mock.module("@/services/api", () => ({
  transactionsApi: { getTransactions },
}));

const hookModulePath: string =
  "../useTransactions.ts?transactions-regression-tests";
const { useTransactions } = await import(hookModulePath);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useTransactions regression tests", () => {
  beforeEach(() => {
    getTransactions.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("refetches when pageSize changes", async () => {
    getTransactions.mockImplementation(async () => ({ items: [] }));

    const { rerender } = renderHook(
      ({ pageSize }: { pageSize: number }) =>
        useTransactions(undefined, pageSize),
      { initialProps: { pageSize: 10 } },
    );

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledTimes(1);
    });

    expect(getTransactions.mock.calls[0][0]).toEqual(
      expect.objectContaining({ limit: 10 }),
    );

    rerender({ pageSize: 25 });

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledTimes(2);
    });

    expect(getTransactions.mock.calls[1][0]).toEqual(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("ignores stale responses when requests finish out of order", async () => {
    const oldRequest = deferred<ApiResult>();
    const newRequest = deferred<ApiResult>();

    getTransactions
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => newRequest.promise);

    const { result, rerender } = renderHook(
      ({ pageSize }: { pageSize: number }) =>
        useTransactions(undefined, pageSize),
      { initialProps: { pageSize: 10 } },
    );

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledTimes(1);
    });

    rerender({ pageSize: 25 });

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledTimes(2);
    });

    const newerTransaction = {
      id: "newer-response",
    } as ApiResult["items"][number];
    const olderTransaction = {
      id: "older-response",
    } as ApiResult["items"][number];

    await act(async () => {
      newRequest.resolve({ items: [newerTransaction] });
      await newRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.transactions).toEqual([newerTransaction]);
    });

    await act(async () => {
      oldRequest.resolve({ items: [olderTransaction] });
      await oldRequest.promise;
    });

    expect(result.current.transactions).toEqual([newerTransaction]);
  });
});
