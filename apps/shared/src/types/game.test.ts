import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APARTMENT_COST,
  APARTMENT_MULTIPLIER,
  BASE_RENTAL_RATE,
  EMPTY_MULTIPLIER,
  EPOCH_LEDGERS,
  HOUSE_COST,
  HOUSE_MULTIPLIER,
  IMPROVEMENT_LEVELS,
  IMPROVEMENT_MULTIPLIER,
  IMPROVEMENT_UPGRADE_COST,
  SKYSCRAPER_COST,
  SKYSCRAPER_MULTIPLIER,
  computeAccruedRent,
} from "./game";

// The game-engine contract is the source of truth for these values. Reading
// constants.rs directly makes this test fail as soon as the two drift apart.
const CONSTANTS_RS = readFileSync(
  join(
    import.meta.dir,
    "../../../contracts/contracts/game-engine/src/constants.rs",
  ),
  "utf8",
);

const LAND_UNITS = 10_000_000;

function rustScalar(name: string): number {
  const match = CONSTANTS_RS.match(
    new RegExp(`pub const ${name}: \\w+ = ([^;]+);`),
  );
  if (!match) throw new Error(`${name} not found in constants.rs`);
  // Values are integer literals or products such as `1_800 * 10_000_000`.
  return match[1]
    .split("*")
    .map((part) => Number(part.trim().replace(/_/g, "")))
    .reduce((acc, n) => acc * n, 1);
}

function rustRatio(name: string): [number, number] {
  const match = CONSTANTS_RS.match(
    new RegExp(`pub const ${name}: \\(i128, i128\\) = \\((\\d+), (\\d+)\\);`),
  );
  if (!match) throw new Error(`${name} not found in constants.rs`);
  return [Number(match[1]), Number(match[2])];
}

describe("game economy constants match game-engine/src/constants.rs", () => {
  it("epoch length", () => {
    expect(EPOCH_LEDGERS).toBe(rustScalar("EPOCH_LENGTH"));
  });

  it("base rental rate (whole LAND)", () => {
    expect(BASE_RENTAL_RATE * LAND_UNITS).toBe(rustScalar("BASE_RENTAL_RATE"));
  });

  it("upgrade costs (whole LAND)", () => {
    expect(HOUSE_COST * LAND_UNITS).toBe(
      rustScalar("IMPROVEMENT_COST_RESIDENTIAL"),
    );
    expect(APARTMENT_COST * LAND_UNITS).toBe(
      rustScalar("IMPROVEMENT_COST_COMMERCIAL"),
    );
    expect(SKYSCRAPER_COST * LAND_UNITS).toBe(
      rustScalar("IMPROVEMENT_COST_SKYSCRAPER"),
    );
  });

  it("rental multipliers as numerator/denominator pairs", () => {
    expect([...EMPTY_MULTIPLIER]).toEqual(rustRatio("MULTIPLIER_VACANT"));
    expect([...HOUSE_MULTIPLIER]).toEqual(rustRatio("MULTIPLIER_RESIDENTIAL"));
    expect([...APARTMENT_MULTIPLIER]).toEqual(
      rustRatio("MULTIPLIER_COMMERCIAL"),
    );
    expect([...SKYSCRAPER_MULTIPLIER]).toEqual(
      rustRatio("MULTIPLIER_SKYSCRAPER"),
    );
  });

  it("level indexes match the contract's LEVEL_* values", () => {
    expect(IMPROVEMENT_LEVELS[rustScalar("LEVEL_VACANT")]).toBe("EMPTY");
    expect(IMPROVEMENT_LEVELS[rustScalar("LEVEL_RESIDENTIAL")]).toBe("HOUSE");
    expect(IMPROVEMENT_LEVELS[rustScalar("LEVEL_COMMERCIAL")]).toBe(
      "APARTMENT",
    );
    expect(IMPROVEMENT_LEVELS[rustScalar("LEVEL_SKYSCRAPER")]).toBe(
      "SKYSCRAPER",
    );
  });

  it("lookup tables point at the same values", () => {
    expect(IMPROVEMENT_MULTIPLIER.HOUSE).toBe(HOUSE_MULTIPLIER);
    expect(IMPROVEMENT_UPGRADE_COST).toEqual({
      EMPTY: HOUSE_COST,
      HOUSE: APARTMENT_COST,
      APARTMENT: SKYSCRAPER_COST,
    });
  });
});

describe("computeAccruedRent", () => {
  it("matches the contract formula for the issue's reference cases", () => {
    expect(computeAccruedRent(5000, 3)).toBe(3000);
    expect(computeAccruedRent(99, 1)).toBe(0);
    expect(computeAccruedRent(100, 1)).toBe(15);
    expect(computeAccruedRent(100, 0)).toBe(10);
  });

  it("pays only whole epochs", () => {
    expect(computeAccruedRent(199, 2)).toBe(30);
    expect(computeAccruedRent(200, 2)).toBe(60);
  });

  it("returns 0 for no or negative elapsed ledgers", () => {
    expect(computeAccruedRent(0, 3)).toBe(0);
    expect(computeAccruedRent(-50, 3)).toBe(0);
  });

  it("uses the vacant multiplier for an unknown level, like the contract", () => {
    expect(computeAccruedRent(100, 9)).toBe(10);
  });
});
