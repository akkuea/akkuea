/**
 * colorHash - unit tests
 *
 * Verifies that addressToHSL / addressToGlow map an address to a stable
 * player color, route treasury and system addresses to the gold token, and
 * keep player colors inside the documented saturation and lightness bands.
 */

import { describe, expect, it } from "bun:test";
import { addressToGlow, addressToHSL } from "@/lib/colorHash";

const PLAYER = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const OTHER_PLAYER = "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3";

const HSL_PATTERN = /^hsl\((\d+), (\d+)%, (\d+)%\)$/;

function parseHSL(color: string) {
  const match = HSL_PATTERN.exec(color);
  if (!match) throw new Error(`Not an hsl() color: ${color}`);
  const [, hue, saturation, lightness] = match.map(Number);
  return { hue, saturation, lightness };
}

describe("addressToHSL", () => {
  it("is deterministic for the same address", () => {
    expect(addressToHSL(PLAYER)).toBe(addressToHSL(PLAYER));
    expect(addressToGlow(PLAYER)).toBe(addressToGlow(PLAYER));
  });

  const goldAddresses = [
    "",
    "treasury",
    "TREASURY",
    "Treasury",
    "gbtreasury",
    "GBTREASURY",
    "system",
    "SYSTEM",
    "System",
  ];

  for (const address of goldAddresses) {
    it(`returns the gold token for ${JSON.stringify(address)}`, () => {
      expect(addressToHSL(address)).toBe("var(--land-gold)");
      expect(addressToGlow(address)).toBe("var(--land-gold-glow)");
    });
  }

  it("keeps saturation within 50-75% and lightness within 35-50%", () => {
    for (let n = 0; n < 500; n++) {
      const { hue, saturation, lightness } = parseHSL(
        addressToHSL(`G${n.toString(36).toUpperCase().padStart(55, "A")}`),
      );
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      expect(saturation).toBeGreaterThanOrEqual(50);
      expect(saturation).toBeLessThanOrEqual(75);
      expect(lightness).toBeGreaterThanOrEqual(35);
      expect(lightness).toBeLessThanOrEqual(50);
    }
  });

  it("gives two different addresses different hues", () => {
    expect(parseHSL(addressToHSL(PLAYER)).hue).not.toBe(
      parseHSL(addressToHSL(OTHER_PLAYER)).hue,
    );
  });
});

describe("addressToGlow", () => {
  it("uses the same hue as addressToHSL", () => {
    const { hue } = parseHSL(addressToHSL(PLAYER));
    expect(addressToGlow(PLAYER)).toBe(`hsla(${hue}, 70%, 55%, 0.35)`);
  });
});
