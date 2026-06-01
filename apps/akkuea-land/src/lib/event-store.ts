import type { GameEvent } from "@akkuea/shared";

const MAX_EVENTS = 1_000;

/** Module-level ring buffer — persists across requests in the same Node.js process. */
const store: GameEvent[] = [];

export function appendEvents(events: GameEvent[]): void {
  store.push(...events);
  if (store.length > MAX_EVENTS) {
    store.splice(0, store.length - MAX_EVENTS);
  }
}

export interface HistoryQuery {
  player?: string;
  limit: number;
  cursor?: string; // event id to start after
}

export interface HistoryResult {
  events: GameEvent[];
  cursor: string | null;
  total: number;
}

export function queryHistory({ player, limit, cursor }: HistoryQuery): HistoryResult {
  let filtered = player
    ? store.filter((e) => {
        if (e.type === "PropertyBought") return e.buyer === player;
        if (e.type === "PropertyListed") return e.seller === player;
        if (e.type === "PropertyTransferred")
          return e.from === player || e.to === player;
        if (e.type === "RentCollected") return e.owner === player;
        return false;
      })
    : [...store];

  // newest first
  filtered = filtered.reverse();

  const startIdx = cursor
    ? filtered.findIndex((e) => e.id === cursor) + 1
    : 0;

  const page = filtered.slice(startIdx, startIdx + limit);
  const nextCursor = page.length === limit ? page[page.length - 1].id : null;

  return { events: page, cursor: nextCursor, total: filtered.length };
}
