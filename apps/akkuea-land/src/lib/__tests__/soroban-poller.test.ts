/**
 * soroban-poller - unit tests
 *
 * Verifies that pollGameEvents:
 *  1. Parses each of the four game event types, decoding addresses to their
 *     G-strkey form and integer amounts exactly.
 *  2. Skips unknown, non-contract, and malformed events.
 *  3. Decodes i128 amounts above 2^64 without truncation (regression: the
 *     parser used to read only the low 64 bits).
 *  4. Resumes from the RPC paging cursor, so a full page that ends partway
 *     through a ledger does not skip that ledger's remaining events
 *     (regression: the next poll used to start at maxLedger + 1).
 *
 * rpc.Server is stubbed on its prototype, so no network calls are made and the
 * real SDK stays available to other test files.
 */

import { afterAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  Contract,
  StrKey,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { getLatestLedger, pollGameEvents } from "@/lib/soroban-poller";

// ── Shared mock data ─────────────────────────────────────────────────────────

const PLAYER = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const OTHER_PLAYER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));
const TX_HASH = "ab".repeat(32);
const CLOSED_AT = "2026-10-16T12:00:00Z";
const PAGE_LIMIT = 100;

const symbol = (value: string) => xdr.ScVal.scvSymbol(value);
const text = (value: string) => xdr.ScVal.scvString(value);
const address = (value: string) => nativeToScVal(value, { type: "address" });
const i128 = (value: number | bigint) =>
  nativeToScVal(BigInt(value), { type: "i128" });

function makeRawEvent(
  topic: xdr.ScVal[],
  overrides: Partial<rpc.Api.EventResponse> = {},
): rpc.Api.EventResponse {
  return {
    id: "0000004294967296-0000000001",
    type: "contract",
    ledger: 1000,
    ledgerClosedAt: CLOSED_AT,
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: TX_HASH,
    contractId: new Contract(CONTRACT_ID),
    topic,
    value: xdr.ScVal.scvVoid(),
    ...overrides,
  };
}

function makeResponse(
  events: rpc.Api.EventResponse[],
  cursor: string,
): rpc.Api.GetEventsResponse {
  return {
    events,
    cursor,
    latestLedger: 2000,
    oldestLedger: 1,
    latestLedgerCloseTime: CLOSED_AT,
    oldestLedgerCloseTime: CLOSED_AT,
  };
}

const getEventsSpy = spyOn(rpc.Server.prototype, "getEvents");
const getLatestLedgerSpy = spyOn(rpc.Server.prototype, "getLatestLedger");

beforeEach(() => {
  getEventsSpy.mockReset();
  getLatestLedgerSpy.mockReset();
});

afterAll(() => {
  getEventsSpy.mockRestore();
  getLatestLedgerSpy.mockRestore();
});

// ── Event parsing ────────────────────────────────────────────────────────────

describe("pollGameEvents - event parsing", () => {
  const base = {
    ledger: 1000,
    timestamp: CLOSED_AT,
    contractId: CONTRACT_ID,
    id: `1000-${TX_HASH}-0`,
  };

  const cases: Array<[string, xdr.ScVal[], Record<string, string>]> = [
    [
      "PropertyBought",
      [symbol("PropertyBought"), text("prop-3-7"), address(PLAYER), i128(1500)],
      { tileId: "prop-3-7", buyer: PLAYER, price: "1500" },
    ],
    [
      "PropertyListed",
      [symbol("PropertyListed"), text("prop-3-7"), address(PLAYER), i128(2500)],
      { tileId: "prop-3-7", seller: PLAYER, askPrice: "2500" },
    ],
    [
      "PropertyTransferred",
      [
        symbol("PropertyTransferred"),
        text("prop-3-7"),
        address(PLAYER),
        address(OTHER_PLAYER),
      ],
      { tileId: "prop-3-7", from: PLAYER, to: OTHER_PLAYER },
    ],
    [
      "RentCollected",
      [symbol("RentCollected"), text("prop-3-7"), address(PLAYER), i128(40)],
      { tileId: "prop-3-7", owner: PLAYER, amount: "40" },
    ],
  ];

  for (const [type, topic, fields] of cases) {
    it(`parses a ${type} event`, async () => {
      getEventsSpy.mockResolvedValue(
        makeResponse([makeRawEvent(topic)], "cursor-1"),
      );

      const { events } = await pollGameEvents({ startLedger: 1000 });

      expect(events).toEqual([{ ...base, type, ...fields }] as never);
    });
  }

  it("skips unknown, non-contract, and malformed events", async () => {
    const known = [
      symbol("RentCollected"),
      text("prop-0-1"),
      address(PLAYER),
      i128(10),
    ];
    getEventsSpy.mockResolvedValue(
      makeResponse(
        [
          makeRawEvent([symbol("transfer"), address(PLAYER)]),
          makeRawEvent(known, { type: "system" }),
          makeRawEvent([text("RentCollected"), address(PLAYER)]),
          makeRawEvent([]),
          makeRawEvent(known),
        ],
        "cursor-1",
      ),
    );

    const { events } = await pollGameEvents({ startLedger: 1000 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "RentCollected",
      tileId: "prop-0-1",
      id: `1000-${TX_HASH}-4`,
    });
  });

  it("parses an i128 amount above 2^64 exactly", async () => {
    const amount = BigInt(2) ** BigInt(64) + BigInt(123);
    getEventsSpy.mockResolvedValue(
      makeResponse(
        [
          makeRawEvent([
            symbol("PropertyBought"),
            text("prop-9-9"),
            address(PLAYER),
            i128(amount),
          ]),
        ],
        "cursor-1",
      ),
    );

    const { events } = await pollGameEvents({ startLedger: 1000 });

    expect(events[0]).toMatchObject({ price: "18446744073709551739" });
  });
});

// ── Paging ───────────────────────────────────────────────────────────────────

describe("pollGameEvents - paging", () => {
  /**
   * A fake getEvents that follows the RPC contract: at most `limit` events per
   * page, starting at `startLedger` or strictly after `cursor`, and a cursor
   * that marks where the page stopped.
   */
  function serveFromChain(chain: rpc.Api.EventResponse[]) {
    getEventsSpy.mockImplementation(async (request) => {
      const from =
        "cursor" in request && request.cursor
          ? chain.findIndex((e) => e.id === request.cursor) + 1
          : chain.findIndex((e) => e.ledger >= (request.startLedger ?? 0));
      const page = chain.slice(from, from + (request.limit ?? PAGE_LIMIT));
      const cursor = page.length > 0 ? page[page.length - 1].id : "end";
      return makeResponse(page, cursor);
    });
  }

  function rentEvent(ledger: number, n: number): rpc.Api.EventResponse {
    return makeRawEvent(
      [symbol("RentCollected"), text(`prop-${n}`), address(PLAYER), i128(1)],
      { ledger, id: `${ledger}-${String(n).padStart(4, "0")}` },
    );
  }

  it("continues from the cursor after a full page without skipping events", async () => {
    // 101 events in ledger 1000 (one more than a page holds) plus one in 1001.
    const chain = [
      ...Array.from({ length: PAGE_LIMIT + 1 }, (_, n) => rentEvent(1000, n)),
      rentEvent(1001, PAGE_LIMIT + 1),
    ];
    serveFromChain(chain);

    const first = await pollGameEvents({ startLedger: 1000 });
    const second = await pollGameEvents({ cursor: first.cursor });

    expect(first.events).toHaveLength(PAGE_LIMIT);
    expect(getEventsSpy.mock.calls[0][0]).toMatchObject({
      startLedger: 1000,
      limit: PAGE_LIMIT,
    });
    expect(getEventsSpy.mock.calls[1][0]).toMatchObject({
      cursor: first.cursor,
      limit: PAGE_LIMIT,
    });
    expect(getEventsSpy.mock.calls[1][0]).not.toHaveProperty("startLedger");

    const tileIds = [...first.events, ...second.events].map((e) => e.tileId);
    expect(tileIds).toEqual(chain.map((_, n) => `prop-${n}`));
  });

  it("returns the RPC cursor even when the page is empty", async () => {
    getEventsSpy.mockResolvedValue(makeResponse([], "cursor-after-1500"));

    const result = await pollGameEvents({ startLedger: 1500 });

    expect(result).toEqual({ events: [], cursor: "cursor-after-1500" });
  });
});

// ── getLatestLedger ──────────────────────────────────────────────────────────

describe("getLatestLedger", () => {
  it("returns the latest ledger sequence from the RPC", async () => {
    getLatestLedgerSpy.mockResolvedValue({
      sequence: 4321,
    } as rpc.Api.GetLatestLedgerResponse);

    expect(await getLatestLedger()).toBe(4321);
  });
});
