import "@/test/setup-dom";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type {
  PilotEvidenceDetail,
  PilotHoldings,
  PilotSettlementSnapshot,
} from "@/services/pilot/reads";

/**
 * `usePilotContract` is a thin set of hooks over one polling primitive, and
 * every read it performs goes through `@/services/pilot/reads`. The tests mock
 * only those read functions, so no Soroban RPC call is ever made.
 *
 * `bun test` keeps a `mock.module` in effect for the rest of the process, so
 * the real module is spread in and only the five reads are replaced; the
 * original module is put back in `afterAll` so later test files see it again.
 */
const RealReads = await import("@/services/pilot/reads");

const fetchPilotCycles = mock<() => Promise<PilotEvidenceDetail[]>>();
const fetchPilotHoldings = mock<(address: string) => Promise<PilotHoldings>>();
const fetchPilotSettlement =
  mock<(address: string) => Promise<PilotSettlementSnapshot>>();
const fetchPayoutPaused = mock<() => Promise<boolean>>();
const fetchPilotState =
  mock<() => Promise<Awaited<ReturnType<typeof RealReads.fetchPilotState>>>>();

mock.module("@/services/pilot/reads", () => ({
  ...RealReads,
  fetchPilotCycles,
  fetchPilotHoldings,
  fetchPilotSettlement,
  fetchPayoutPaused,
  fetchPilotState,
}));

// A cache-busting query string loads the hook module afresh, so it binds to
// the mocked reads even if another test file imported it earlier.
const hookSpecifier: string = "../usePilotContract.ts?fresh-import";
const {
  PILOT_POLL_INTERVAL_MS,
  usePilotCycles,
  usePilotHoldings,
  usePayoutPaused,
  usePilotSettlement,
  usePilotState,
}: typeof import("../usePilotContract") = await import(hookSpecifier);

const INVESTOR = "GINVESTOR";

const HOLDINGS: PilotHoldings = {
  balance: BigInt(2_500),
  totalSupply: BigInt(10_000),
  decimals: 7,
  symbol: "AKPILOT",
  whitelisted: true,
};

const CYCLE: PilotEvidenceDetail = {
  cycleId: "2026-01",
  expectedAt: 1_770_000_000,
};

const DISTRIBUTED_CYCLE: PilotEvidenceDetail = {
  cycleId: "2025-12",
  expectedAt: 1_760_000_000,
  distribution: {
    distributedAt: 1_760_100_000,
    totalIncome: BigInt(1_000),
    holderAmount: BigInt(900),
  },
};

const SETTLEMENT = {
  currency: "usdc",
  claimable: BigInt(0),
} as unknown as PilotSettlementSnapshot;

interface Tick {
  callback: () => void;
  handle: ReturnType<typeof setInterval>;
}

/**
 * Records the dashboard's poll timer without replacing it: the real timer is
 * still created, and only calls made with the pilot's polling interval are
 * captured, so the test can fire a poll on demand instead of waiting 30 s.
 */
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
let ticks: Tick[] = [];
let cleared: unknown[] = [];

function trackPollTimer() {
  ticks = [];
  cleared = [];
  globalThis.setInterval = ((
    callback: () => void,
    delay?: number,
    ...rest: unknown[]
  ) => {
    const handle = (
      realSetInterval as unknown as (...args: unknown[]) => unknown
    )(callback, delay, ...rest) as Tick["handle"];
    if (delay === PILOT_POLL_INTERVAL_MS) {
      ticks.push({ callback, handle });
    }
    return handle;
  }) as typeof setInterval;
  globalThis.clearInterval = ((handle: Parameters<typeof clearInterval>[0]) => {
    cleared.push(handle);
    return realClearInterval(handle);
  }) as typeof clearInterval;
}

/** Lets the pending promise chain of a read settle and React flush its state. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Fires the captured poll timer, as 30 s passing would. */
async function firePoll(index = 0) {
  await act(async () => {
    ticks[index].callback();
    await Promise.resolve();
  });
}

beforeEach(() => {
  for (const fn of [
    fetchPilotCycles,
    fetchPilotHoldings,
    fetchPilotSettlement,
    fetchPayoutPaused,
    fetchPilotState,
  ]) {
    fn.mockReset();
  }
  trackPollTimer();
});

afterEach(() => {
  cleanup();
  globalThis.setInterval = realSetInterval;
  globalThis.clearInterval = realClearInterval;
});

describe("usePilotContract polling", () => {
  it("polls every 30 seconds", () => {
    expect(PILOT_POLL_INTERVAL_MS).toBe(30_000);
  });

  it("reports connecting with no data before the first read lands", () => {
    fetchPilotHoldings.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePilotHoldings(INVESTOR));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.connectionStatus).toBe("connecting");
    expect(result.current.holdings).toBeNull();
    expect(result.current.lastUpdatedAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sets connected and lastUpdatedAt after the first successful read", async () => {
    fetchPilotHoldings.mockResolvedValue(HOLDINGS);
    const before = Date.now();

    const { result } = renderHook(() => usePilotHoldings(INVESTOR));
    await settle();

    expect(fetchPilotHoldings).toHaveBeenCalledTimes(1);
    expect(fetchPilotHoldings).toHaveBeenCalledWith(INVESTOR);
    expect(result.current.holdings).toEqual(HOLDINGS);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.isDisconnected).toBe(false);
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
    expect(result.current.lastUpdatedAt!.getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("keeps the previous data and reports disconnected when a later read fails", async () => {
    fetchPilotHoldings.mockResolvedValueOnce(HOLDINGS);
    const { result } = renderHook(() => usePilotHoldings(INVESTOR));
    await settle();
    const firstUpdate = result.current.lastUpdatedAt;
    expect(result.current.connectionStatus).toBe("connected");

    fetchPilotHoldings.mockRejectedValueOnce(new Error("rpc is down"));
    await firePoll();

    expect(fetchPilotHoldings).toHaveBeenCalledTimes(2);
    expect(result.current.holdings).toEqual(HOLDINGS);
    expect(result.current.error).toBe("rpc is down");
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.isLoading).toBe(false);
    // The stale timestamp is kept, so the freshness indicator shows how old
    // the data on screen really is.
    expect(result.current.lastUpdatedAt).toBe(firstUpdate);
  });

  it("recovers to connected and clears the error when a later read succeeds", async () => {
    fetchPilotHoldings.mockResolvedValueOnce(HOLDINGS);
    const { result } = renderHook(() => usePilotHoldings(INVESTOR));
    await settle();

    fetchPilotHoldings.mockRejectedValueOnce(new Error("rpc is down"));
    await firePoll();
    expect(result.current.connectionStatus).toBe("disconnected");

    const updated = { ...HOLDINGS, balance: BigInt(3_000) };
    fetchPilotHoldings.mockResolvedValueOnce(updated);
    await firePoll();

    expect(result.current.holdings).toEqual(updated);
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe("connected");
  });

  it("uses a readable message when a read rejects with something that is not an Error", async () => {
    fetchPilotHoldings.mockRejectedValue("boom");

    const { result } = renderHook(() => usePilotHoldings(INVESTOR));
    await settle();

    expect(result.current.holdings).toBeNull();
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.error).toBe(
      "Could not reach Soroban RPC. Check your connection and try again.",
    );
  });

  it("makes no read for usePilotHoldings(null) and reports the disconnected state", async () => {
    const { result } = renderHook(() => usePilotHoldings(null));
    await settle();

    expect(fetchPilotHoldings).not.toHaveBeenCalled();
    expect(ticks).toHaveLength(0);
    expect(result.current.isDisconnected).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.holdings).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe("disconnected");
  });

  it("makes no read for an undefined or empty address either", async () => {
    renderHook(() => usePilotHoldings(undefined));
    renderHook(() => usePilotHoldings(""));
    renderHook(() => usePilotSettlement(null));
    await settle();

    expect(fetchPilotHoldings).not.toHaveBeenCalled();
    expect(fetchPilotSettlement).not.toHaveBeenCalled();
  });

  it("starts reading when a wallet connects after the first render", async () => {
    fetchPilotHoldings.mockResolvedValue(HOLDINGS);
    const { result, rerender } = renderHook(
      ({ address }: { address: string | null }) => usePilotHoldings(address),
      { initialProps: { address: null as string | null } },
    );
    await settle();
    expect(fetchPilotHoldings).not.toHaveBeenCalled();

    rerender({ address: INVESTOR });
    await settle();

    expect(fetchPilotHoldings).toHaveBeenCalledWith(INVESTOR);
    expect(result.current.holdings).toEqual(HOLDINGS);
    expect(result.current.isDisconnected).toBe(false);
  });

  it("refetch triggers a new read", async () => {
    fetchPilotHoldings.mockResolvedValue(HOLDINGS);
    const { result } = renderHook(() => usePilotHoldings(INVESTOR));
    await settle();
    expect(fetchPilotHoldings).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
      await Promise.resolve();
    });
    await settle();

    expect(fetchPilotHoldings).toHaveBeenCalledTimes(2);
    expect(result.current.connectionStatus).toBe("connected");
  });

  it("clears the polling interval on unmount", async () => {
    fetchPilotHoldings.mockResolvedValue(HOLDINGS);
    const { unmount } = renderHook(() => usePilotHoldings(INVESTOR));
    await settle();

    expect(ticks).toHaveLength(1);
    const { handle } = ticks[0];
    expect(cleared).not.toContain(handle);

    unmount();

    expect(cleared).toContain(handle);
  });

  it("ignores a read that resolves after the hook has unmounted", async () => {
    let finish: (value: PilotHoldings) => void = () => {};
    fetchPilotHoldings.mockReturnValue(
      new Promise<PilotHoldings>((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderHook(() => usePilotHoldings(INVESTOR));
    unmount();

    await act(async () => {
      finish(HOLDINGS);
      await Promise.resolve();
    });

    expect(result.current.holdings).toBeNull();
    expect(result.current.connectionStatus).toBe("connecting");
  });

  it("reads the new address on the next poll after the address changes", async () => {
    fetchPilotHoldings.mockResolvedValue(HOLDINGS);
    const { rerender } = renderHook(
      ({ address }: { address: string }) => usePilotHoldings(address),
      { initialProps: { address: INVESTOR } },
    );
    await settle();
    expect(fetchPilotHoldings).toHaveBeenLastCalledWith(INVESTOR);

    rerender({ address: "GOTHER" });
    await firePoll();

    expect(fetchPilotHoldings).toHaveBeenLastCalledWith("GOTHER");
  });
});

describe("usePilotCycles", () => {
  it("returns an empty timeline before the first read", () => {
    fetchPilotCycles.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePilotCycles());

    expect(result.current.cycles).toEqual([]);
    expect(result.current.timeline.entries).toEqual([]);
    expect(result.current.timeline.escalated).toBe(false);
    expect(result.current.timeline.consecutiveMissed).toBe(0);
    expect(result.current.timeline.totalDistributed).toBe(BigInt(0));
    expect(result.current.isLoading).toBe(true);
  });

  it("derives the timeline from the cycles once the first read lands", async () => {
    fetchPilotCycles.mockResolvedValue([CYCLE]);

    const { result } = renderHook(() => usePilotCycles());
    await settle();

    expect(result.current.cycles).toEqual([CYCLE]);
    expect(result.current.timeline.entries).toHaveLength(1);
    expect(result.current.timeline.entries[0].cycle.cycleId).toBe("2026-01");
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("totals what was distributed to holders and orders cycles by date", async () => {
    fetchPilotCycles.mockResolvedValue([CYCLE, DISTRIBUTED_CYCLE]);

    const { result } = renderHook(() => usePilotCycles());
    await settle();

    expect(result.current.timeline.totalDistributed).toBe(BigInt(900));
    expect(
      result.current.timeline.entries.map((entry) => entry.cycle.cycleId),
    ).toEqual(["2025-12", "2026-01"]);
  });

  it("keeps the last cycles and timeline when a later read fails", async () => {
    fetchPilotCycles.mockResolvedValueOnce([CYCLE]);
    const { result } = renderHook(() => usePilotCycles());
    await settle();

    fetchPilotCycles.mockRejectedValueOnce(new Error("rpc is down"));
    await firePoll();

    expect(result.current.cycles).toEqual([CYCLE]);
    expect(result.current.timeline.entries).toHaveLength(1);
    expect(result.current.error).toBe("rpc is down");
    expect(result.current.connectionStatus).toBe("disconnected");
  });
});

describe("usePayoutPaused", () => {
  it("reports not paused until the contract says otherwise", async () => {
    fetchPayoutPaused.mockResolvedValue(true);

    const { result } = renderHook(() => usePayoutPaused());
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await settle();

    expect(result.current.isPaused).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a failed read as an error while staying not paused", async () => {
    fetchPayoutPaused.mockRejectedValue(new Error("rpc is down"));

    const { result } = renderHook(() => usePayoutPaused());
    await settle();

    expect(result.current.isPaused).toBe(false);
    expect(result.current.error).toBe("rpc is down");
  });
});

describe("usePilotSettlement", () => {
  it("reads the settlement snapshot for the connected investor", async () => {
    fetchPilotSettlement.mockResolvedValue(SETTLEMENT);

    const { result } = renderHook(() => usePilotSettlement(INVESTOR));
    await settle();

    expect(fetchPilotSettlement).toHaveBeenCalledWith(INVESTOR);
    expect(result.current.settlement).toBe(SETTLEMENT);
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.isDisconnected).toBe(false);
  });

  it("makes no read and reports disconnected without an address", async () => {
    const { result } = renderHook(() => usePilotSettlement(null));
    await settle();

    expect(fetchPilotSettlement).not.toHaveBeenCalled();
    expect(result.current.settlement).toBeNull();
    expect(result.current.isDisconnected).toBe(true);
    expect(result.current.connectionStatus).toBe("disconnected");
  });
});

describe("usePilotState", () => {
  it("exposes the exit record and paused flag from one read", async () => {
    const exitRecord = {
      reason: "wound down",
    } as unknown as NonNullable<
      Awaited<ReturnType<typeof RealReads.fetchPilotState>>["exitRecord"]
    >;
    fetchPilotState.mockResolvedValue({ exitRecord, isPaused: true });

    const { result } = renderHook(() => usePilotState());
    expect(result.current.exitRecord).toBeUndefined();
    expect(result.current.isPaused).toBe(false);

    await settle();

    expect(result.current.exitRecord).toBe(exitRecord);
    expect(result.current.isPaused).toBe(true);
    expect(result.current.connectionStatus).toBe("connected");
  });

  it("reports an active, unpaused pilot when there is no exit record", async () => {
    fetchPilotState.mockResolvedValue({
      exitRecord: undefined,
      isPaused: false,
    });

    const { result } = renderHook(() => usePilotState());
    await settle();

    expect(result.current.exitRecord).toBeUndefined();
    expect(result.current.isPaused).toBe(false);
  });
});

// Restore the real reads for any test file that runs after this one.
afterAll(() => {
  mock.module("@/services/pilot/reads", () => RealReads);
});
