/**
 * @file game.ts
 * @description Shared game types for Akkuea Land — the contract between
 * Soroban smart contracts (Rust) and the Next.js/React frontend.
 *
 * All types represent on-chain state as returned by Quasar typed clients
 * and consumed by React components. No `any`, no disabled lint rules.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AKKUEA LAND — TOKEN ECONOMY SPECIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LAND Token
 * ----------
 * Symbol        : LAND
 * Starting balance : 1 000 LAND per new player wallet (airdropped at first
 *                   on-chain interaction, enforced by the PlayerRegistry
 *                   contract).
 *
 * Epoch (rental cycle)
 * --------------------
 * Epoch length  : 17 280 ledgers  (~24 hours at the nominal 5-second ledger
 *                 close time on Stellar Testnet/Mainnet).
 * Base rental   : 10 LAND per epoch for a raw (EMPTY) plot.
 *
 * Improvement Levels & Costs
 * --------------------------
 * Level        | Label       | Upgrade cost (LAND) | Rental multiplier
 * -------------|-------------|---------------------|-------------------
 * 0  (default) | EMPTY       | —                   | 1×  (base rate)
 * 1            | HOUSE       | 100 LAND            | 2×  (20 LAND / epoch)
 * 2            | APARTMENT   | 300 LAND            | 5×  (50 LAND / epoch)
 * 3            | SKYSCRAPER  | 1 000 LAND          | 12× (120 LAND / epoch)
 *
 * Upgrade costs are additive from the current level to the next, not
 * cumulative from EMPTY. Example: upgrading HOUSE → APARTMENT costs 300 LAND,
 * not 400 LAND.
 *
 * Listing & Marketplace
 * ----------------------
 * Minimum listing price : 1 LAND (enforced by the Marketplace contract).
 * Marketplace fee       : 2 % of sale price, burned on settlement.
 *
 * Rent Claiming
 * -------------
 * A property owner may claim rental income at any time. The claimable amount
 * is calculated as:
 *
 *   claimable = floor((currentLedger - lastClaimedLedger) / EPOCH_LEDGERS)
 *               × BASE_RENTAL_RATE
 *               × rentalRateMultiplier
 *
 * Unclaimed epochs do not expire; they accumulate indefinitely.
 *
 * Numeric Constants (mirrors apps/contracts/src/constants.rs)
 * -----------------------------------------------------------
 * STARTING_BALANCE      = 1_000          (LAND, 7-decimal fixed-point)
 * EPOCH_LEDGERS         = 17_280
 * BASE_RENTAL_RATE      = 10             (LAND per epoch)
 * HOUSE_COST            = 100            (LAND)
 * APARTMENT_COST        = 300            (LAND)
 * SKYSCRAPER_COST       = 1_000         (LAND)
 * HOUSE_MULTIPLIER      = 2
 * APARTMENT_MULTIPLIER  = 5
 * SKYSCRAPER_MULTIPLIER = 12
 * MARKETPLACE_FEE_BPS   = 200           (basis points = 2 %)
 * MIN_LISTING_PRICE     = 1             (LAND)
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
// hard-coding magic numbers.  The authoritative source is the economy spec
// comment block at the top of this file; these values must stay in sync with
// apps/contracts/src/constants.rs.

/** LAND tokens awarded to a new player on first interaction. */
export const STARTING_BALANCE: LandAmount = 1_000;

/** Number of Soroban ledgers in one rental epoch (~24 hours). */
export const EPOCH_LEDGERS: LedgerNumber = 17_280;

/** Base rental income per epoch for an unimproved (EMPTY) plot. */
export const BASE_RENTAL_RATE: LandAmount = 10;

/** Upgrade cost from EMPTY → HOUSE (LAND). */
export const HOUSE_COST: LandAmount = 100;

/** Upgrade cost from HOUSE → APARTMENT (LAND). */
export const APARTMENT_COST: LandAmount = 300;

/** Upgrade cost from APARTMENT → SKYSCRAPER (LAND). */
export const SKYSCRAPER_COST: LandAmount = 1_000;

/** Rental rate multiplier for the HOUSE level. */
export const HOUSE_MULTIPLIER = 2 as const;

/** Rental rate multiplier for the APARTMENT level. */
export const APARTMENT_MULTIPLIER = 5 as const;

/** Rental rate multiplier for the SKYSCRAPER level. */
export const SKYSCRAPER_MULTIPLIER = 12 as const;

/** Marketplace fee in basis points (200 bps = 2 %). */
export const MARKETPLACE_FEE_BPS = 200 as const;

/** Minimum price at which a property may be listed (LAND). */
export const MIN_LISTING_PRICE: LandAmount = 1;

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

/**
 * Maps each `ImprovementLevel` to its rental rate multiplier.
 * Useful for computing accrued rent without a switch statement.
 */
export const IMPROVEMENT_MULTIPLIER: Readonly<
  Record<ImprovementLevel, number>
> = {
  EMPTY: 1,
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
