/* eslint-disable @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

mock.module("framer-motion", () => {
  const passthroughDiv = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
    <div {...props}>{children}</div>
  );
  const passthroughButton = ({
    children,
    whileHover: _whileHover,
    whileTap: _whileTap,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    variants: _variants,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  );

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {
        div: passthroughDiv,
        button: passthroughButton,
      },
      {
        get: (target, property) =>
          property in target
            ? target[property as keyof typeof target]
            : passthroughDiv,
      },
    ),
  };
});

const { AuditLogViewer } = await import("../AuditLogViewer");

function mockFetchOk(payload: unknown) {
  globalThis.fetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(payload),
    } as Response),
  ) as unknown as typeof fetch;
}

function mockFetchReject(error: Error) {
  globalThis.fetch = mock(() =>
    Promise.reject(error),
  ) as unknown as typeof fetch;
}

describe("AuditLogViewer", () => {
  afterEach(() => {
    cleanup();
  });

  it("displays prompt when wallet is not connected", () => {
    const { getByText } = render(
      <AuditLogViewer operatorWallet={null} isWalletConnected={false} />,
    );
    expect(
      getByText(/Connect an authorized wallet to view audit logs/i),
    ).toBeTruthy();
  });

  it("displays loading state and then no logs initially when connected", async () => {
    mockFetchOk({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const { getByText } = render(
      <AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />,
    );

    await waitFor(() => {
      expect(getByText(/No audit logs found/i)).toBeTruthy();
    });
  });

  it("renders fetched logs correctly", async () => {
    const mockLogs = [
      {
        id: "1",
        actor: "0xABCDEF",
        actionType: "LOGIN",
        timestamp: "2023-10-10T12:00:00Z",
      },
    ];

    mockFetchOk({
      success: true,
      data: mockLogs,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const { getByText } = render(
      <AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />,
    );

    await waitFor(() => {
      expect(getByText("LOGIN")).toBeTruthy();
    });
  });

  it("displays error message if fetch fails", async () => {
    mockFetchReject(new Error("Network Error"));

    const { getByText } = render(
      <AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />,
    );

    await waitFor(() => {
      expect(getByText(/Network Error/i)).toBeTruthy();
    });
  });

  it("handles pagination controls", async () => {
    mockFetchOk({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
    });

    const { getByText, getByRole } = render(
      <AuditLogViewer operatorWallet="0x123" isWalletConnected={true} />,
    );

    await waitFor(() => {
      expect(getByText(/Showing page 1 of 2/i)).toBeTruthy();
    });

    const nextBtn = getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(getByText(/Showing page 2 of 2/i)).toBeTruthy();
    });
  });
});
