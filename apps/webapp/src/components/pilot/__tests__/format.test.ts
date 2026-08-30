import {
  formatBaseUnits,
  formatCycleLabel,
  formatUnixDate,
  formatUsdc,
  shortenHash,
} from "../format";
import { holderAmountFor, holderShareOf } from "@/services/pilot/reads";
import { currentCycleId } from "../currentCycle";

describe("formatBaseUnits", () => {
  it("places the decimal point for a 7-decimal token", () => {
    expect(formatBaseUnits(BigInt(12_345_0000000))).toBe("12,345.00");
  });

  it("keeps sub-unit precision without going through Number", () => {
    expect(formatBaseUnits(BigInt(1_2300000))).toBe("1.23");
  });

  it("handles an amount larger than Number.MAX_SAFE_INTEGER exactly", () => {
    expect(formatBaseUnits(BigInt("90071992547409910000000"))).toBe(
      "9,007,199,254,740,991.00",
    );
  });

  it("formats zero", () => {
    expect(formatBaseUnits(BigInt(0))).toBe("0.00");
  });

  it("formats a negative amount", () => {
    expect(formatBaseUnits(BigInt(-5_0000000))).toBe("-5.00");
  });
});

describe("formatUsdc", () => {
  it("appends the asset code", () => {
    expect(formatUsdc(BigInt(1_250_0000000))).toBe("1,250.00 USDC");
  });
});

describe("formatUnixDate", () => {
  it("renders in UTC regardless of the viewer's zone", () => {
    expect(formatUnixDate(1775347200)).toBe("Apr 5, 2026");
  });
});

describe("formatCycleLabel", () => {
  it("renders a cycle id as a month and year", () => {
    expect(formatCycleLabel("2026-03")).toBe("March 2026");
  });

  it("returns the raw id when it cannot be parsed", () => {
    expect(formatCycleLabel("not-a-cycle")).toBe("not-a-cycle");
  });
});

describe("shortenHash", () => {
  it("keeps both ends of a long digest", () => {
    const hex = "a".repeat(32) + "b".repeat(32);
    expect(shortenHash(hex)).toBe("aaaaaaaa...bbbbbbbb");
  });

  it("leaves a short value untouched", () => {
    expect(shortenHash("abc123")).toBe("abc123");
  });
});

describe("holderAmountFor", () => {
  it("withholds the contract's 10 percent platform fee", () => {
    expect(holderAmountFor(BigInt(1_000_0000000))).toBe(BigInt(900_0000000));
  });

  it("truncates the fee the same way the contract does", () => {
    // 99 stroops: the fee truncates to 9, leaving 90 for holders.
    expect(holderAmountFor(BigInt(99))).toBe(BigInt(90));
  });
});

describe("holderShareOf", () => {
  it("splits by share of supply", () => {
    expect(
      holderShareOf(BigInt(1_000_0000000), BigInt(250), BigInt(1_000)),
    ).toBe(BigInt(250_0000000));
  });

  it("returns zero when nothing has been issued", () => {
    expect(holderShareOf(BigInt(1_000), BigInt(10), BigInt(0))).toBe(BigInt(0));
  });
});

describe("currentCycleId", () => {
  it("reports the month that just ended", () => {
    expect(currentCycleId(new Date("2026-04-03T00:00:00Z"))).toBe("2026-03");
  });

  it("rolls back into the previous year in January", () => {
    expect(currentCycleId(new Date("2026-01-09T00:00:00Z"))).toBe("2025-12");
  });
});
