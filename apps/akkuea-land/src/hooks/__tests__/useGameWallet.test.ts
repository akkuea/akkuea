/**
 * useGameWallet — unit tests
 *
 * Verifies the 4 core behaviours:
 *   connect()      → sets wallet address in state
 *   disconnect()   → clears address and balance from state
 *   fetchBalance() success → updates balance in state
 *   fetchBalance() RPC error → sets error state without crashing
 *
 * All network calls are mocked so tests never make real RPC requests.
 */

import { describe, it, expect, vi, beforeEach } from "bun:test";

// ── Shared mock data ─────────────────────────────────────────────────────────

const CONNECTED_ADDRESS =
  "GDVIEWER1234567890123456789012345678901234567890123456";
const MOCK_BALANCE = "15000000000"; // e.g. 1 500 LAND in stroops (7 decimals)

// ── Module mocks — must be declared before importing the module under test ──

const mockConnectWalletKit = vi.fn();
const mockGetWalletKit = vi.fn();
const mockResetWalletKit = vi.fn();

vi.mock("@/lib/walletKit", () => ({
  connectWalletKit: mockConnectWalletKit,
  getWalletKit: mockGetWalletKit,
  resetWalletKit: mockResetWalletKit,
}));

const mockFetchLandBalance = vi.fn();

vi.mock("@/lib/soroban-tx", () => ({
  fetchLandBalance: mockFetchLandBalance,
  submitSorobanTx: vi.fn(),
  waitForSorobanTx: vi.fn(),
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

// ── Import after mocks are set up ────────────────────────────────────────────

import { useGameWallet, useWalletStore } from "../useGameWallet";

// ── jsdom setup for renderHook ───────────────────────────────────────────────

// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { act, renderHook } from "@testing-library/react";

beforeEach(() => {
  vi.clearAllMocks();
  useWalletStore.setState({
    isConnected: false,
    address: null,
    balance: null,
    error: null,
  });
});

// ── Test cases ───────────────────────────────────────────────────────────────

describe("useGameWallet", () => {
  it("connect() — sets wallet address in state", async () => {
    mockConnectWalletKit.mockResolvedValue({
      kit: {},
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();

    await act(async () => {
      await result.current.login(); // connect
    });

    expect(mockConnectWalletKit).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe(CONNECTED_ADDRESS);
  });

  it("disconnect() — clears address and balance from state", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
      balance: MOCK_BALANCE,
      error: null,
    });

    const { result } = renderHook(() => useGameWallet());

    act(() => {
      result.current.logout(); // disconnect
    });

    expect(mockResetWalletKit).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetchBalance() success — updates balance in state", async () => {
    mockFetchLandBalance.mockResolvedValue(MOCK_BALANCE);
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    expect(result.current.balance).toBeNull();

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(mockFetchLandBalance).toHaveBeenCalledWith(CONNECTED_ADDRESS);
    expect(result.current.balance).toBe(MOCK_BALANCE);
    expect(result.current.error).toBeNull();
  });

  it("fetchBalance() RPC error — sets error state without crashing", async () => {
    const testError = new Error("Soroban RPC unavailable");
    mockFetchLandBalance.mockRejectedValue(testError);
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    await act(async () => {
      await result.current.fetchBalance();
    });

    expect(result.current.balance).toBeNull();
    expect(result.current.error).toBe("Soroban RPC unavailable");
  });
});
