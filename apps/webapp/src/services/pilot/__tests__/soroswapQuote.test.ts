import { describe, expect, it } from "bun:test";
import {
  RATE_DENOMINATOR,
  SoroswapQuoteError,
  deriveMinEurcPerUsdc,
} from "../soroswapQuote";

describe("deriveMinEurcPerUsdc", () => {
  it("derives a price floor from a live router quote reduced by the slippage tolerance", () => {
    // A live quote of 920 EURC-stroops out for 1,000 USDC-stroops in is a
    // raw rate of 0.92 EURC / USDC. A 100 bps (1%) tolerance floors 1% below
    // that quoted rate, at 0.9108 EURC / USDC, matching this module's own
    // doc comment example.
    const floor = deriveMinEurcPerUsdc({
      quotedAmountIn: BigInt(1_000),
      quotedAmountOut: BigInt(920),
      slippageBps: 100,
    });
    expect(floor).toBe(BigInt(9_108_000));
  });

  it("floors at exactly the quoted rate when the slippage tolerance is zero", () => {
    const floor = deriveMinEurcPerUsdc({
      quotedAmountIn: BigInt(1_000),
      quotedAmountOut: BigInt(920),
      slippageBps: 0,
    });
    expect(floor).toBe((BigInt(920) * RATE_DENOMINATOR) / BigInt(1_000));
  });

  it("scales down as the tolerance widens, never up", () => {
    const tight = deriveMinEurcPerUsdc({
      quotedAmountIn: BigInt(1_000),
      quotedAmountOut: BigInt(920),
      slippageBps: 50,
    });
    const loose = deriveMinEurcPerUsdc({
      quotedAmountIn: BigInt(1_000),
      quotedAmountOut: BigInt(920),
      slippageBps: 500,
    });
    expect(loose).toBeLessThan(tight);
  });

  it("refuses a non-positive quoted input amount", () => {
    expect(() =>
      deriveMinEurcPerUsdc({
        quotedAmountIn: BigInt(0),
        quotedAmountOut: BigInt(920),
        slippageBps: 100,
      }),
    ).toThrow(SoroswapQuoteError);
  });

  it("refuses a slippage tolerance outside 0 to 9999 basis points", () => {
    expect(() =>
      deriveMinEurcPerUsdc({
        quotedAmountIn: BigInt(1_000),
        quotedAmountOut: BigInt(920),
        slippageBps: -1,
      }),
    ).toThrow(SoroswapQuoteError);
    expect(() =>
      deriveMinEurcPerUsdc({
        quotedAmountIn: BigInt(1_000),
        quotedAmountOut: BigInt(920),
        slippageBps: 10_000,
      }),
    ).toThrow(SoroswapQuoteError);
  });

  it("refuses a floor that rounds down to zero rather than silently preparing a zero-floor distribution", () => {
    // A vanishingly small quoted rate, floored further by slippage, rounds
    // to zero under integer division; this must fail loudly instead of
    // producing the same zero floor `quoteEurcFloor` treats as "no EURC
    // preference to protect."
    expect(() =>
      deriveMinEurcPerUsdc({
        quotedAmountIn: BigInt(1_000_000_000),
        quotedAmountOut: BigInt(1),
        slippageBps: 9_999,
      }),
    ).toThrow(SoroswapQuoteError);
  });
});
