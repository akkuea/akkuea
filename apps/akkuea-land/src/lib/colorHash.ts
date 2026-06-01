/**
 * Deterministic address → HSL color mapping.
 *
 * Uses the DJB2 hash algorithm so the same wallet address always
 * produces the same tile color across sessions and devices.
 */

const TREASURY_ADDRESSES = new Set([
  "",
  "gbtreasury",
  "treasury",
  "system",
]);

/**
 * DJB2 hash – fast, low-collision string hash.
 * Returns a positive 32-bit integer.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + charCode
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Convert a Stellar address to a deterministic HSL color string.
 *
 * - Treasury / system addresses → amber (`--land-gold`)
 * - Empty / unowned → muted blue-grey (`--tile-empty`)
 * - Player addresses → unique HSL with vibrant saturation
 */
export function addressToHSL(address: string): string {
  // Treasury → amber
  if (!address || TREASURY_ADDRESSES.has(address.toLowerCase())) {
    return "var(--land-gold)";
  }

  const hash = djb2(address);

  // Hue: full 360° spectrum
  const hue = hash % 360;

  // Saturation: 50–75% (vibrant but not neon)
  const saturation = 50 + (hash % 26);

  // Lightness: 35–50% (readable on dark bg)
  const lightness = 35 + ((hash >> 8) % 16);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Returns a lighter variant of the address color for hover glow effects.
 */
export function addressToGlow(address: string): string {
  if (!address || TREASURY_ADDRESSES.has(address.toLowerCase())) {
    return "var(--land-gold-glow)";
  }

  const hash = djb2(address);
  const hue = hash % 360;
  return `hsla(${hue}, 70%, 55%, 0.35)`;
}
