# C5-001: Define Game Economy, Property Schema, and Shared Types

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-001         |
| Area            | SHARED         |
| Difficulty      | Medium         |
| Labels          | shared, medium |
| Dependencies    | None           |
| Estimated Lines | 80-150         |

## TypeScript Type Definitions

Create `apps/shared/src/types/game.ts` with the following types:

```typescript
export type ImprovementLevel =
  | "vacant"
  | "residential"
  | "commercial"
  | "skyscraper";

export interface PropertyCoordinates {
  x: number;
  y: number;
}

export interface Property {
  id: string;
  coordinates: PropertyCoordinates;
  owner: string | null;
  level: ImprovementLevel;
  lastClaimedLedger: number;
  accruedIncome: bigint;
}

export interface Listing {
  propertyId: string;
  seller: string;
  priceInLand: bigint;
  createdLedger: number;
}

export interface Player {
  walletAddress: string;
  landBalance: bigint;
  ownedPropertyIds: string[];
}

export type GameEvent =
  | {
      type: "PropertyBought";
      propertyId: string;
      buyer: string;
      price: bigint;
      ledger: number;
    }
  | {
      type: "PropertyListed";
      propertyId: string;
      seller: string;
      price: bigint;
      ledger: number;
    }
  | {
      type: "PropertyImproved";
      propertyId: string;
      owner: string;
      newLevel: ImprovementLevel;
      ledger: number;
    }
  | {
      type: "RentalClaimed";
      propertyId: string;
      owner: string;
      amount: bigint;
      ledger: number;
    }
  | {
      type: "ListingCancelled";
      propertyId: string;
      seller: string;
      ledger: number;
    };
```

Export all types from `apps/shared/src/types/index.ts` (or from the shared package index).

## Economy Specification

Document these constants in `docs/game/ECONOMY.md`. The contracts must implement these exact values.

| Constant                      | Value        | Unit            |
| ----------------------------- | ------------ | --------------- |
| Starter LAND allocation       | 1,000        | LAND tokens     |
| Epoch length                  | 100          | ledgers         |
| Base rental rate              | 10           | LAND per epoch  |
| Residential multiplier        | 1.5x         | of base rate    |
| Commercial multiplier         | 3x           | of base rate    |
| Skyscraper multiplier         | 6x           | of base rate    |
| Improvement cost: Residential | 200          | LAND tokens     |
| Improvement cost: Commercial  | 600          | LAND tokens     |
| Improvement cost: Skyscraper  | 1,800        | LAND tokens     |
| Starter property claim        | 1 per player | one-time only   |
| City grid size                | 20x20        | 400 total tiles |
| Initial property price        | 500          | LAND tokens     |

These values are chosen for testnet playability: a player can buy a property, earn rental income, and improve it within a realistic testnet session.

## File Location

```
apps/shared/src/types/game.ts        ← all game types
apps/shared/src/types/index.ts       ← re-export game types
docs/game/ECONOMY.md                 ← economy specification (read by all CONTRACTS and GAME issues)
```

`apps/akkuea-land` imports these types via `@akkuea/shared`. The game contracts implement the numeric constants from `ECONOMY.md` exactly.

## Definition of Done

- `apps/shared/src/types/game.ts` is created with all types above.
- Types are re-exported from the shared package.
- `docs/game/ECONOMY.md` documents all numeric constants.
- `bun run type-check` passes in `apps/shared`.
- All CI workflows pass on the pull request.
