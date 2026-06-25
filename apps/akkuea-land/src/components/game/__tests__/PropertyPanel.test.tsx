// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

// Standard browser mock environment setup for JSDOM in Bun environment
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

import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { GameProperty, BuildingLevel } from "../../../types/game.types";

// Mock framer-motion to bypass layout/sheet animations for synchronous UI assertions
mock.module("framer-motion", () => {
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      button: ({ children, ...props }: any) => (
        <button {...props}>{children}</button>
      ),
    },
  };
});

const mockSignTransaction = vi
  .fn()
  .mockResolvedValue({ signedTxXdr: "mock-xdr" });

vi.mock("@/lib/walletKit", () => ({
  getWalletKit: () => ({ signTransaction: mockSignTransaction }),
  initializeWalletKit: vi.fn(),
}));

import { PropertyPanel } from "../PropertyPanel";

const baseProperty: GameProperty = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Neo Tokyo Quadrant",
  description: "A high-yield residential sector inside Akkuea Land metaverse.",
  propertyType: "residential",
  location: {
    address: "Sector 4B",
    city: "New Tokyo",
    country: "Japan",
    coordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
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
  owner: "GBTREASURY",
  buildingLevel: 0,
  improveCost: 100,
  earnedIncome: 0,
};

describe("PropertyPanel Tests", () => {
  beforeEach(() => {
    cleanup();
    mockSignTransaction.mockClear();
  });

  // State 1: not_connected
  it("renders state 1: not_connected wallet view correctly", () => {
    const onUpdate = mock(() => {});
    const onClose = mock(() => {});
    const onConnect = mock(() => {});

    const view = render(
      <PropertyPanel
        property={{ ...baseProperty, owner: "GBTREASURY" }}
        onPropertyUpdate={onUpdate}
        viewerAddress={null}
        isConnected={false}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );

    // Verify coordinates, name are visible
    expect(view.queryByText("Neo Tokyo Quadrant")).not.toBeNull();
    expect(view.queryByText("[40.7128, -74.0060]")).not.toBeNull();

    // Verify wallet required prompt and connect button are visible
    expect(view.queryByText("Stellar Wallet Required")).not.toBeNull();
    expect(
      view.queryByRole("button", { name: /Connect Wallet/i }),
    ).not.toBeNull();

    // Verify close action triggers onClose callback
    fireEvent.click(view.getAllByRole("button")[0]); // Close button is first icon button
    expect(onClose).toHaveBeenCalled();
  });

  // State 2: unowned (viewer connected, owner is GBTREASURY)
  it("renders state 2: unowned (Treasury owned) tile and allows purchase", async () => {
    const onUpdate = mock(() => {});
    const viewerAddress =
      "GDVIEWER1234567890123456789012345678901234567890123456";

    const view = render(
      <PropertyPanel
        property={{ ...baseProperty, owner: "GBTREASURY" }}
        onPropertyUpdate={onUpdate}
        viewerAddress={viewerAddress}
        isConnected={true}
        onClose={() => {}}
      />,
    );

    // Verify treasury property badge
    expect(view.queryByText("Treasury Property")).not.toBeNull();

    // Verify Buy from Treasury button exists
    const buyButton = view.queryByRole("button", {
      name: /Buy from Treasury/i,
    });
    expect(buyButton).not.toBeNull();

    // Trigger purchase and verify signature call + optimistic UI update
    fireEvent.click(buyButton!);

    // Verify optimistic UI callback was triggered with the viewer as owner
    expect(onUpdate).toHaveBeenCalled();
    const updatedProp = (onUpdate.mock as any).calls[0][0] as GameProperty;
    expect(updatedProp.owner).toBe(viewerAddress);

    // Wait for the transaction to complete
    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalled();
    });
  });

  // State 3a: owned_by_viewer - Claiming Rent
  it("renders state 3: owned_by_viewer and allows claiming income", () => {
    const onUpdate = mock(() => {});
    const viewerAddress =
      "GDVIEWER1234567890123456789012345678901234567890123456";
    const propertyOwned = {
      ...baseProperty,
      owner: viewerAddress,
      buildingLevel: 1 as BuildingLevel,
      earnedIncome: 450,
    };

    const view = render(
      <PropertyPanel
        property={propertyOwned}
        onPropertyUpdate={onUpdate}
        viewerAddress={viewerAddress}
        isConnected={true}
        onClose={() => {}}
      />,
    );

    // Verify "Owned by You" badge
    expect(view.queryByText("Owned by You")).not.toBeNull();

    // Verify development level bar highlighted step (Residential)
    expect(view.queryAllByText("Residential").length).toBeGreaterThan(0);

    // Verify earned rent displays
    expect(view.queryByText(/450 LAND/i)).not.toBeNull();

    // Verify claim button exists and triggers claim
    const claimButton = view.queryByRole("button", { name: /Claim/i });
    expect(claimButton).not.toBeNull();
    fireEvent.click(claimButton!);
    expect(onUpdate).toHaveBeenCalled();
    expect((onUpdate.mock as any).calls[0][0].earnedIncome).toBe(0);
  });

  // State 3b: owned_by_viewer - Improving building
  it("renders state 3: owned_by_viewer and allows improving the building", () => {
    const onUpdate = mock(() => {});
    const viewerAddress =
      "GDVIEWER1234567890123456789012345678901234567890123456";
    const propertyOwned = {
      ...baseProperty,
      owner: viewerAddress,
      buildingLevel: 1 as BuildingLevel,
      earnedIncome: 0,
    };

    const view = render(
      <PropertyPanel
        property={propertyOwned}
        onPropertyUpdate={onUpdate}
        viewerAddress={viewerAddress}
        isConnected={true}
        onClose={() => {}}
      />,
    );

    // Verify improve button works and increments building level
    const improveButton = view.queryByRole("button", { name: /Improve/i });
    expect(improveButton).not.toBeNull();
    fireEvent.click(improveButton!);
    expect(onUpdate).toHaveBeenCalled();
    expect((onUpdate.mock as any).calls[0][0].buildingLevel).toBe(2);
  });

  // State 4: listed_by_other (viewer connected, owner is another address)
  it("renders state 4: listed_by_other and allows purchase", async () => {
    const onUpdate = mock(() => {});
    const viewerAddress =
      "GDVIEWER1234567890123456789012345678901234567890123456";
    const otherAddress =
      "GDOTHER12345678901234567890123456789012345678901234567";
    const propertyListed = {
      ...baseProperty,
      owner: otherAddress,
      pricePerShare: "200",
    };

    const view = render(
      <PropertyPanel
        property={propertyListed}
        onPropertyUpdate={onUpdate}
        viewerAddress={viewerAddress}
        isConnected={true}
        onClose={() => {}}
      />,
    );

    // Verify "Listed for Sale" badge
    expect(view.queryByText("Listed for Sale")).not.toBeNull();

    // Verify Buy button and asking price
    expect(view.queryByText(/200 LAND/i)).not.toBeNull();
    const buyButton = view.queryByRole("button", { name: /Buy Land Tile/i });
    expect(buyButton).not.toBeNull();

    // Trigger purchase and verify signature
    fireEvent.click(buyButton!);
    expect(onUpdate).toHaveBeenCalled();
    expect((onUpdate.mock as any).calls[0][0].owner).toBe(viewerAddress);

    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalled();
    });
  });
});
