/**
 * event-store - unit tests
 *
 * Covers the in-memory ring buffer behind /api/game/events/history: the
 * 1000-event cap, newest-first ordering, per-event-type player filtering, and
 * cursor pagination.
 *
 * The store is module-level state, so every test imports a fresh instance of
 * the module (a unique query string makes Bun evaluate it again).
 */

import { beforeEach, describe, expect, it } from "bun:test";
import type { GameEvent } from "@akkuea/shared";

type EventStore = typeof import("@/lib/event-store");

// ── Shared mock data ─────────────────────────────────────────────────────────

const PLAYER = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";
const OTHER_PLAYER = "GDOTHERPLAYERADDRESSFORFILTERTESTSONLYXXXXXXXXXXXXXXXXX";

const base = (id: string) => ({
  id,
  ledger: 1000,
  timestamp: "2026-10-16T12:00:00Z",
  contractId: "CCONTRACT",
  tileId: "prop-3-7",
});

const bought = (id: string, buyer: string): GameEvent => ({
  ...base(id),
  type: "PropertyBought",
  buyer,
  price: "1500",
});

const listed = (id: string, seller: string): GameEvent => ({
  ...base(id),
  type: "PropertyListed",
  seller,
  askPrice: "2500",
});

const transferred = (id: string, from: string, to: string): GameEvent => ({
  ...base(id),
  type: "PropertyTransferred",
  from,
  to,
});

const rent = (id: string, owner: string): GameEvent => ({
  ...base(id),
  type: "RentCollected",
  owner,
  amount: "40",
});

const ids = (events: GameEvent[]) => events.map((e) => e.id);

let store: EventStore;
let instance = 0;

beforeEach(async () => {
  instance += 1;
  store = (await import(`../event-store?instance=${instance}`)) as EventStore;
});

// ── Buffer ───────────────────────────────────────────────────────────────────

describe("event-store - buffer", () => {
  it("caps the buffer at 1000 events, dropping the oldest", () => {
    const events = Array.from({ length: 1005 }, (_, n) =>
      rent(`e${n}`, PLAYER),
    );
    store.appendEvents(events.slice(0, 600));
    store.appendEvents(events.slice(600));

    const result = store.queryHistory({ limit: 2000 });

    expect(result.total).toBe(1000);
    expect(result.events).toHaveLength(1000);
    expect(result.events[0].id).toBe("e1004");
    expect(result.events[result.events.length - 1].id).toBe("e5");
  });

  it("returns events newest first", () => {
    store.appendEvents([rent("a", PLAYER), rent("b", PLAYER)]);
    store.appendEvents([rent("c", PLAYER)]);

    expect(ids(store.queryHistory({ limit: 10 }).events)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("starts empty in each test", () => {
    expect(store.queryHistory({ limit: 10 })).toEqual({
      events: [],
      cursor: null,
      total: 0,
    });
  });
});

// ── Player filter ────────────────────────────────────────────────────────────

describe("event-store - player filter", () => {
  const cases: Array<[string, GameEvent[], GameEvent[]]> = [
    [
      "PropertyBought matches the buyer",
      [bought("match", PLAYER)],
      [bought("miss", OTHER_PLAYER)],
    ],
    [
      "PropertyListed matches the seller",
      [listed("match", PLAYER)],
      [listed("miss", OTHER_PLAYER)],
    ],
    [
      "PropertyTransferred matches the sender and the recipient",
      [
        transferred("match-from", PLAYER, OTHER_PLAYER),
        transferred("match-to", OTHER_PLAYER, PLAYER),
      ],
      [transferred("miss", OTHER_PLAYER, OTHER_PLAYER)],
    ],
    [
      "RentCollected matches the owner",
      [rent("match", PLAYER)],
      [rent("miss", OTHER_PLAYER)],
    ],
  ];

  for (const [label, matching, other] of cases) {
    it(label, () => {
      store.appendEvents([...matching, ...other]);

      const result = store.queryHistory({ player: PLAYER, limit: 10 });

      expect(ids(result.events)).toEqual(ids(matching).reverse());
    });
  }

  it("total reflects the filtered count, not the buffer size", () => {
    store.appendEvents([
      bought("1", PLAYER),
      bought("2", OTHER_PLAYER),
      listed("3", PLAYER),
      rent("4", OTHER_PLAYER),
      transferred("5", OTHER_PLAYER, PLAYER),
      rent("6", OTHER_PLAYER),
    ]);

    const result = store.queryHistory({ player: PLAYER, limit: 1 });

    expect(result.total).toBe(3);
    expect(ids(result.events)).toEqual(["5"]);
  });
});

// ── Cursor pagination ────────────────────────────────────────────────────────

describe("event-store - cursor pagination", () => {
  beforeEach(() => {
    store.appendEvents(
      ["e0", "e1", "e2", "e3", "e4"].map((id) => rent(id, PLAYER)),
    );
  });

  it("walks every page in order and returns a cursor only on full pages", () => {
    const page1 = store.queryHistory({ limit: 2 });
    expect(ids(page1.events)).toEqual(["e4", "e3"]);
    expect(page1.cursor).toBe("e3");

    const page2 = store.queryHistory({ limit: 2, cursor: page1.cursor! });
    expect(ids(page2.events)).toEqual(["e2", "e1"]);
    expect(page2.cursor).toBe("e1");

    const page3 = store.queryHistory({ limit: 2, cursor: page2.cursor! });
    expect(ids(page3.events)).toEqual(["e0"]);
    expect(page3.cursor).toBeNull();

    for (const page of [page1, page2, page3]) {
      expect(page.total).toBe(5);
    }
  });

  it("returns no cursor when everything fits on one page", () => {
    const result = store.queryHistory({ limit: 10 });

    expect(result.events).toHaveLength(5);
    expect(result.cursor).toBeNull();
  });
});
