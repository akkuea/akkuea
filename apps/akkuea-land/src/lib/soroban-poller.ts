import { SorobanRpc, xdr } from "@stellar/stellar-sdk";
import type {
  GameEvent,
  PropertyBoughtEvent,
  PropertyListedEvent,
  PropertyTransferredEvent,
  RentCollectedEvent,
} from "@akkuea/shared";

const RPC_URL =
  process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

const CONTRACT_IDS: string[] = (
  process.env.GAME_CONTRACT_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Parse a raw Soroban event into a typed GameEvent, or null if unrecognised. */
function parseEvent(
  raw: SorobanRpc.Api.RawEventResponse,
  index: number,
): GameEvent | null {
  if (raw.type !== "contract") return null;

  const topics = raw.topic.map((t) => {
    try {
      return xdr.ScVal.fromXDR(t, "base64");
    } catch {
      return null;
    }
  });

  const eventTypeTopic = topics[0];
  if (!eventTypeTopic || eventTypeTopic.switch().name !== "scvSymbol")
    return null;

  const eventType = eventTypeTopic.sym().toString();

  const base = {
    ledger: raw.ledger,
    timestamp: raw.ledgerClosedAt,
    contractId: raw.contractId ?? "",
    id: `${raw.ledger}-${raw.txHash}-${index}`,
  };

  const str = (v: xdr.ScVal | null): string => {
    if (!v) return "";
    if (v.switch().name === "scvString") return v.str().toString();
    if (v.switch().name === "scvSymbol") return v.sym().toString();
    if (v.switch().name === "scvAddress")
      return v.address().toScAddress().toString();
    if (v.switch().name === "scvI128")
      return v.i128().lo().toString();
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

export interface PollResult {
  events: GameEvent[];
  /** Cursor to pass as startLedger on the next poll. */
  nextLedger: number;
}

/**
 * Poll Soroban RPC for new game events starting from `startLedger`.
 * Returns parsed events and the next ledger to poll from.
 */
export async function pollGameEvents(startLedger: number): Promise<PollResult> {
  const server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

  const filters: SorobanRpc.Server.GetEventsRequest["filters"] =
    CONTRACT_IDS.length > 0
      ? CONTRACT_IDS.map((contractId) => ({ type: "contract" as const, contractIds: [contractId] }))
      : [{ type: "contract" as const }];

  const response = await server.getEvents({
    startLedger,
    filters,
    limit: 100,
  });

  const events: GameEvent[] = [];
  let maxLedger = startLedger;

  for (let i = 0; i < response.events.length; i++) {
    const raw = response.events[i] as SorobanRpc.Api.RawEventResponse;
    if (raw.ledger > maxLedger) maxLedger = raw.ledger;
    const parsed = parseEvent(raw, i);
    if (parsed) events.push(parsed);
  }

  return { events, nextLedger: maxLedger + 1 };
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
