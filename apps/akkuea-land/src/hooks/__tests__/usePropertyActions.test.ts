// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
(dom.window as any).fetch = fetch;
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
globalThis.HTMLElement = dom.window.HTMLElement as any;
globalThis.MutationObserver = dom.window.MutationObserver as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { type GameProperty, type BuildingLevel } from "../../types/game.types";

// Preventive: hook doesn't import stellar-sdk today, but will when mockXdr stubs are replaced.
mock.module("@stellar/stellar-sdk", () => ({
  TransactionBuilder: class {
    addOperation() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return { toXDR: () => "mock-xdr-payload" };
    }
  },
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
  SorobanRpc: { Server: class {} },
  Operation: { invokeContractFunction: vi.fn() },
  Asset: class {
    static native() {
      return new this();
    }
  },
}));

const mockSignTransaction = vi
  .fn()
  .mockResolvedValue({ signedTxXdr: "signed-mock-xdr" });

const mockGetWalletKit = vi.fn(() => ({
  signTransaction: mockSignTransaction,
}));

vi.mock("@/lib/walletKit", () => ({
  getWalletKit: mockGetWalletKit,
  initializeWalletKit: vi.fn(),
  resetWalletKit: vi.fn(),
}));

import { usePropertyActions } from "../usePropertyActions";

const VIEWER_ADDRESS = "GDVIEWER1234567890123456789012345678901234567890123456";
const TREASURY_ADDRESS = "GBTREASURY";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const STUB_XDR = "AAAAAgAAAAD5r+Hl5S94D......";

const baseProperty: GameProperty = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Neo Tokyo Quadrant",
  description: "A high-yield residential sector inside Akkuea Land metaverse.",
  propertyType: "residential",
  location: {
    address: "Sector 4B",
    city: "New Tokyo",
    country: "Japan",
    coordinates: { latitude: 40.7128, longitude: -74.006 },
  },
  totalValue: "1500000",
  tokenAddress: "GCCVPYFOHY7ZB7557JKENAX62LUAPLMGIWNZJAFV2MITK6T32V37KEJU",
  totalShares: 10000,
  availableShares: 5000,
  pricePerShare: "150",
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800"],
  documents: [],
  verified: true,
  listedAt: "2026-05-27T00:00:00Z",
  owner: TREASURY_ADDRESS,
  buildingLevel: 0,
  improveCost: 100,
  earnedIncome: 0,
};

describe("usePropertyActions", () => {
  beforeEach(() => {
    cleanup();
    // mockReset drains unused Once queues; mockClear only clears call history.
    mockSignTransaction.mockReset();
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-mock-xdr" });
    mockGetWalletKit.mockReset();
    mockGetWalletKit.mockImplementation(() => ({
      signTransaction: mockSignTransaction,
    }));
  });

  describe("TC1 — buyFromTreasury: success path", () => {
    it("applies optimistic state mutation and passes deterministic XDR to signTransaction", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.buyFromTreasury();
      });

      expect(onPropertyUpdate).toHaveBeenCalledTimes(1);
      const optimisticProp = (onPropertyUpdate.mock as any)
        .calls[0][0] as GameProperty;
      expect(optimisticProp.owner).toBe(VIEWER_ADDRESS);
      expect(optimisticProp.availableShares).toBe(0);

      expect(mockSignTransaction).toHaveBeenCalledTimes(1);
      expect(mockSignTransaction).toHaveBeenCalledWith(STUB_XDR, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: VIEWER_ADDRESS,
      });

      expect(result.current.success).toBe(
        "Buy from Treasury completed successfully!",
      );
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });

    it("guarantees pendingAction is never left in a stuck loading state after success or failure", async () => {
      // React 18 automatic batching collapses the in-progress label into the terminal render.
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      expect(result.current.pendingAction).toBeNull();

      await act(async () => {
        await result.current.buyFromTreasury();
      });

      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC2 — Authentication Guard", () => {
    it("short-circuits and sets error boundary when isConnected is false", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, null, false),
      );

      await act(async () => {
        await result.current.buyFromTreasury();
      });

      expect(result.current.error).toBe("Wallet not connected");
      expect(onPropertyUpdate).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(result.current.pendingAction).toBeNull();
    });

    it("short-circuits when viewerAddress is null even if isConnected is true", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, null, true),
      );

      await act(async () => {
        // buyFromTreasury has no domain guard before handleAction, so the auth check fires first.
        await result.current.buyFromTreasury();
      });

      expect(result.current.error).toBe("Wallet not connected");
      expect(onPropertyUpdate).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
    });
  });

  describe("TC3 — WalletKit Initialization Drop", () => {
    it("surfaces exact init error and rolls back the optimistic update when getWalletKit returns null", async () => {
      mockGetWalletKit.mockReturnValueOnce(null);

      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.buyFromTreasury();
      });

      expect(result.current.error).toBe(
        "Stellar Wallet Kit is not initialized.",
      );

      expect(onPropertyUpdate).toHaveBeenCalledTimes(2);
      const rollbackArg = (onPropertyUpdate.mock as any)
        .calls[1][0] as GameProperty;
      expect(rollbackArg).toEqual(baseProperty);

      expect(mockSignTransaction).not.toHaveBeenCalled();
    });
  });

  describe("TC4 — Atomic Rollback on Rejection", () => {
    it("calls onPropertyUpdate twice: optimistic first, exact original second on rejection", async () => {
      mockSignTransaction.mockRejectedValueOnce(new Error("User rejected"));

      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.buyFromTreasury();
      });

      expect(onPropertyUpdate).toHaveBeenCalledTimes(2);

      const optimisticArg = (onPropertyUpdate.mock as any)
        .calls[0][0] as GameProperty;
      expect(optimisticArg.owner).toBe(VIEWER_ADDRESS);
      expect(optimisticArg.availableShares).toBe(0);

      const rollbackArg = (onPropertyUpdate.mock as any)
        .calls[1][0] as GameProperty;
      expect(rollbackArg).toEqual(baseProperty);

      expect(result.current.error).toBe("User rejected");
      expect(result.current.success).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC5 — Domain Boundaries Validation", () => {
    it("improveProperty at max level (3) traps error and bypasses wallet signature", async () => {
      const maxLevelProperty: GameProperty = {
        ...baseProperty,
        buildingLevel: 3 as BuildingLevel,
      };
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(
          maxLevelProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
      );

      await act(async () => {
        await result.current.improveProperty();
      });

      expect(result.current.error).toBe(
        "Property is already at maximum level (Skyscraper).",
      );
      expect(onPropertyUpdate).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
    });

    it("listForSale with price 0 traps error and bypasses wallet signature", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.listForSale(0);
      });

      expect(result.current.error).toBe(
        "Listing price must be greater than zero.",
      );
      expect(onPropertyUpdate).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
    });

    it("listForSale with negative price traps error and bypasses wallet signature", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.listForSale(-99);
      });

      expect(result.current.error).toBe(
        "Listing price must be greater than zero.",
      );
      expect(onPropertyUpdate).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
    });
  });

  describe("TC6 — improveProperty: success path", () => {
    it("levels up from 1→2 (Commercial), doubles improveCost, and surfaces exact success message", async () => {
      const level1Property: GameProperty = {
        ...baseProperty,
        owner: VIEWER_ADDRESS,
        buildingLevel: 1 as BuildingLevel,
        improveCost: 100,
      };
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(level1Property, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.improveProperty();
      });

      expect(onPropertyUpdate).toHaveBeenCalledTimes(1);
      const optimisticProp = (onPropertyUpdate.mock as any)
        .calls[0][0] as GameProperty;
      expect(optimisticProp.buildingLevel).toBe(2);
      expect(optimisticProp.improveCost).toBe(200);

      expect(mockSignTransaction).toHaveBeenCalledWith(STUB_XDR, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: VIEWER_ADDRESS,
      });

      expect(result.current.success).toBe("Improve Property completed successfully!");
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC7 — listForSale: success path", () => {
    it("lists at given price, flips isListed, and surfaces exact success message", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.listForSale(300);
      });

      expect(onPropertyUpdate).toHaveBeenCalledTimes(1);
      const optimisticProp = (onPropertyUpdate.mock as any)
        .calls[0][0] as GameProperty;
      expect(optimisticProp.pricePerShare).toBe("300");
      expect(optimisticProp.isListed).toBe(true);

      expect(mockSignTransaction).toHaveBeenCalledWith(STUB_XDR, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: VIEWER_ADDRESS,
      });

      expect(result.current.success).toBe("List for Sale completed successfully!");
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC8 — claimIncome: success path and income boundary", () => {
    it("zeroes earnedIncome, calls signTransaction, and surfaces exact success message", async () => {
      const incomeProperty: GameProperty = {
        ...baseProperty,
        earnedIncome: 500,
      };
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(incomeProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.claimIncome();
      });

      expect(onPropertyUpdate).toHaveBeenCalledTimes(1);
      const optimisticProp = (onPropertyUpdate.mock as any)
        .calls[0][0] as GameProperty;
      expect(optimisticProp.earnedIncome).toBe(0);

      expect(mockSignTransaction).toHaveBeenCalledWith(STUB_XDR, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: VIEWER_ADDRESS,
      });

      expect(result.current.success).toBe("Claim Income completed successfully!");
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });

    it("earnedIncome at 0 traps 'No income available to claim.' and bypasses wallet signature", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.claimIncome();
      });

      expect(result.current.error).toBe("No income available to claim.");
      expect(onPropertyUpdate).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
    });
  });

  describe("TC9 — buyFromPlayer: P2P purchase success path", () => {
    it("maps owner to viewer and flips isListed to false, surfaces exact success message", async () => {
      const listedProperty: GameProperty = {
        ...baseProperty,
        owner: "GDOTHER12345678901234567890123456789012345678901234567",
        isListed: true,
        pricePerShare: "200",
      };
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(listedProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.buyFromPlayer();
      });

      expect(onPropertyUpdate).toHaveBeenCalledTimes(1);
      const optimisticProp = (onPropertyUpdate.mock as any)
        .calls[0][0] as GameProperty;
      expect(optimisticProp.owner).toBe(VIEWER_ADDRESS);
      expect(optimisticProp.isListed).toBe(false);

      expect(mockSignTransaction).toHaveBeenCalledWith(STUB_XDR, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: VIEWER_ADDRESS,
      });

      expect(result.current.success).toBe("Buy Property completed successfully!");
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC10 — clearStates: flushes error and success containers", () => {
    it("resets error to null after a domain guard triggered it", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.claimIncome();
      });

      expect(result.current.error).toBe("No income available to claim.");

      await act(async () => {
        result.current.clearStates();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.success).toBeNull();
    });

    it("resets success to null after a successful action", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(baseProperty, onPropertyUpdate, VIEWER_ADDRESS, true),
      );

      await act(async () => {
        await result.current.buyFromTreasury();
      });

      expect(result.current.success).toBe(
        "Buy from Treasury completed successfully!",
      );

      await act(async () => {
        result.current.clearStates();
      });

      expect(result.current.success).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });
});
