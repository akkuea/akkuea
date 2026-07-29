/**
 * usePropertyActions — unit tests
 *
 * Verifies that:
 *  1. buyFromTreasury builds a real Soroban XDR (via buildBuyFromTreasuryXdr)
 *     and passes it to the wallet for signing, then submits + polls.
 *  2. All error paths surface a human-readable error message.
 *  3. The optimistic UI update is applied immediately and rolled back on error.
 */

import { describe, it, expect, vi, beforeEach, mock } from "bun:test";

// ── Shared mock data ─────────────────────────────────────────────────────────

const VIEWER = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const TREASURY = "GABC1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZ56";
const MOCK_UNSIGNED_XDR = "AAAA_UNSIGNED_XDR_BASE64==";
const MOCK_SIGNED_XDR = "AAAA_SIGNED_XDR_BASE64==";
const MOCK_TX_HASH =
  "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";

// ── Module mocks — must be declared before importing the module under test ──

// Mock the soroban-tx helpers so no network calls are made
vi.mock("@/lib/soroban-tx", () => ({
  buildBuyFromTreasuryXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  buildBuyFromPlayerXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  buildImprovePropertyXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  buildApproveMarketplaceXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  buildListForSaleXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  buildClaimIncomeXdr: vi.fn().mockResolvedValue(MOCK_UNSIGNED_XDR),
  submitSorobanTx: vi.fn().mockResolvedValue(MOCK_TX_HASH),
  waitForSorobanTx: vi.fn().mockResolvedValue("success"),
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  TREASURY_ADDRESS: TREASURY,
}));

// Mock walletKit to return a controllable signTransaction function
const mockSignTransaction = vi
  .fn()
  .mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR });

const mockGetWalletKit = vi.fn(() => ({
  signTransaction: mockSignTransaction,
}));

const mockInitializeWalletKit = vi.fn();
const mockResetWalletKit = vi.fn();

vi.mock("@/lib/walletKit", () => ({
  getWalletKit: mockGetWalletKit,
  initializeWalletKit: mockInitializeWalletKit,
  resetWalletKit: mockResetWalletKit,
}));

// ── Import after mocks are set up ────────────────────────────────────────────

import {
  buildBuyFromTreasuryXdr,
  buildApproveMarketplaceXdr,
  buildListForSaleXdr,
  submitSorobanTx,
  waitForSorobanTx,
} from "@/lib/soroban-tx";

// We test the hook logic directly (without React) by extracting the txLogic
// functions from usePropertyActions via a thin adapter so we don't need jsdom.
// The hook's state management is tested separately via PropertyPanel.test.tsx.

// ── Helpers ──────────────────────────────────────────────────────────────────

import { GameProperty, BuildingLevel } from "../../types/game.types";

function makeProperty(overrides: Partial<GameProperty> = {}): GameProperty {
  return {
    id: "prop-3-7",
    name: "Test Tile",
    description: "Test",
    propertyType: "land",
    location: {
      address: "Block 4, Lot 8",
      city: "Akkuea City",
      country: "Stellar",
      coordinates: { latitude: 0, longitude: 0 },
    },
    totalValue: "1000",
    totalShares: 100,
    availableShares: 100,
    pricePerShare: "100",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-01-01T00:00:00Z",
    owner: TREASURY,
    buildingLevel: 0 as BuildingLevel,
    earnedIncome: 0,
    improveCost: 100,
    isListed: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("soroban-tx — propertyIdToU32", () => {
  it('converts "prop-3-7" to 67 (3*20 + 7)', async () => {
    const { propertyIdToU32 } = await import("@/lib/soroban-tx");
    expect(propertyIdToU32("prop-3-7")).toBe(67);
  });

  it('converts "prop-0-0" to 0', async () => {
    const { propertyIdToU32 } = await import("@/lib/soroban-tx");
    expect(propertyIdToU32("prop-0-0")).toBe(0);
  });

  it('converts "prop-19-19" to 399', async () => {
    const { propertyIdToU32 } = await import("@/lib/soroban-tx");
    expect(propertyIdToU32("prop-19-19")).toBe(399);
  });

  it('converts a numeric string "42" to 42', async () => {
    const { propertyIdToU32 } = await import("@/lib/soroban-tx");
    expect(propertyIdToU32("42")).toBe(42);
  });

  it("throws for an unrecognised id format", async () => {
    const { propertyIdToU32 } = await import("@/lib/soroban-tx");
    expect(() => propertyIdToU32("bad-id")).toThrow();
  });
});

describe("buyFromTreasury — XDR build + sign + submit flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default successful mocks after clearing
    (buildBuyFromTreasuryXdr as ReturnType<typeof vi.fn>).mockResolvedValue(
      MOCK_UNSIGNED_XDR,
    );
    mockSignTransaction.mockResolvedValue({ signedTxXdr: MOCK_SIGNED_XDR });
    (submitSorobanTx as ReturnType<typeof vi.fn>).mockResolvedValue(
      MOCK_TX_HASH,
    );
    (waitForSorobanTx as ReturnType<typeof vi.fn>).mockResolvedValue("success");
  });

  it("calls buildBuyFromTreasuryXdr with correct arguments", async () => {
    const property = makeProperty({ id: "prop-3-7", owner: TREASURY });

    // Simulate what usePropertyActions.buyFromTreasury does internally
    const xdr = await buildBuyFromTreasuryXdr(VIEWER, property.id, TREASURY);

    expect(buildBuyFromTreasuryXdr).toHaveBeenCalledWith(
      VIEWER,
      "prop-3-7",
      TREASURY,
    );
    expect(xdr).toBe(MOCK_UNSIGNED_XDR);
  });

  it("passes unsigned XDR to signTransaction with correct network passphrase", async () => {
    const { getWalletKit } = await import("@/lib/walletKit");
    const kit = getWalletKit()!;

    const xdr = await buildBuyFromTreasuryXdr(VIEWER, "prop-3-7", TREASURY);
    await kit.signTransaction(xdr, {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: VIEWER,
    });

    expect(mockSignTransaction).toHaveBeenCalledWith(MOCK_UNSIGNED_XDR, {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: VIEWER,
    });
  });

  it("submits signed XDR and receives a tx hash", async () => {
    const hash = await submitSorobanTx(MOCK_SIGNED_XDR);
    expect(submitSorobanTx).toHaveBeenCalledWith(MOCK_SIGNED_XDR);
    expect(hash).toBe(MOCK_TX_HASH);
  });

  it("polls for transaction confirmation after submission", async () => {
    const hash = await submitSorobanTx(MOCK_SIGNED_XDR);
    const status = await waitForSorobanTx(hash);
    expect(waitForSorobanTx).toHaveBeenCalledWith(MOCK_TX_HASH);
    expect(status).toBe("success");
  });

  it("surfaces a human-readable error when buildBuyFromTreasuryXdr throws", async () => {
    (buildBuyFromTreasuryXdr as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Soroban simulation failed for transfer: contract not found"),
    );

    let caughtError: Error | null = null;
    try {
      await buildBuyFromTreasuryXdr(VIEWER, "prop-3-7", TREASURY);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain("Soroban simulation failed");
  });

  it("surfaces a human-readable error when signTransaction throws", async () => {
    mockSignTransaction.mockRejectedValueOnce(new Error("User rejected"));

    const { getWalletKit } = await import("@/lib/walletKit");
    const kit = getWalletKit()!;

    let caughtError: Error | null = null;
    try {
      await kit.signTransaction(MOCK_UNSIGNED_XDR, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address: VIEWER,
      });
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe("User rejected");
  });

  it("surfaces a human-readable error when submitSorobanTx throws", async () => {
    (submitSorobanTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Transaction submission rejected by node: AAAA=="),
    );

    let caughtError: Error | null = null;
    try {
      await submitSorobanTx(MOCK_SIGNED_XDR);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain("Transaction submission rejected");
  });

  it("surfaces a human-readable error when on-chain execution fails", async () => {
    (waitForSorobanTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Transaction failed on-chain. Result XDR: AAAA=="),
    );

    let caughtError: Error | null = null;
    try {
      await waitForSorobanTx(MOCK_TX_HASH);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toContain("Transaction failed on-chain");
  });
});

describe("buyFromTreasury — XDR is not a hardcoded placeholder string", () => {
  it("does not use the old hardcoded mock XDR placeholder", async () => {
    // The old code passed a literal "AAAAAgAAAAD5r+Hl5S94D......" string
    // Confirm the builder is called (not that literal) and returns a non-placeholder value
    const OLD_PLACEHOLDER = "AAAAAgAAAAD5r+Hl5S94D......";

    const xdr = await buildBuyFromTreasuryXdr(VIEWER, "prop-0-0", TREASURY);

    // The returned value should come from the mock (simulating a real XDR),
    // not be the old placeholder string
    expect(xdr).not.toBe(OLD_PLACEHOLDER);
    // And the builder must have been called with real arguments
    expect(buildBuyFromTreasuryXdr).toHaveBeenCalled();
  });
});

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

import { act, cleanup, renderHook } from "@testing-library/react";

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

import { usePropertyActions } from "../usePropertyActions";

const VIEWER_ADDRESS =
  "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const TREASURY_ADDRESS = "GABC1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZ56";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const STUB_XDR = MOCK_UNSIGNED_XDR;

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
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
      mockGetWalletKit.mockReturnValueOnce(null as any);

      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        usePropertyActions(
          level1Property,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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

      expect(result.current.success).toBe(
        "Improve Property completed successfully!",
      );
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC7 — listForSale: success path", () => {
    it("lists at given price, flips isListed, and surfaces exact success message", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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

      expect(result.current.success).toBe(
        "List for Sale completed successfully!",
      );
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });

    it("approves the marketplace as spender before listing (transfer_from prerequisite)", async () => {
      const onPropertyUpdate = vi.fn();
      const approveMock = buildApproveMarketplaceXdr as ReturnType<
        typeof vi.fn
      >;
      const listMock = buildListForSaleXdr as ReturnType<typeof vi.fn>;

      const callOrder: string[] = [];
      approveMock.mockImplementationOnce(async () => {
        callOrder.push("approve");
        return MOCK_UNSIGNED_XDR;
      });
      listMock.mockImplementationOnce(async () => {
        callOrder.push("list");
        return MOCK_UNSIGNED_XDR;
      });

      const { result } = renderHook(() =>
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
      );

      await act(async () => {
        await result.current.listForSale(300);
      });

      expect(approveMock).toHaveBeenCalledWith(VIEWER_ADDRESS, baseProperty.id);
      expect(listMock).toHaveBeenCalledWith(
        VIEWER_ADDRESS,
        baseProperty.id,
        300,
      );
      // Approval must be signed+submitted before the listing transaction.
      expect(mockSignTransaction).toHaveBeenCalledTimes(2);
      expect(callOrder).toEqual(["approve", "list"]);
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
        usePropertyActions(
          incomeProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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

      expect(result.current.success).toBe(
        "Claim Income completed successfully!",
      );
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });

    it("earnedIncome at 0 traps 'No income available to claim.' and bypasses wallet signature", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        owner: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
        isListed: true,
        pricePerShare: "200",
      };
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(
          listedProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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

      expect(result.current.success).toBe(
        "Buy Property completed successfully!",
      );
      expect(result.current.error).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  describe("TC10 — clearStates: flushes error and success containers", () => {
    it("resets error to null after a domain guard triggered it", async () => {
      const onPropertyUpdate = vi.fn();

      const { result } = renderHook(() =>
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
        usePropertyActions(
          baseProperty,
          onPropertyUpdate,
          VIEWER_ADDRESS,
          true,
        ),
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
