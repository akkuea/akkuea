import "@/test/setup-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createTransaction } from "@akkuea/shared";
import { transactionsApi } from "@/services/api";
import { useTransactions } from "../useTransactions";

let getTransactions: ReturnType<typeof spyOn>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useTransactions regression tests", () => {
  beforeEach(() => {
    getTransactions = spyOn(transactionsApi, "getTransactions");
  });

  afterEach(() => {
    cleanup();
    mock.restore();
  });

  it("refetches when pageSize changes", async () => {
    getTransactions.mockResolvedValue({ items: [], nextCursor: undefined });

    const { rerender } = renderHook(
      ({ pageSize }: { pageSize: number }) =>
        useTransactions(undefined, pageSize),
      { initialProps: { pageSize: 20 } },
    );

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledTimes(1);
    });

    rerender({ pageSize: 50 });

    await waitFor(() => {
      expect(getTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });
  });

  it("drops a stale response after the filter changes", async () => {
    const oldRequest = deferred<{
      items: ReturnType<typeof createTransaction>[];
      nextCursor: undefined;
    }>();
    const newerTransaction = createTransaction({
      id: "550e8400-e29b-41d4-a716-000000000001",
      type: "withdraw",
    });
    const olderTransaction = createTransaction({
      id: "550e8400-e29b-41d4-a716-000000000002",
      type: "deposit",
    });

    getTransactions
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce({
        items: [newerTransaction],
        nextCursor: undefined,
      });

    const initialProps: {
      filter: { type: "deposit" | "withdraw" };
    } = { filter: { type: "deposit" } };
    const { result, rerender } = renderHook(
      ({ filter }) => useTransactions(filter),
      { initialProps },
    );

    await waitFor(() => {
      expect(getTransactions).toHaveBeenCalledTimes(1);
    });

    rerender({ filter: { type: "withdraw" } });

    await waitFor(() => {
      expect(result.current.transactions).toEqual([newerTransaction]);
    });

    await act(async () => {
      oldRequest.resolve({
        items: [olderTransaction],
        nextCursor: undefined,
      });
      await oldRequest.promise;
    });

    expect(result.current.transactions).toEqual([newerTransaction]);
  });
});
