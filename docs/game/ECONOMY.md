# Akkuea Land — Game Economy Specification

> **Canonical source**: The numeric constants in this document are mirrored in
> `apps/shared/src/types/game.ts` (TypeScript) and
> `apps/contracts/src/constants.rs` (Rust). If the three disagree, the Rust
> file governs because it is what is actually enforced on-chain.

---

## Overview

Akkuea Land is a tile-based property game built on top of the Stellar/Soroban
blockchain. Players buy land parcels, construct buildings, collect rental
income in LAND tokens, and trade properties on an open marketplace.

---

## LAND Token

| Parameter        | Value                     |
| ---------------- | ------------------------- |
| Symbol           | `LAND`                    |
| Decimals         | 7 (Stellar standard)      |
| Starting balance | **1 000 LAND** per wallet |

Every wallet that interacts with the `PlayerRegistry` contract for the first
time receives a one-time airdrop of **1 000 LAND**. Subsequent interactions do
not trigger another airdrop.

---

## Epoch (Rental Cycle)

| Parameter    | Value                                                |
| ------------ | ---------------------------------------------------- |
| Epoch length | **17 280 ledgers** (~24 h at 5 s/ledger)             |
| Base rental  | **10 LAND per epoch** for an unimproved (EMPTY) plot |

Ledger close time on Stellar is nominally 5 seconds.  
17 280 ledgers × 5 s = 86 400 s = 24 hours.

---

## Improvement Levels

Properties start at level `EMPTY` and can be upgraded in sequence:

```
EMPTY  →  HOUSE  →  APARTMENT  →  SKYSCRAPER
```

Upgrades are **one-directional**; there is no downgrade path.

### Cost & Multiplier Table

| Level       | Label        | Upgrade cost | Rental multiplier | Effective rate   |
| ----------- | ------------ | ------------ | ----------------- | ---------------- |
| 0 (default) | `EMPTY`      | —            | **1×**            | 10 LAND / epoch  |
| 1           | `HOUSE`      | 100 LAND     | **2×**            | 20 LAND / epoch  |
| 2           | `APARTMENT`  | 300 LAND     | **5×**            | 50 LAND / epoch  |
| 3           | `SKYSCRAPER` | 1 000 LAND   | **12×**           | 120 LAND / epoch |

> **Upgrade cost semantics**: costs are charged for the _next_ upgrade step
> only, not cumulatively from `EMPTY`.  
> Example: upgrading `HOUSE → APARTMENT` costs **300 LAND**, not 400 LAND.

---

## Rent Calculation

Claimable rent is computed on-chain at claim time:

```
claimable = floor(
  (currentLedger - lastClaimedLedger) / EPOCH_LEDGERS
) × BASE_RENTAL_RATE × rentalRateMultiplier
```

Key behaviour:

- Only **whole epochs** are paid; partial epochs do not earn rent.
- Unclaimed epochs **accumulate indefinitely** — there is no expiry.
- `lastClaimedLedger` is updated to the ledger at the start of the last fully
  counted epoch (not to `currentLedger`), preserving fractional-epoch carry.

---

## Marketplace

| Parameter          | Value                          |
| ------------------ | ------------------------------ |
| Minimum price      | **1 LAND**                     |
| Marketplace fee    | **2 %** of sale price (burned) |
| Fee representation | 200 basis points (BPS)         |

When a sale settles:

1. `price × 0.02` LAND is burned from circulation.
2. `price × 0.98` LAND is transferred to the seller.
3. Property ownership is transferred to the buyer.
4. Any existing listing for that property is removed.

---

## Numeric Constants

These constants are exported from `apps/shared/src/types/game.ts` for use in
frontend code:

```ts
STARTING_BALANCE = 1_000; // LAND tokens
EPOCH_LEDGERS = 17_280; // ledgers per epoch
BASE_RENTAL_RATE = 10; // LAND per epoch (EMPTY plot)
HOUSE_COST = 100; // LAND to upgrade EMPTY → HOUSE
APARTMENT_COST = 300; // LAND to upgrade HOUSE → APARTMENT
SKYSCRAPER_COST = 1_000; // LAND to upgrade APARTMENT → SKYSCRAPER
HOUSE_MULTIPLIER = 2;
APARTMENT_MULTIPLIER = 5;
SKYSCRAPER_MULTIPLIER = 12;
MARKETPLACE_FEE_BPS = 200; // 2 %
MIN_LISTING_PRICE = 1; // LAND
```

---

## Event Taxonomy

Four on-chain events are defined. Their TypeScript shapes live in `game.ts`
under the `GameEvent` union type.

| Event              | Emitted by           | Trigger                            |
| ------------------ | -------------------- | ---------------------------------- |
| `PropertyBought`   | `Marketplace`        | A listing is purchased             |
| `PropertyListed`   | `Marketplace`        | An owner creates a listing         |
| `PropertyImproved` | `ImprovementManager` | An owner upgrades a building level |
| `RentalClaimed`    | `RentalManager`      | An owner claims accumulated rent   |

---

_Last updated: 2025 — Cycle 5_
