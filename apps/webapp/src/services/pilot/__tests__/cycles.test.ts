import {
  enumerateCycles,
  expectedAtFor,
  formatCycleId,
  parseCycleId,
} from "../cycles";

describe("parseCycleId", () => {
  it("parses a well-formed cycle id", () => {
    expect(parseCycleId("2026-03")).toEqual({ year: 2026, month: 3 });
  });

  it("rejects a month outside 1 through 12", () => {
    expect(parseCycleId("2026-13")).toBeNull();
    expect(parseCycleId("2026-00")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseCycleId("2026-3")).toBeNull();
    expect(parseCycleId("march")).toBeNull();
    expect(parseCycleId("")).toBeNull();
  });
});

describe("formatCycleId", () => {
  it("pads a single-digit month", () => {
    expect(formatCycleId(2026, 3)).toBe("2026-03");
  });
});

describe("expectedAtFor", () => {
  it("falls on the payment day of the month after the cycle", () => {
    const expected = expectedAtFor("2026-03", 5);
    expect(new Date(expected * 1000).toISOString()).toBe(
      "2026-04-05T00:00:00.000Z",
    );
  });

  it("rolls a December cycle into January of the next year", () => {
    const expected = expectedAtFor("2026-12", 10);
    expect(new Date(expected * 1000).toISOString()).toBe(
      "2027-01-10T00:00:00.000Z",
    );
  });

  it("throws on an invalid cycle id rather than guessing a date", () => {
    expect(() => expectedAtFor("nope", 5)).toThrow();
  });
});

describe("enumerateCycles", () => {
  it("lists every month from the start cycle through the current one", () => {
    const cycles = enumerateCycles("2026-01", new Date("2026-03-20T00:00:00Z"));
    expect(cycles).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("crosses a year boundary", () => {
    const cycles = enumerateCycles("2025-11", new Date("2026-02-01T00:00:00Z"));
    expect(cycles).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("returns a single cycle when the pilot just started", () => {
    const cycles = enumerateCycles("2026-03", new Date("2026-03-01T00:00:00Z"));
    expect(cycles).toEqual(["2026-03"]);
  });

  it("returns nothing when the start cycle is still in the future", () => {
    const cycles = enumerateCycles("2027-01", new Date("2026-03-01T00:00:00Z"));
    expect(cycles).toEqual([]);
  });
});
