/** Typed Soroban game events emitted by the four Akkuea Land contracts. */

export interface BaseGameEvent {
  /** Ledger sequence number the event was emitted in. */
  ledger: number;
  /** ISO-8601 timestamp of the ledger close. */
  timestamp: string;
  /** Contract address that emitted the event. */
  contractId: string;
  /** Unique event id: `${ledger}-${txHash}-${eventIndex}` */
  id: string;
}

export interface PropertyBoughtEvent extends BaseGameEvent {
  type: "PropertyBought";
  tileId: string;
  buyer: string;
  price: string; // stroops as string to avoid BigInt serialisation issues
}

export interface PropertyListedEvent extends BaseGameEvent {
  type: "PropertyListed";
  tileId: string;
  seller: string;
  askPrice: string;
}

export interface PropertyTransferredEvent extends BaseGameEvent {
  type: "PropertyTransferred";
  tileId: string;
  from: string;
  to: string;
}

export interface RentCollectedEvent extends BaseGameEvent {
  type: "RentCollected";
  tileId: string;
  owner: string;
  amount: string;
}

export type GameEvent =
  | PropertyBoughtEvent
  | PropertyListedEvent
  | PropertyTransferredEvent
  | RentCollectedEvent;

export type GameEventType = GameEvent["type"];

export interface PaginatedGameEvents {
  events: GameEvent[];
  cursor: string | null;
  total: number;
}
