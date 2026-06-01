/**
 * Seeded mock data generator for the 20×20 Akkuea Land city grid.
 *
 * Uses a simple linear congruential generator (LCG) for deterministic
 * pseudo-random numbers so the map layout is identical across refreshes.
 */

import { GameProperty, BuildingLevel } from "../types/game.types";

// ── Seeded PRNG ──────────────────────────────────────────────────────────────

const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 2 ** 32;

function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return {
    /** Returns a float in [0, 1) */
    next(): number {
      state = (LCG_A * state + LCG_C) % LCG_M;
      return state / LCG_M;
    },
    /** Returns an integer in [min, max] inclusive */
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    /** Picks a random element from an array */
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
  };
}

// ── Mock Stellar Addresses ───────────────────────────────────────────────────

const MOCK_PLAYER_ADDRESSES = [
  "GABC1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZ56",
  "GDEF5678ABCD1234MNOP9012EFGH3456IJKL7890QRST1234UV56",
  "GHIJ9012KLMN3456OPQR7890STUV1234WXYZ5678ABCD9012EF56",
  "GKLM3456NOPQ7890RSTU1234VWXY5678ZABC9012DEFG3456HI56",
  "GNOP7890QRST1234UVWX5678YZAB9012CDEF3456GHIJ7890KL56",
  "GQRS1234TUVW5678XYZA9012BCDE3456FGHI7890JKLM1234NO56",
  "GTUV5678WXYZ1234ABCD9012EFGH3456IJKL7890MNOP5678QR56",
  "GWXY9012ZABC3456DEFG7890HIJK1234LMNO5678PQRS9012TU56",
  "GZAB3456CDEF7890GHIJ1234KLMN5678OPQR9012STUV3456WX56",
  "GCDE7890FGHI1234JKLM5678NOPQ9012RSTU3456VWXY7890ZA56",
  "GFGH1234IJKL5678MNOP9012QRST3456UVWX7890YZAB1234CD56",
  "GIJK5678LMNO9012PQRS3456TUVW7890XYZA1234BCDE5678FG56",
  "GLMN9012OPQR3456STUV7890WXYZ1234ABCD5678EFGH9012IJ56",
  "GOPQ3456RSTU7890VWXY1234ZABC5678DEFG9012HIJK3456LM56",
  "GRST7890UVWX1234YZAB5678CDEF9012GHIJ3456KLMN7890OP56",
];

const TREASURY = "GBTREASURY";

// ── Building Level Labels ────────────────────────────────────────────────────

export const BUILDING_LABELS: Record<BuildingLevel, string> = {
  0: "V", // Vacant
  1: "R", // Residential
  2: "C", // Commercial
  3: "S", // Skyscraper
};

export const BUILDING_NAMES: Record<BuildingLevel, string> = {
  0: "Vacant",
  1: "Residential",
  2: "Commercial",
  3: "Skyscraper",
};

// ── Grid Generator ───────────────────────────────────────────────────────────

const GRID_SIZE = 20;
const SEED = 42;

let cachedGrid: GameProperty[] | null = null;

/**
 * Generate a 20×20 grid of mock GameProperty data.
 * Results are memoised so repeated calls return the same array.
 *
 * Distribution:
 * - ~60 % owned by players (15 addresses)
 * - ~25 % treasury
 * - ~15 % unowned
 *
 * Building levels weighted: 40% L0, 30% L1, 20% L2, 10% L3
 * ~20% of player-owned tiles are listed for sale
 */
export function generateMockGrid(): GameProperty[] {
  if (cachedGrid) return cachedGrid;

  const rng = createSeededRng(SEED);
  const grid: GameProperty[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      // Determine ownership
      const ownerRoll = rng.next();
      let owner: string;
      if (ownerRoll < 0.6) {
        owner = rng.pick(MOCK_PLAYER_ADDRESSES);
      } else if (ownerRoll < 0.85) {
        owner = TREASURY;
      } else {
        owner = "";
      }

      // Building level (weighted)
      const lvlRoll = rng.next();
      let buildingLevel: BuildingLevel;
      if (lvlRoll < 0.4) buildingLevel = 0;
      else if (lvlRoll < 0.7) buildingLevel = 1;
      else if (lvlRoll < 0.9) buildingLevel = 2;
      else buildingLevel = 3;

      // Unowned/treasury always level 0
      if (!owner || owner === TREASURY) {
        buildingLevel = 0;
      }

      // Listing
      const isPlayerOwned = owner !== "" && owner !== TREASURY;
      const isListed = isPlayerOwned && rng.next() < 0.2;
      const listPrice = isListed ? rng.int(50, 5000) : undefined;

      const improveCost = [100, 200, 400, 0][buildingLevel];
      const earnedIncome = isPlayerOwned ? rng.int(0, 500) : 0;

      const property: GameProperty = {
        id: `prop-${row}-${col}`,
        name: `Tile ${String.fromCharCode(65 + col)}${row + 1}`,
        description: `Land parcel at grid position (${row}, ${col}) in Akkuea City.`,
        propertyType: "land",
        location: {
          address: `Block ${row + 1}, Lot ${col + 1}`,
          city: "Akkuea City",
          country: "Stellar",
          coordinates: {
            latitude: 40.7128 + row * 0.001,
            longitude: -74.006 + col * 0.001,
          },
        },
        totalValue: "1000",
        totalShares: 100,
        availableShares: owner === TREASURY ? 100 : owner === "" ? 100 : 0,
        pricePerShare: listPrice?.toString() ?? "100",
        images: ["https://images.unsplash.com/photo-placeholder"],
        documents: [],
        verified: true,
        listedAt: "2026-01-15T00:00:00Z",
        owner,
        buildingLevel,
        earnedIncome,
        improveCost,
        isListed,
      };

      grid.push(property);
    }
  }

  cachedGrid = grid;
  return grid;
}

/**
 * Get grid coordinates from a property ID like "prop-3-7"
 */
export function getGridCoords(propertyId: string): { row: number; col: number } {
  const parts = propertyId.split("-");
  return {
    row: parseInt(parts[1], 10),
    col: parseInt(parts[2], 10),
  };
}

/**
 * Abbreviate a Stellar address for display: "GABC…YZ56"
 */
export function abbreviateAddress(address: string): string {
  if (!address) return "Unowned";
  if (address === TREASURY) return "Treasury";
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
