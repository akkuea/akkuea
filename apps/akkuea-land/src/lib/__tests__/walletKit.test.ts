/**
 * walletKit - ensureWalletSelected unit tests
 *
 * Regression for the dashboard bug where "Claim All" never popped the wallet:
 * getWalletKit() returned null because initializeWalletKit() was never called,
 * so the page silently took the demo fallback. The connect flow must guarantee
 * a wallet is selected (opening the picker if needed) before signing.
 *
 * Uses a plain structural stub (SelectableWalletKit) instead of module mocks -
 * bun's vi.mock is process-global and other test files already mock
 * "@/lib/walletKit", so module mocking here would collide across files.
 */

import { describe, it, expect, vi, beforeEach } from "bun:test";

import {
  ensureWalletSelected,
  type SelectableWalletKit,
} from "@/lib/walletKit";

const ADDRESS = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";

const mockGetAddress = vi.fn();
const mockOpenModal = vi.fn();
const mockSetWallet = vi.fn();

const stubKit: SelectableWalletKit = {
  getAddress: mockGetAddress,
  openModal: mockOpenModal,
  setWallet: mockSetWallet,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureWalletSelected", () => {
  it("returns the address without opening the picker when a wallet is already selected", async () => {
    mockGetAddress.mockResolvedValue({ address: ADDRESS });

    const address = await ensureWalletSelected(stubKit);

    expect(address).toBe(ADDRESS);
    expect(mockOpenModal).not.toHaveBeenCalled();
    expect(mockSetWallet).not.toHaveBeenCalled();
  });

  it("opens the picker, sets the chosen wallet, and returns its address when none is selected", async () => {
    mockGetAddress
      .mockRejectedValueOnce(new Error("no wallet selected"))
      .mockResolvedValueOnce({ address: ADDRESS });
    mockOpenModal.mockImplementation(
      (params: Parameters<SelectableWalletKit["openModal"]>[0]) => {
        params.onWalletSelected({ id: "freighter" });
        return Promise.resolve();
      },
    );

    const address = await ensureWalletSelected(stubKit);

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
    expect(mockSetWallet).toHaveBeenCalledWith("freighter");
    expect(address).toBe(ADDRESS);
  });

  it("returns null when the user closes the picker without selecting", async () => {
    mockGetAddress.mockRejectedValue(new Error("no wallet selected"));
    mockOpenModal.mockImplementation(
      (params: Parameters<SelectableWalletKit["openModal"]>[0]) => {
        params.onClosed?.(new Error("modal closed"));
        return Promise.resolve();
      },
    );

    const address = await ensureWalletSelected(stubKit);

    expect(address).toBeNull();
    expect(mockSetWallet).not.toHaveBeenCalled();
  });
});
