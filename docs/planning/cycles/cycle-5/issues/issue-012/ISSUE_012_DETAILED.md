# C5-012: Build Player Dashboard and Income Tracker

## Issue Metadata

| Attribute       | Value            |
| --------------- | ---------------- |
| Issue ID        | C5-012           |
| Area            | GAME             |
| Difficulty      | Medium           |
| Labels          | frontend, medium |
| Dependencies    | C5-007, C5-013   |
| Estimated Lines | 220-300          |

## Component Structure

```
src/app/dashboard/page.tsx
src/components/game/dashboard/PortfolioSummary.tsx
src/components/game/dashboard/OwnedPropertyCard.tsx
src/components/game/dashboard/TransactionFeed.tsx
src/components/game/dashboard/EpochProgress.tsx
src/hooks/usePlayerDashboard.ts
```

## EpochProgress Component

Shows time remaining until the next rental income epoch. This gives players a reason to stay on the page:

```tsx
// src/components/game/dashboard/EpochProgress.tsx
"use client";

import { useEffect, useState } from "react";

const EPOCH_LENGTH = 100; // ledgers

export function EpochProgress({
  lastClaimedLedger,
}: {
  lastClaimedLedger: number;
}) {
  const [currentLedger, setCurrentLedger] = useState(lastClaimedLedger);

  useEffect(() => {
    // Poll current ledger every 10 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/game/ledger");
        const { ledger } = await res.json();
        setCurrentLedger(ledger);
      } catch {}
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const ledgersSinceClaim = currentLedger - lastClaimedLedger;
  const progressInEpoch = ledgersSinceClaim % EPOCH_LENGTH;
  const pct = Math.min((progressInEpoch / EPOCH_LENGTH) * 100, 100);
  const epochsAccrued = Math.floor(ledgersSinceClaim / EPOCH_LENGTH);

  return (
    <div className="rounded-xl bg-surface-900 p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-surface-600">
        <span>Next epoch</span>
        <span>{EPOCH_LENGTH - progressInEpoch} ledgers</span>
      </div>
      <div className="h-2 rounded-full bg-surface-700">
        <div
          className="h-2 rounded-full bg-land-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {epochsAccrued > 0 && (
        <p className="mt-2 text-xs text-green-400">
          {epochsAccrued} epoch{epochsAccrued > 1 ? "s" : ""} ready to claim
        </p>
      )}
    </div>
  );
}
```

## PortfolioSummary Component

```tsx
// src/components/game/dashboard/PortfolioSummary.tsx
"use client";

import { useState } from "react";
import { useGameWallet } from "@/hooks/useGameWallet";
import { useLandBalance } from "@/hooks/useLandBalance";
import { formatLand } from "@/lib/format";

export function PortfolioSummary({
  totalAccruedIncome,
  claimableIds,
  onClaimComplete,
}: {
  totalAccruedIncome: bigint;
  claimableIds: string[];
  onClaimComplete: () => void;
}) {
  const { address, signAndSubmitTx } = useGameWallet();
  const { balance, refresh } = useLandBalance(address);
  const [claimProgress, setClaimProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const handleClaimAll = async () => {
    setClaimProgress({ done: 0, total: claimableIds.length });
    let done = 0;
    const failures: string[] = [];

    for (const id of claimableIds) {
      try {
        const xdr = await buildClaimXdr(id); // replaced by typed client in C5-013
        await signAndSubmitTx(xdr);
        done++;
        setClaimProgress({ done, total: claimableIds.length });
      } catch {
        failures.push(id);
      }
    }

    await refresh();
    setClaimProgress(null);
    if (failures.length === 0) {
      onClaimComplete();
    } else {
      // surface partial failure
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 rounded-2xl border border-surface-border bg-surface-800 p-5 sm:grid-cols-3">
      <div>
        <p className="text-xs text-surface-600">LAND Balance</p>
        <p className="mt-1 text-2xl font-bold text-white">
          {balance != null ? formatLand(balance) : "..."}
        </p>
      </div>
      <div>
        <p className="text-xs text-surface-600">Accrued Income</p>
        <p className="mt-1 text-2xl font-bold text-green-400">
          +{formatLand(totalAccruedIncome)}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-1 flex items-center">
        <button
          onClick={handleClaimAll}
          disabled={claimableIds.length === 0 || claimProgress !== null}
          title={
            claimableIds.length === 0 ? "No income to claim yet" : undefined
          }
          className="w-full rounded-xl bg-green-700 py-2.5 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50 transition active:scale-95"
        >
          {claimProgress
            ? `Claiming ${claimProgress.done} of ${claimProgress.total}...`
            : "Claim All"}
        </button>
      </div>
    </div>
  );
}

async function buildClaimXdr(_propertyId: string): Promise<string> {
  return "placeholder"; // wired in C5-013
}
```

## OwnedPropertyCard

```tsx
// src/components/game/dashboard/OwnedPropertyCard.tsx
import Link from "next/link";
import { tileColor } from "@/lib/tileColors";
import { formatLand } from "@/lib/format";
import type { Property } from "@akkuea/shared";

export function OwnedPropertyCard({
  property,
  accruedIncome,
}: {
  property: Property;
  accruedIncome: bigint;
}) {
  const bg = tileColor(property.owner, property.level);
  const hasIncome = accruedIncome > 0n;

  return (
    <Link
      href={`/map?selected=${property.id}`}
      className={[
        "block rounded-2xl border bg-surface-800 overflow-hidden transition-all",
        "hover:border-land-500/40 hover:shadow-md hover:-translate-y-0.5",
        hasIncome ? "border-green-700/40" : "border-surface-border",
      ].join(" ")}
    >
      <div
        className="flex h-14 items-center justify-center text-xl font-black text-white/70"
        style={{ backgroundColor: bg }}
      >
        {property.level[0].toUpperCase()}
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-white capitalize">
          {property.level}
        </p>
        <p className="text-xs text-surface-600">
          ({property.coordinates.x}, {property.coordinates.y})
        </p>
        {hasIncome && (
          <p className="mt-1 text-xs font-semibold text-green-400">
            +{formatLand(accruedIncome)} LAND
          </p>
        )}
      </div>
    </Link>
  );
}
```

## TransactionFeed Component

```tsx
// src/components/game/dashboard/TransactionFeed.tsx
import type { GameEvent } from "@akkuea/shared";
import { formatLand } from "@/lib/format";

const EVENT_CONFIG: Record<
  GameEvent["type"],
  { label: string; color: string }
> = {
  PropertyBought: { label: "Bought", color: "text-land-400" },
  PropertyListed: { label: "Listed", color: "text-gold-400" },
  PropertyImproved: { label: "Improved", color: "text-blue-400" },
  RentalClaimed: { label: "Claimed", color: "text-green-400" },
  ListingCancelled: { label: "Cancelled", color: "text-surface-600" },
};

export function TransactionFeed({
  events,
  onLoadMore,
  hasMore,
}: {
  events: GameEvent[];
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-surface-600">
        No transactions yet. Buy a property to get started.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-surface-border">
        {events.map((event, i) => {
          const cfg = EVENT_CONFIG[event.type];
          return (
            <li key={i} className="flex items-center justify-between py-3">
              <div>
                <span className={`text-xs font-semibold ${cfg.color}`}>
                  {cfg.label}
                </span>
                <p className="mt-0.5 text-xs text-surface-600">
                  Property {event.propertyId} · Ledger{" "}
                  {event.ledger.toLocaleString()}
                </p>
              </div>
              {"amount" in event && event.amount != null && (
                <span className="text-sm font-semibold text-green-400">
                  {formatLand(event.amount)} LAND
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="mt-4 w-full text-sm text-surface-600 hover:text-white transition"
        >
          Load more
        </button>
      )}
    </div>
  );
}
```

## Empty Portfolio State

```tsx
// In dashboard page when ownedProperties.length === 0:
<div className="flex flex-col items-center justify-center py-20 text-center">
  <p className="text-lg font-semibold text-white">
    You don't own any properties yet.
  </p>
  <p className="mt-2 text-sm text-surface-600">
    Head to the city map to find your first property.
  </p>
  <Link
    href="/map"
    className="mt-5 rounded-xl bg-land-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-land-400"
  >
    View City Map
  </Link>
</div>
```

## Definition of Done

- Portfolio summary shows balance, accrued income, and "Claim All" with real progress.
- Claim All processes all claimable properties and handles partial failures gracefully.
- Epoch progress bar renders and polls for the current ledger.
- Property cards navigate to the map on click.
- Transaction feed renders with pagination.
- Empty portfolio state links to the city map.
- All CI workflows pass on the pull request.
