# C5-009: Build City Map with Interactive Property Tiles

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-009         |
| Area            | GAME           |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | C5-007         |
| Estimated Lines | 220-300        |

## Component Structure

```
src/app/map/page.tsx
src/components/game/map/CityMap.tsx
src/components/game/map/PropertyTile.tsx
src/components/game/map/TileTooltip.tsx
src/hooks/useGameMap.ts
src/lib/tileColors.ts
```

## Color System

Deterministic owner color: the same address always produces the same color:

```typescript
// src/lib/tileColors.ts

export function addressToHsl(address: string | null): string {
  if (!address) return "hsl(230, 15%, 18%)"; // treasury: dark navy

  let hash = 5381;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) + hash) ^ address.charCodeAt(i);
    hash = hash >>> 0;
  }

  const hue = hash % 360;
  // Saturation and lightness vary by improvement level; applied in PropertyTile
  return `hsl(${hue}, 55%, 38%)`;
}

// Level brightens the color to signal improvement progression
export const LEVEL_LIGHTNESS: Record<string, number> = {
  vacant: 38,
  residential: 45,
  commercial: 52,
  skyscraper: 60,
};

export function tileColor(address: string | null, level: string): string {
  if (!address) return "hsl(230, 15%, 18%)";
  let hash = 5381;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) + hash) ^ address.charCodeAt(i);
    hash = hash >>> 0;
  }
  const hue = hash % 360;
  const lightness = LEVEL_LIGHTNESS[level] ?? 38;
  return `hsl(${hue}, 55%, ${lightness}%)`;
}
```

## CityMap with Event Delegation

```tsx
// src/components/game/map/CityMap.tsx
"use client";

import { useState, useCallback } from "react";
import type { Property } from "@akkuea/shared";
import { PropertyTile } from "./PropertyTile";
import { useGameMap } from "@/hooks/useGameMap";

interface CityMapProps {
  onSelectProperty: (property: Property) => void;
  selectedId: string | null;
  updatedTileId?: string | null;
}

export function CityMap({
  onSelectProperty,
  selectedId,
  updatedTileId,
}: CityMapProps) {
  const { properties, isLoading } = useGameMap();

  // Event delegation: one handler for all 400 tiles
  const handleGridClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest("[data-property-id]");
      if (!target) return;
      const id = target.getAttribute("data-property-id");
      if (id && properties[Number(id)]) {
        onSelectProperty(properties[Number(id)]);
      }
    },
    [properties, onSelectProperty],
  );

  if (isLoading) return <CityMapSkeleton />;

  return (
    <div
      role="grid"
      aria-label="City property map"
      onClick={handleGridClick}
      className="grid gap-px rounded-lg bg-surface-border overflow-hidden cursor-pointer"
      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
    >
      {Array.from({ length: 400 }, (_, i) => (
        <PropertyTile
          key={i}
          property={properties[i] ?? null}
          isSelected={selectedId === String(i)}
          isUpdated={updatedTileId === String(i)}
        />
      ))}
    </div>
  );
}

function CityMapSkeleton() {
  return (
    <div
      className="grid gap-px rounded-lg bg-surface-border overflow-hidden"
      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
    >
      {Array.from({ length: 400 }, (_, i) => (
        <div key={i} className="aspect-square animate-pulse bg-surface-800" />
      ))}
    </div>
  );
}
```

## PropertyTile

Tiles are rendered as plain `<div>` elements (not buttons) because click handling is on the parent. The `data-property-id` attribute is the event delegation hook.

```tsx
// src/components/game/map/PropertyTile.tsx
import { tileColor } from "@/lib/tileColors";
import { TileTooltip } from "./TileTooltip";
import type { Property } from "@akkuea/shared";

const LEVEL_BADGE: Record<string, string> = {
  vacant: "V",
  residential: "R",
  commercial: "C",
  skyscraper: "S",
};

interface PropertyTileProps {
  property: Property | null;
  isSelected: boolean;
  isUpdated: boolean;
}

export function PropertyTile({
  property,
  isSelected,
  isUpdated,
}: PropertyTileProps) {
  const bg = tileColor(property?.owner ?? null, property?.level ?? "vacant");
  const isListed = property?.isListed ?? false;

  return (
    <TileTooltip property={property}>
      <div
        data-property-id={property?.id}
        className={[
          "relative aspect-square select-none transition-all duration-100",
          "hover:scale-110 hover:z-10 hover:brightness-125",
          isSelected ? "ring-2 ring-white ring-inset z-20 scale-110" : "",
          isUpdated ? "animate-tile-pulse brightness-150" : "",
        ].join(" ")}
        style={{ backgroundColor: bg }}
      >
        {/* Improvement badge */}
        <span className="absolute bottom-0 left-0 text-[7px] font-bold leading-none text-white/60 p-[1px]">
          {LEVEL_BADGE[property?.level ?? "vacant"]}
        </span>

        {/* Listed indicator */}
        {isListed && (
          <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-gold-400 animate-tile-pulse" />
        )}
      </div>
    </TileTooltip>
  );
}
```

## TileTooltip

CSS-only tooltip, no library dependency:

```tsx
// src/components/game/map/TileTooltip.tsx
import type { Property } from "@akkuea/shared";

export function TileTooltip({
  property,
  children,
}: {
  property: Property | null;
  children: React.ReactNode;
}) {
  if (!property) return <>{children}</>;

  const owner = property.owner
    ? `${property.owner.slice(0, 4)}...${property.owner.slice(-4)}`
    : "Treasury";

  const label = [
    `(${property.coordinates.x},${property.coordinates.y})`,
    property.level,
    owner,
    property.isListed ? `Listed` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group/tile relative">
      {children}
      <div
        className={[
          "pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 z-30",
          "whitespace-nowrap rounded-lg bg-surface-800 border border-surface-border",
          "px-2 py-1 text-[10px] text-white shadow-xl",
          "opacity-0 scale-95 transition-all duration-100",
          "group-hover/tile:opacity-100 group-hover/tile:scale-100",
        ].join(" ")}
      >
        {label}
      </div>
    </div>
  );
}
```

## Map Page Layout

```tsx
// src/app/map/page.tsx
"use client";

import { useState } from "react";
import { CityMap } from "@/components/game/map/CityMap";
import { PropertyPanel } from "@/components/game/PropertyPanel";
import { useGameEventStream } from "@/hooks/useGameEventStream";
import type { Property } from "@akkuea/shared";

export default function MapPage() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  const [updatedTileId, setUpdatedTileId] = useState<string | null>(null);

  useGameEventStream((event) => {
    if (event.type === "PropertyBought" || event.type === "PropertyListed") {
      setUpdatedTileId(event.propertyId);
      setTimeout(() => setUpdatedTileId(null), 1500);
    }
  });

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 min-w-0">
        <CityMap
          onSelectProperty={setSelectedProperty}
          selectedId={selectedProperty?.id ?? null}
          updatedTileId={updatedTileId}
        />
      </div>
      <div className="w-full lg:w-80 lg:shrink-0">
        <PropertyPanel
          property={selectedProperty}
          onActionComplete={() => {
            /* refresh data */
          }}
        />
      </div>
    </div>
  );
}
```

## Mock Data

Create `src/mocks/game/properties.ts` with 400 properties: ~25% with non-null owners, ~10% at Residential or higher, ~5% listed. This makes the map look alive during development.

## Definition of Done

- 20x20 grid renders with color-coded tiles, improvement badges, and listing indicators.
- Hover tooltips show correct data.
- Click selects the tile and triggers `onSelectProperty`.
- Event delegation is used (one listener on the grid, not 400).
- Real-time tile animation plays on `PropertyBought` events.
- Responsive on mobile (375px).
- All CI workflows pass on the pull request.
