import { rpc as SorobanRpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import type {
  GameEvent,
  PropertyBoughtEvent,
  PropertyListedEvent,
  PropertyTransferredEvent,
  RentCollectedEvent,
} from "@akkuea/shared";

const RPC_URL =
  process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

const CONTRACT_IDS: string[] = (process.env.GAME_CONTRACT_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PAGE_LIMIT = 100;

/** Parse a raw Soroban event into a typed GameEvent, or null if unrecognised. */
function parseEvent(
  raw: SorobanRpc.Api.EventResponse,
  index: number,
): GameEvent | null {
  if (raw.type !== "contract") return null;

  const topics = raw.topic;

  const eventTypeTopic = topics[0];
  if (!eventTypeTopic || eventTypeTopic.type !== "scvSymbol") return null;

  const eventType = eventTypeTopic.sym.toString();

  const base = {
    ledger: raw.ledger,
    timestamp: raw.ledgerClosedAt,
    contractId: raw.contractId?.toString() ?? "",
    id: `${raw.ledger}-${raw.txHash}-${index}`,
  };

  // scValToNative decodes the full 128-bit integer and the G/C strkey form of
  // an address; reading the raw XDR parts loses the high bits and yields
  // base64 XDR for addresses.
  const str = (v: xdr.ScVal | null): string => {
    if (!v) return "";
    const native: unknown = scValToNative(v);
    if (
      typeof native === "string" ||
      typeof native === "number" ||
      typeof native === "bigint"
    ) {
      return native.toString();
    }
    return "";
  };

  switch (eventType) {
    case "PropertyBought":
      return {
        ...base,
        type: "PropertyBought",
        tileId: str(topics[1]),
        buyer: str(topics[2]),
        price: str(topics[3]),
      } satisfies PropertyBoughtEvent;

    case "PropertyListed":
      return {
        ...base,
        type: "PropertyListed",
        tileId: str(topics[1]),
        seller: str(topics[2]),
        askPrice: str(topics[3]),
      } satisfies PropertyListedEvent;

    case "PropertyTransferred":
      return {
        ...base,
        type: "PropertyTransferred",
        tileId: str(topics[1]),
        from: str(topics[2]),
        to: str(topics[3]),
      } satisfies PropertyTransferredEvent;

    case "RentCollected":
      return {
        ...base,
        type: "RentCollected",
        tileId: str(topics[1]),
        owner: str(topics[2]),
        amount: str(topics[3]),
      } satisfies RentCollectedEvent;

    default:
      return null;
  }
}

/**
 * Where to resume reading events: a ledger for the first poll, then the
 * cursor returned by the previous poll. Resuming from the cursor (rather than
 * the next ledger) means a page that fills up partway through a ledger
 * continues with that ledger's remaining events instead of skipping them.
 */
export type PollPosition = { startLedger: number } | { cursor: string };

export interface PollResult {
  events: GameEvent[];
  /** Paging cursor to pass back as `{ cursor }` on the next poll. */
  cursor: string;
}

/**
 * Poll Soroban RPC for one page of new game events from `position`.
 * Returns the parsed events and the cursor to resume from.
 */
export async function pollGameEvents(
  position: PollPosition,
): Promise<PollResult> {
  const server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

  const filters: SorobanRpc.Server.GetEventsRequest["filters"] =
    CONTRACT_IDS.length > 0
      ? CONTRACT_IDS.map((contractId) => ({
          type: "contract" as const,
          contractIds: [contractId],
        }))
      : [{ type: "contract" as const }];

  const response = await server.getEvents({
    ...position,
    filters,
    limit: PAGE_LIMIT,
  });

  const events: GameEvent[] = [];

  for (let i = 0; i < response.events.length; i++) {
    const parsed = parseEvent(response.events[i], i);
    if (parsed) events.push(parsed);
  }

  return { events, cursor: response.cursor };
}

/**
 * Fetch the latest ledger sequence from the RPC.
 * Used to initialise the poller cursor.
 */
export async function getLatestLedger(): Promise<number> {
  const server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });
  const info = await server.getLatestLedger();
  return info.sequence;
}
