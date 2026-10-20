/**
 * @file game.ts
 * @description Shared game types for Akkuea Land - the contract between
 * Soroban smart contracts (Rust) and the Next.js/React frontend.
 *
 * All types represent on-chain state as returned by Quasar typed clients
 * and consumed by React components. No `any`, no disabled lint rules.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AKKUEA LAND - TOKEN ECONOMY SPECIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LAND Token
 * ----------
 * Symbol        : LAND (7 decimals, 1 LAND = 10_000_000 base units)
 * Starting balance : 1 000 LAND, granted once per wallet by the testnet
 *                   `faucet` on the game-land-token contract.
 *
 * Epoch (rental cycle)
 * --------------------
 * Epoch length  : 100 ledgers (about 8 minutes at the nominal 5-second
 *                 ledger close time).
 * Base rental   : 10 LAND per epoch for a vacant (EMPTY) plot.
 *
 * Improvement Levels & Costs
 * --------------------------
 * On-chain level | Label (contract) | Upgrade cost to reach it | Rental multiplier
 * ---------------|------------------|--------------------------|-------------------
 * 0  (default)   | EMPTY (vacant)   | -                        | 1x   (10 LAND / epoch)
 * 1              | HOUSE (resid.)   | 200 LAND                 | 3/2  (15 LAND / epoch)
 * 2              | APARTMENT (comm.)| 600 LAND                 | 3/1  (30 LAND / epoch)
 * 3              | SKYSCRAPER       | 1 800 LAND               | 6/1  (60 LAND / epoch)
 *
 * Upgrade costs are charged per step, not cumulatively from EMPTY. Example:
 * upgrading HOUSE to APARTMENT costs 600 LAND.
 *
 * Listing & Marketplace
 * ----------------------
 * A listing price must be greater than zero (the contract rejects
 * `price <= 0`; there is no other minimum). `buy` transfers the full price
 * from buyer to seller: there is no marketplace fee and nothing is burned.
 *
 * Rent Claiming
 * -------------
 * A property owner may claim rental income at any time. The claimable amount
 * is calculated as (see computeAccruedRent below):
 *
 *   rate      = floor(BASE_RENTAL_RATE * numerator / denominator)
 *   claimable = rate * floor((currentLedger - lastClaimedLedger) / EPOCH_LEDGERS)
 *
 * Unclaimed epochs do not expire; they accumulate indefinitely. Claiming sets
 * lastClaimedLedger to the current ledger, so a partial epoch is not carried.
 *
 * Numeric Constants (mirrors
 * apps/contracts/contracts/game-engine/src/constants.rs, in whole LAND)
 * -----------------------------------------------------------------------
 * STARTING_BALANCE      = 1_000          (LAND, testnet faucet grant)
 * EPOCH_LEDGERS         = 100            (contract: EPOCH_LENGTH)
 * BASE_RENTAL_RATE      = 10             (LAND per epoch)
 * HOUSE_COST            = 200            (contract: IMPROVEMENT_COST_RESIDENTIAL)
 * APARTMENT_COST        = 600            (contract: IMPROVEMENT_COST_COMMERCIAL)
 * SKYSCRAPER_COST       = 1_800          (contract: IMPROVEMENT_COST_SKYSCRAPER)
 * HOUSE_MULTIPLIER      = [3, 2]         (contract: MULTIPLIER_RESIDENTIAL)
 * APARTMENT_MULTIPLIER  = [3, 1]         (contract: MULTIPLIER_COMMERCIAL)
 * SKYSCRAPER_MULTIPLIER = [6, 1]         (contract: MULTIPLIER_SKYSCRAPER)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Primitive Aliases ────────────────────────────────────────────────────────

/**
 * A Stellar public key (G…) identifying a wallet.
 * Kept as `string` because Stellar addresses are not numeric, but callers
 * should validate with `StrKey.isValidEd25519PublicKey` before use.
 */
export type WalletAddress = string;

/**
 * A Soroban ledger sequence number.  Always a non-negative integer.
 * Represented as `number` because Soroban returns i64 values that fit
 * safely within JS Number for all practical ledger counts.
 */
export type LedgerNumber = number;

/**
 * An amount of LAND tokens stored as a whole-number integer in the contract's
 * 7-decimal fixed-point representation (i.e. 1 LAND = 10_000_000 stroops).
 * Frontend code should convert to a human-readable decimal before display.
 */
export type LandAmount = number;

// ─── Coordinates ─────────────────────────────────────────────────────────────

/**
 * The position of a property on the 2-D game grid.
 * Both axes are zero-indexed non-negative integers.
 */
export interface Coordinates {
  x: number;
  y: number;
}

// ─── Improvement Level ───────────────────────────────────────────────────────

/**
 * The four building levels a property can reach.
 * Stored on-chain as an enum variant; surfaced here as a string literal union
 * so that TypeScript can exhaustiveness-check switch statements.
 *
 * Progression (one-directional):  EMPTY → HOUSE → APARTMENT → SKYSCRAPER
 */
export type ImprovementLevel = "EMPTY" | "HOUSE" | "APARTMENT" | "SKYSCRAPER";

/**
 * Discriminated-union representation of an improvement, carrying the level
 * plus level-specific metadata.  Use this when you need to branch on the
 * building type; use `ImprovementLevel` when you only need the label.
 */
export type Improvement =
  | { level: "EMPTY" }
  | { level: "HOUSE"; upgradedAtLedger: LedgerNumber }
  | { level: "APARTMENT"; upgradedAtLedger: LedgerNumber }
  | { level: "SKYSCRAPER"; upgradedAtLedger: LedgerNumber };

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * The full on-chain state of a single land parcel.
 *
 * @property id                - Unique identifier, derived as `"${x}_${y}"`.
 * @property coordinates       - Grid position of the parcel.
 * @property owner             - Current owner's Stellar public key, or `null`
 *                               if the parcel has never been purchased.
 * @property improvement       - Current building level (discriminated union).
 * @property rentalRateMultiplier - Multiplier applied to the base rental rate
 *                               (mirrors the ImprovementLevel multiplier table
 *                               in the economy spec above).
 * @property lastClaimedLedger - The ledger at which the owner last claimed
 *                               rental income.  Used to compute accrued rent.
 */
export interface Property {
  id: string;
  coordinates: Coordinates;
  owner: WalletAddress | null;
  improvement: Improvement;
  rentalRateMultiplier: number;
  lastClaimedLedger: LedgerNumber;
}

// ─── Player ──────────────────────────────────────────────────────────────────

/**
 * Represents a player's wallet-level state as returned by the PlayerRegistry
 * contract.
 *
 * @property walletAddress - The player's Stellar public key (G…).
 * @property landBalance   - Current LAND token balance in fixed-point stroops.
 */
export interface Player {
  walletAddress: WalletAddress;
  landBalance: LandAmount;
}

// ─── Listing ─────────────────────────────────────────────────────────────────

/**
 * An active marketplace listing for a property.
 *
 * @property propertyId    - The `id` field of the listed `Property`.
 * @property seller        - Stellar public key of the listing owner.
 * @property price         - Asking price in LAND fixed-point stroops.
 * @property createdLedger - Ledger at which the listing was created.
 */
export interface Listing {
  propertyId: string;
  seller: WalletAddress;
  price: LandAmount;
  createdLedger: LedgerNumber;
}

// ─── Game Events ─────────────────────────────────────────────────────────────

/**
 * Emitted by the Marketplace contract when a property is purchased.
 */
export interface PropertyBoughtEvent {
  type: "PropertyBought";
  propertyId: string;
  buyer: WalletAddress;
  seller: WalletAddress | null;
  price: LandAmount;
  ledger: LedgerNumber;
}

/**
 * Emitted by the Marketplace contract when a property is listed for sale.
 */
export interface PropertyListedEvent {
  type: "PropertyListed";
  propertyId: string;
  seller: WalletAddress;
  price: LandAmount;
  ledger: LedgerNumber;
}

/**
 * Emitted by the ImprovementManager contract when a building level increases.
 */
export interface PropertyImprovedEvent {
  type: "PropertyImproved";
  propertyId: string;
  owner: WalletAddress;
  previousLevel: ImprovementLevel;
  newLevel: ImprovementLevel;
  cost: LandAmount;
  ledger: LedgerNumber;
}

/**
 * Emitted by the RentalManager contract when an owner claims accrued rent.
 */
export interface RentalClaimedEvent {
  type: "RentalClaimed";
  propertyId: string;
  owner: WalletAddress;
  amountClaimed: LandAmount;
  fromLedger: LedgerNumber;
  toLedger: LedgerNumber;
}

/**
 * Union of all on-chain game events.  Use the `type` discriminant to narrow
 * to a specific event variant.
 */
export type GameEvent =
  | PropertyBoughtEvent
  | PropertyListedEvent
  | PropertyImprovedEvent
  | RentalClaimedEvent;

// ─── Economy Constants ───────────────────────────────────────────────────────
// Re-exported as typed constants so UI code can reference them without
// hard-coding magic numbers. Amounts are in whole LAND. The authoritative
// source is apps/contracts/contracts/game-engine/src/constants.rs; these
// values must stay in sync with it (game.test.ts checks them against it).

/**
 * A rental multiplier as an integer ratio [numerator, denominator], matching
 * the contract's `(i128, i128)` tuples so no floating point is involved.
 */
export type RentalMultiplier = readonly [
  numerator: number,
  denominator: number,
];

/** LAND tokens granted to a new player by the testnet faucet. */
export const STARTING_BALANCE: LandAmount = 1_000;

/** Number of Soroban ledgers in one rental epoch (contract EPOCH_LENGTH). */
export const EPOCH_LEDGERS: LedgerNumber = 100;

/** Base rental income per epoch for an unimproved (EMPTY) plot. */
export const BASE_RENTAL_RATE: LandAmount = 10;

/** Upgrade cost from EMPTY to HOUSE (LAND). */
export const HOUSE_COST: LandAmount = 200;

/** Upgrade cost from HOUSE to APARTMENT (LAND). */
export const APARTMENT_COST: LandAmount = 600;

/** Upgrade cost from APARTMENT to SKYSCRAPER (LAND). */
export const SKYSCRAPER_COST: LandAmount = 1_800;

/** Rental rate multiplier for the EMPTY level (1x). */
export const EMPTY_MULTIPLIER: RentalMultiplier = [1, 1];

/** Rental rate multiplier for the HOUSE level (1.5x). */
export const HOUSE_MULTIPLIER: RentalMultiplier = [3, 2];

/** Rental rate multiplier for the APARTMENT level (3x). */
export const APARTMENT_MULTIPLIER: RentalMultiplier = [3, 1];

/** Rental rate multiplier for the SKYSCRAPER level (6x). */
export const SKYSCRAPER_MULTIPLIER: RentalMultiplier = [6, 1];

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

/**
 * Improvement levels indexed by their on-chain numeric level (0 to 3), so
 * `IMPROVEMENT_LEVELS[prop.level]` gives the label for a contract value.
 */
export const IMPROVEMENT_LEVELS: readonly ImprovementLevel[] = [
  "EMPTY",
  "HOUSE",
  "APARTMENT",
  "SKYSCRAPER",
] as const;

/**
 * Maps each `ImprovementLevel` to its rental rate multiplier.
 * Useful for computing accrued rent without a switch statement.
 */
export const IMPROVEMENT_MULTIPLIER: Readonly<
  Record<ImprovementLevel, RentalMultiplier>
> = {
  EMPTY: EMPTY_MULTIPLIER,
  HOUSE: HOUSE_MULTIPLIER,
  APARTMENT: APARTMENT_MULTIPLIER,
  SKYSCRAPER: SKYSCRAPER_MULTIPLIER,
} as const;

/**
 * Maps each `ImprovementLevel` (except SKYSCRAPER, which is the max) to the
 * LAND cost required to upgrade to the next level.
 */
export const IMPROVEMENT_UPGRADE_COST: Readonly<
  Partial<Record<ImprovementLevel, LandAmount>>
> = {
  EMPTY: HOUSE_COST,
  HOUSE: APARTMENT_COST,
  APARTMENT: SKYSCRAPER_COST,
} as const;

/** LAND base units per whole LAND (7 decimals). */
const LAND_UNITS = 10_000_000;

/**
 * Rental income accrued over `elapsedLedgers` for a property at on-chain
 * `level` (0 to 3), in whole LAND.
 *
 * Ported from `calculate_accrued_income` in
 * apps/contracts/contracts/game-engine/src/lib.rs: the per-epoch rate is
 * computed first in base units (integer floor of rate * numerator /
 * denominator), then multiplied by the number of whole epochs. Partial epochs
 * earn nothing, and an unknown level uses the vacant multiplier, as on-chain.
 */
export function computeAccruedRent(
  elapsedLedgers: number,
  level: number,
): LandAmount {
  if (elapsedLedgers <= 0) return 0;
  const epochs = Math.floor(elapsedLedgers / EPOCH_LEDGERS);
  if (epochs === 0) return 0;

  const label = IMPROVEMENT_LEVELS[level] ?? "EMPTY";
  const [numerator, denominator] = IMPROVEMENT_MULTIPLIER[label];
  const ratePerEpoch = Math.floor(
    (BASE_RENTAL_RATE * LAND_UNITS * numerator) / denominator,
  );
  return (ratePerEpoch * epochs) / LAND_UNITS;
}
