# Akkuea Land - Game Economy Specification

> **Canonical source**: The numeric constants in this document are mirrored in
> `apps/shared/src/types/game.ts` (TypeScript) and
> `apps/contracts/contracts/game-engine/src/constants.rs` (Rust). If they
> disagree, the Rust file governs because it is what is actually enforced
> on-chain. `apps/shared/src/types/game.test.ts` fails when the TypeScript
> values drift from the Rust ones.

---

## Overview

Akkuea Land is a tile-based property game built on top of the Stellar/Soroban
blockchain. Players buy land parcels, construct buildings, collect rental
income in LAND tokens, and trade properties on an open marketplace.

This is the pilot's visual/educational companion, not a separate product - see [`docs/strategy/product-brief.md`](../strategy/product-brief.md). The mechanics below (buy → accrue → claim) are a simplified, fully-automated mirror of the real pilot's flow, which instead runs on a monthly cycle gated by human-reviewed income evidence.

---

## LAND Token

| Parameter        | Value                     |
| ---------------- | ------------------------- |
| Symbol           | `LAND`                    |
| Decimals         | 7 (Stellar standard)      |
| Starting balance | **1 000 LAND** per wallet |

On testnet, every wallet can call the `faucet` function of the
`game-land-token` contract once to receive **1 000 LAND**. A second call from
the same wallet is rejected.

---

## Epoch (Rental Cycle)

| Parameter    | Value                                                |
| ------------ | ---------------------------------------------------- |
| Epoch length | **100 ledgers** (about 8 minutes at 5 s/ledger)      |
| Base rental  | **10 LAND per epoch** for an unimproved (EMPTY) plot |

Ledger close time on Stellar is nominally 5 seconds, so 100 ledgers is
about 500 seconds.

---

## Improvement Levels

Properties start at level `EMPTY` and can be upgraded in sequence:

```
EMPTY  →  HOUSE  →  APARTMENT  →  SKYSCRAPER
```

Upgrades are **one-directional**; there is no downgrade path.

### Cost & Multiplier Table

Multipliers are integer ratios `(numerator, denominator)`, as in the contract.

| Level       | Label        | Upgrade cost | Rental multiplier | Effective rate  |
| ----------- | ------------ | ------------ | ----------------- | --------------- |
| 0 (default) | `EMPTY`      | -            | **1/1** (1x)      | 10 LAND / epoch |
| 1           | `HOUSE`      | 200 LAND     | **3/2** (1.5x)    | 15 LAND / epoch |
| 2           | `APARTMENT`  | 600 LAND     | **3/1** (3x)      | 30 LAND / epoch |
| 3           | `SKYSCRAPER` | 1 800 LAND   | **6/1** (6x)      | 60 LAND / epoch |

The contract names these levels vacant, residential, commercial and
skyscraper.

> **Upgrade cost semantics**: costs are charged for the _next_ upgrade step
> only, not cumulatively from `EMPTY`.  
> Example: upgrading `HOUSE` to `APARTMENT` costs **600 LAND**, not 800 LAND.

---

## Rent Calculation

Claimable rent is computed on-chain at claim time
(`calculate_accrued_income` in `game-engine/src/lib.rs`, ported to
TypeScript as `computeAccruedRent` in `apps/shared/src/types/game.ts`):

```
rate      = floor(BASE_RENTAL_RATE * numerator / denominator)
claimable = rate * floor((currentLedger - lastClaimedLedger) / EPOCH_LEDGERS)
```

Key behaviour:

- Only **whole epochs** are paid; partial epochs do not earn rent.
- Unclaimed epochs **accumulate indefinitely** - there is no expiry.
- Claiming sets `lastClaimedLedger` to the current ledger, so the partial
  epoch in progress at claim time is not carried over.

---

## Marketplace

| Parameter       | Value                                         |
| --------------- | --------------------------------------------- |
| Minimum price   | Any price **greater than zero**               |
| Marketplace fee | **None**: the buyer pays the seller the price |

When a sale settles:

1. The full `price` in LAND is transferred from the buyer to the seller.
2. Property ownership is transferred to the buyer.
3. The listing for that property is removed.

---

## Numeric Constants

These constants are exported from `apps/shared/src/types/game.ts` for use in
frontend code:

```ts
STARTING_BALANCE = 1_000; // LAND tokens (testnet faucet grant)
EPOCH_LEDGERS = 100; // ledgers per epoch (contract EPOCH_LENGTH)
BASE_RENTAL_RATE = 10; // LAND per epoch (EMPTY plot)
HOUSE_COST = 200; // LAND to upgrade EMPTY to HOUSE
APARTMENT_COST = 600; // LAND to upgrade HOUSE to APARTMENT
SKYSCRAPER_COST = 1_800; // LAND to upgrade APARTMENT to SKYSCRAPER
EMPTY_MULTIPLIER = [1, 1];
HOUSE_MULTIPLIER = [3, 2];
APARTMENT_MULTIPLIER = [3, 1];
SKYSCRAPER_MULTIPLIER = [6, 1];
computeAccruedRent(elapsedLedgers, level); // whole LAND
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

_Last updated: 2025 - Cycle 5_
