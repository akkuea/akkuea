# C5-010: Build Property Detail Panel and Action Flows

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-010         |
| Area            | GAME           |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | C5-007         |
| Estimated Lines | 280-380        |

## Component Structure

```
src/components/game/PropertyPanel.tsx
src/components/game/panel/ImprovementProgress.tsx
src/components/game/panel/actions/BuyAction.tsx
src/components/game/panel/actions/ImproveAction.tsx
src/components/game/panel/actions/ListAction.tsx
src/components/game/panel/actions/ClaimAction.tsx
src/hooks/usePropertyActions.ts
src/lib/format.ts
```

## Panel Layout: Desktop Sidebar + Mobile Bottom Sheet

```tsx
// src/components/game/PropertyPanel.tsx
"use client";

import { useEffect, useState } from "react";
import type { Property } from "@akkuea/shared";
import { ImprovementProgress } from "./panel/ImprovementProgress";
import { BuyAction } from "./panel/actions/BuyAction";
import { ImproveAction } from "./panel/actions/ImproveAction";
import { ListAction } from "./panel/actions/ListAction";
import { ClaimAction } from "./panel/actions/ClaimAction";
import { useGameWallet } from "@/hooks/useGameWallet";
import { useAccruedIncome } from "@/hooks/useAccruedIncome";

export function PropertyPanel({
  property,
  onActionComplete,
}: {
  property: Property | null;
  onActionComplete: () => void;
}) {
  const { address, isConnected } = useGameWallet();
  const [isVisible, setIsVisible] = useState(false);
  const accruedIncome = useAccruedIncome(property);

  useEffect(() => {
    setIsVisible(!!property);
  }, [property?.id]);

  const isOwner = !!address && address === property?.owner;
  const isUnowned = !property?.owner;
  const isListedByOther = !!property?.isListed && !isOwner;

  // Desktop: fixed sidebar; Mobile: bottom sheet via translate
  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={[
          "hidden lg:block w-80 rounded-2xl border border-surface-border bg-surface-800",
          "transition-all duration-250",
          isVisible
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-4 pointer-events-none",
        ].join(" ")}
      >
        <PanelContent
          property={property}
          isOwner={isOwner}
          isUnowned={isUnowned}
          isListedByOther={isListedByOther}
          isConnected={isConnected}
          accruedIncome={accruedIncome}
          onActionComplete={onActionComplete}
        />
      </div>

      {/* Mobile bottom sheet */}
      <div
        className={[
          "lg:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-2xl",
          "border-t border-surface-border bg-surface-800 shadow-2xl",
          "transition-transform duration-300",
          isVisible ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="mx-auto my-3 h-1 w-12 rounded-full bg-surface-border" />
        <PanelContent
          property={property}
          isOwner={isOwner}
          isUnowned={isUnowned}
          isListedByOther={isListedByOther}
          isConnected={isConnected}
          accruedIncome={accruedIncome}
          onActionComplete={onActionComplete}
        />
      </div>

      {/* Mobile backdrop */}
      {isVisible && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsVisible(false)}
        />
      )}
    </>
  );
}
```

## PanelContent

```tsx
function PanelContent({
  property,
  isOwner,
  isUnowned,
  isListedByOther,
  isConnected,
  accruedIncome,
  onActionComplete,
}: PanelContentProps) {
  if (!property) {
    return (
      <div className="flex h-48 items-center justify-center p-6">
        <p className="text-sm text-surface-600">
          Select a property on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-4">
        <p className="text-xs text-surface-600">
          ({property.coordinates.x}, {property.coordinates.y})
        </p>
        <h2 className="mt-0.5 text-lg font-bold text-white capitalize">
          {property.level} Property
        </h2>
        <p className="mt-1 font-mono text-xs text-surface-600">
          {property.owner
            ? `${property.owner.slice(0, 8)}...${property.owner.slice(-6)}`
            : "Available from Treasury"}
        </p>
      </div>

      {/* Building level progression */}
      <ImprovementProgress level={property.level} className="mb-5" />

      {/* Actions */}
      <div className="space-y-2.5">
        {!isConnected && (
          <a
            href="/login"
            className="block w-full rounded-xl bg-land-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-land-400"
          >
            Connect Wallet to Act
          </a>
        )}
        {isConnected && isUnowned && (
          <BuyAction property={property} onComplete={onActionComplete} />
        )}
        {isConnected && isOwner && (
          <>
            <ClaimAction
              property={property}
              accruedIncome={accruedIncome}
              onComplete={onActionComplete}
            />
            <ImproveAction property={property} onComplete={onActionComplete} />
            <ListAction property={property} onComplete={onActionComplete} />
          </>
        )}
        {isConnected && isListedByOther && (
          <BuyAction
            property={property}
            isMarketplace
            onComplete={onActionComplete}
          />
        )}
      </div>
    </div>
  );
}
```

## ImprovementProgress Component

Visual four-step progression bar:

```tsx
// src/components/game/panel/ImprovementProgress.tsx
const LEVELS = ["vacant", "residential", "commercial", "skyscraper"] as const;
const LEVEL_LABEL: Record<string, string> = {
  vacant: "Vacant",
  residential: "Res.",
  commercial: "Com.",
  skyscraper: "Sky.",
};

export function ImprovementProgress({
  level,
  className,
}: {
  level: string;
  className?: string;
}) {
  const currentIndex = LEVELS.indexOf(level as (typeof LEVELS)[number]);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {LEVELS.map((l, i) => (
        <div key={l} className="flex-1">
          <div
            className={[
              "h-1.5 rounded-full transition-colors",
              i <= currentIndex ? "bg-land-500" : "bg-surface-700",
            ].join(" ")}
          />
          <p
            className={[
              "mt-1 text-center text-[9px]",
              i === currentIndex
                ? "text-land-400 font-semibold"
                : "text-surface-600",
            ].join(" ")}
          >
            {LEVEL_LABEL[l]}
          </p>
        </div>
      ))}
    </div>
  );
}
```

## usePropertyActions Hook

All action functions go through this hook. Each calls `signAndSubmitTx` via `useGameWallet` and updates optimistic state before the transaction confirms.

```typescript
// src/hooks/usePropertyActions.ts
"use client";

import { useState } from "react";
import { useGameWallet } from "./useGameWallet";

type ActionState = "idle" | "pending" | "success" | "error";

export function usePropertyActions() {
  const { signAndSubmitTx } = useGameWallet();
  const [state, setState] = useState<ActionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function execute(
    buildXdr: () => Promise<string>,
    onSuccess?: () => void,
  ) {
    setState("pending");
    setErrorMessage(null);
    try {
      const xdr = await buildXdr();
      await signAndSubmitTx(xdr);
      setState("success");
      onSuccess?.();
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Transaction failed",
      );
      setTimeout(() => setState("idle"), 4000);
    }
  }

  return { state, errorMessage, execute };
}
```

## format.ts

```typescript
// src/lib/format.ts
export function formatLand(amount: bigint): string {
  const whole = amount / 10_000_000n;
  const fraction = amount % 10_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(7, "0").replace(/0+$/, "")}`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
```

## Definition of Done

- Panel slides in on desktop, rises as bottom sheet on mobile.
- All four ownership states render the correct actions.
- `ImprovementProgress` shows the correct active step.
- `usePropertyActions` handles pending, success, and error states.
- Backdrop closes the mobile bottom sheet on tap.
- All CI workflows pass on the pull request.
