# C5-011: Build Game Marketplace UI

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-011         |
| Area            | GAME           |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | C5-007, C5-013 |
| Estimated Lines | 260-350        |

## Component Structure

```
src/app/marketplace/page.tsx
src/components/game/marketplace/ListingGrid.tsx
src/components/game/marketplace/ListingCard.tsx
src/components/game/marketplace/FilterBar.tsx
src/components/game/marketplace/BuyModal.tsx
src/hooks/useMarketplace.ts
```

## Filter and Sort State

```typescript
type LevelFilter =
  | "all"
  | "vacant"
  | "residential"
  | "commercial"
  | "skyscraper";
type SortOrder = "price-asc" | "price-desc" | "newest";

interface MarketplaceFilters {
  level: LevelFilter;
  sort: SortOrder;
}
```

Store in `useState` on the page. Filter and sort client-side from the full fetched array; no refetch on filter change.

## FilterBar Component

Filter chips, not dropdowns. Chips feel faster and more game-like:

```tsx
// src/components/game/marketplace/FilterBar.tsx
const LEVEL_CHIPS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vacant", label: "Vacant" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "skyscraper", label: "Skyscraper" },
];

export function FilterBar({
  filters,
  onChange,
  total,
}: {
  filters: MarketplaceFilters;
  onChange: (f: MarketplaceFilters) => void;
  total: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {LEVEL_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => onChange({ ...filters, level: chip.value })}
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filters.level === chip.value
                ? "bg-land-500 text-white"
                : "bg-surface-700 text-surface-600 hover:text-white",
            ].join(" ")}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-surface-600">{total} listings</span>
        <select
          value={filters.sort}
          onChange={(e) =>
            onChange({ ...filters, sort: e.target.value as SortOrder })
          }
          className="rounded-lg border border-surface-border bg-surface-800 px-2 py-1 text-xs text-white focus:outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
    </div>
  );
}
```

## ListingCard Component

```tsx
// src/components/game/marketplace/ListingCard.tsx
import { tileColor } from "@/lib/tileColors";
import { formatLand, shortenAddress } from "@/lib/format";
import type { Listing, Property } from "@akkuea/shared";

const INCOME_PER_EPOCH: Record<string, number> = {
  vacant: 10,
  residential: 15,
  commercial: 30,
  skyscraper: 60,
};

export function ListingCard({
  listing,
  property,
  onBuy,
}: {
  listing: Listing;
  property: Property;
  onBuy: () => void;
}) {
  const bg = tileColor(listing.seller, property.level);

  return (
    <div className="group rounded-2xl border border-surface-border bg-surface-800 overflow-hidden transition-all hover:border-land-500/40 hover:shadow-lg hover:shadow-land-500/5">
      {/* Tile preview */}
      <div
        className="flex h-28 items-center justify-center text-3xl font-black text-white/70 transition-colors"
        style={{ backgroundColor: bg }}
      >
        {property.level[0].toUpperCase()}
      </div>

      <div className="p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white capitalize">
            {property.level} ({property.coordinates.x}, {property.coordinates.y}
            )
          </p>
          <p className="mt-0.5 text-xs text-surface-600">
            {INCOME_PER_EPOCH[property.level]} LAND/epoch income
          </p>
          <p className="mt-0.5 text-xs text-surface-600">
            Seller: {shortenAddress(listing.seller)}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-xl font-bold text-white">
            {formatLand(listing.priceInLand)}
            <span className="ml-1 text-xs font-normal text-surface-600">
              LAND
            </span>
          </p>
          <button
            onClick={onBuy}
            className="rounded-xl bg-land-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-land-400 active:scale-95"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}
```

## BuyModal Component

```tsx
// src/components/game/marketplace/BuyModal.tsx
"use client";

import { useEffect, useState } from "react";
import type { Listing, Property } from "@akkuea/shared";
import { usePropertyActions } from "@/hooks/usePropertyActions";
import { useLandBalance } from "@/hooks/useLandBalance";
import { useGameWallet } from "@/hooks/useGameWallet";
import { formatLand, shortenAddress } from "@/lib/format";
import { tileColor } from "@/lib/tileColors";

export function BuyModal({
  listing,
  property,
  onClose,
  onSuccess,
}: {
  listing: Listing;
  property: Property;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { address } = useGameWallet();
  const { balance } = useLandBalance(address);
  const { state, errorMessage, execute } = usePropertyActions();
  const canAfford = balance != null && balance >= listing.priceInLand;
  const bg = tileColor(listing.seller, property.level);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBuy = () =>
    execute(
      () => Promise.resolve("placeholder-xdr"), // replaced by typed client in C5-013
      onSuccess,
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-surface-border bg-surface-800 overflow-hidden animate-slide-up sm:animate-fade-in">
        {/* Property preview header */}
        <div
          className="flex h-20 items-center justify-center text-4xl font-black text-white/70"
          style={{ backgroundColor: bg }}
        >
          {property.level[0].toUpperCase()}
        </div>

        <div className="p-5">
          <h2 className="text-base font-bold text-white">
            Buy {property.level} property ({property.coordinates.x},{" "}
            {property.coordinates.y})
          </h2>
          <p className="mt-1 text-xs text-surface-600">
            From {shortenAddress(listing.seller)}
          </p>

          <div className="mt-4 space-y-2 rounded-xl bg-surface-900 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-600">Price</span>
              <span className="font-semibold text-white">
                {formatLand(listing.priceInLand)} LAND
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-600">Your balance</span>
              <span className={canAfford ? "text-green-400" : "text-red-400"}>
                {balance != null ? `${formatLand(balance)} LAND` : "..."}
              </span>
            </div>
          </div>

          {!canAfford && balance != null && (
            <p className="mt-2 text-xs text-red-400">
              You need {formatLand(listing.priceInLand - balance)} more LAND.
            </p>
          )}

          {errorMessage && (
            <p className="mt-2 text-xs text-red-400">{errorMessage}</p>
          )}

          {state === "success" && (
            <p className="mt-2 text-xs text-green-400">
              Property purchased successfully.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm text-white hover:bg-surface-700"
            >
              Cancel
            </button>
            <button
              onClick={handleBuy}
              disabled={
                !canAfford || state === "pending" || state === "success"
              }
              title={!canAfford ? "Insufficient LAND balance" : undefined}
              className="flex-1 rounded-xl bg-land-500 py-2.5 text-sm font-semibold text-white hover:bg-land-400 disabled:opacity-50 transition active:scale-95"
            >
              {state === "pending" ? "Buying..." : "Confirm Purchase"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Empty States

```tsx
// In ListingGrid when listings.length === 0 after filters:
<div className="flex flex-col items-center justify-center py-20 text-center">
  <p className="text-lg font-semibold text-white">No listings found</p>
  <p className="mt-2 text-sm text-surface-600">
    {hasActiveFilters
      ? "Try adjusting your filters."
      : "No properties are listed for sale right now."}
  </p>
  {hasActiveFilters && (
    <button
      onClick={clearFilters}
      className="mt-4 text-sm text-land-400 hover:underline"
    >
      Clear filters
    </button>
  )}
</div>
```

## Definition of Done

- Filter chips and sort control work instantly (client-side).
- `ListingCard` renders all property data correctly.
- `BuyModal` disables purchase when balance is insufficient.
- Modal is closable with Escape key and backdrop click.
- Empty state renders for no listings and filtered-to-empty results.
- Listing fades out after successful purchase.
- All CI workflows pass on the pull request.
