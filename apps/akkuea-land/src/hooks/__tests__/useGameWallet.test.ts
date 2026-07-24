/**
 * useGameWallet — unit tests
 *
 * Verifies that login/logout/signAndSubmitTx delegate to the real Stellar
 * wallet kit + Soroban RPC helpers instead of the old hardcoded/simulated
 * behaviour (fixed default address, fake setTimeout "signature").
 */

import { describe, it, expect, vi, beforeEach } from "bun:test";

// ── Shared mock data ─────────────────────────────────────────────────────────

const CONNECTED_ADDRESS =
  "GDVIEWER1234567890123456789012345678901234567890123456";
const MOCK_UNSIGNED_XDR = "AAAA_UNSIGNED_XDR_BASE64==";
const MOCK_SIGNED_XDR = "AAAA_SIGNED_XDR_BASE64==";
const MOCK_TX_HASH =
  "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// ── Module mocks — must be declared before importing the module under test ──

const mockSignTransaction = vi
  .fn()
  .mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR });
const mockKit = { signTransaction: mockSignTransaction };

const mockConnectWalletKit = vi.fn();
const mockGetWalletKit = vi.fn(() => mockKit);
const mockResetWalletKit = vi.fn();

vi.mock("@/lib/walletKit", () => ({
  connectWalletKit: mockConnectWalletKit,
  getWalletKit: mockGetWalletKit,
  resetWalletKit: mockResetWalletKit,
}));

vi.mock("@/lib/soroban-tx", () => ({
  submitSorobanTx: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  waitForSorobanTx: vi.fn().mockResolvedValue("success"),
  NETWORK_PASSPHRASE,
}));

// ── Import after mocks are set up ────────────────────────────────────────────

import { submitSorobanTx, waitForSorobanTx } from "@/lib/soroban-tx";
import { useGameWallet, useWalletStore } from "../useGameWallet";

const submitMock = submitSorobanTx as ReturnType<typeof vi.fn>;
const waitMock = waitForSorobanTx as ReturnType<typeof vi.fn>;

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
  useWalletStore.setState({ isConnected: false, address: null });
  mockConnectWalletKit.mockReset();
  mockGetWalletKit.mockReset();
  mockGetWalletKit.mockReturnValue(mockKit);
  mockSignTransaction.mockReset();
  mockSignTransaction.mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR });
  submitMock.mockResolvedValue(MOCK_TX_HASH);
  waitMock.mockResolvedValue("success");
});

describe("useGameWallet — login", () => {
  it("connects the real wallet kit and stores the returned address", async () => {
    mockConnectWalletKit.mockResolvedValue({
      kit: mockKit,
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();

    await act(async () => {
      await result.current.login();
    });

    expect(mockConnectWalletKit).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe(CONNECTED_ADDRESS);
  });

  it("leaves state disconnected when the user closes the wallet picker", async () => {
    mockConnectWalletKit.mockResolvedValue(null);

    const { result } = renderHook(() => useGameWallet());

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });
});

describe("useGameWallet — logout", () => {
  it("resets the wallet kit singleton and clears connection state", () => {
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    act(() => {
      result.current.logout();
    });

    expect(mockResetWalletKit).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
  });
});

describe("useGameWallet — signAndSubmitTx", () => {
  it("signs with the connected address, submits, and waits for confirmation", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    await act(async () => {
      await result.current.signAndSubmitTx(MOCK_UNSIGNED_XDR);
    });

    expect(mockSignTransaction).toHaveBeenCalledWith(MOCK_UNSIGNED_XDR, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: CONNECTED_ADDRESS,
    });
    expect(submitMock).toHaveBeenCalledWith(MOCK_SIGNED_XDR);
    expect(waitMock).toHaveBeenCalledWith(MOCK_TX_HASH);
  });

  it("never resolves via a fake timeout — a signing rejection propagates", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
    });
    mockSignTransaction.mockRejectedValueOnce(new Error("User rejected"));

    const { result } = renderHook(() => useGameWallet());

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.signAndSubmitTx(MOCK_UNSIGNED_XDR);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe("User rejected");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("throws when the wallet kit was never initialized", async () => {
    mockGetWalletKit.mockReturnValueOnce(null as any);
    useWalletStore.setState({
      isConnected: true,
      address: CONNECTED_ADDRESS,
    });

    const { result } = renderHook(() => useGameWallet());

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.signAndSubmitTx(MOCK_UNSIGNED_XDR);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe("Stellar Wallet Kit is not initialized.");
  });

  it("throws when no wallet address is connected", async () => {
    useWalletStore.setState({ isConnected: false, address: null });

    const { result } = renderHook(() => useGameWallet());

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.signAndSubmitTx(MOCK_UNSIGNED_XDR);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe("Wallet not connected.");
    expect(mockSignTransaction).not.toHaveBeenCalled();
  });
});
