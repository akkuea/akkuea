# Add Game Event Indexing and Real-Time Board Updates

## Context

The city map should reflect the world as it actually is, not as it was when the page loaded. When one player buys a property, every player viewing the map should see the tile update within seconds. Akkuea Land achieves this through a Soroban event poller and a Server-Sent Events endpoint that both live inside `apps/akkuea-land` as Next.js Route Handlers; no separate backend service required.

## What Needs to Be Done

Create `src/app/api/game/events/route.ts` inside `apps/akkuea-land`. This Route Handler serves a GET request as a Server-Sent Events stream. When a client connects, the handler opens a connection to the Stellar RPC, polls for new events from the four game contract addresses, parses them into typed `GameEvent` objects, and sends them to all connected clients. A heartbeat comment is sent every 30 seconds to keep the connection alive through proxies.

Create a second Route Handler at `src/app/api/game/events/history/route.ts` that returns a paginated list of recent game events, filterable by player address. This is used by the dashboard's transaction history section.

On the frontend, create a `useGameEventStream` hook that connects to the SSE endpoint when the game shell mounts and dispatches received events into a React context. The city map subscribes to `PropertyBought` and `PropertyListed` events from that context. When a matching event arrives for a visible tile, the tile animates briefly (a quick brightness pulse) and its state updates.

The event poller must use exponential backoff when the Stellar RPC returns errors. It must not crash the handler on a single failed poll.

## Acceptance Criteria

- `GET /api/game/events` streams `GameEvent` objects via SSE.
- `GET /api/game/events/history` returns paginated events.
- City map tile updates visually when a `PropertyBought` event arrives for that tile.
- Heartbeat sent every 30 seconds.
- Poller uses exponential backoff on RPC errors.
- All CI workflows pass on the submitted pull request.

## Quality Standard

No dependency on `apps/api`. Everything lives in `apps/akkuea-land`. The event parsing code must be fully typed using the `GameEvent` union from `apps/shared`; no `any` casts on raw Soroban event payloads. Test that the SSE endpoint sends correctly formatted events by connecting to it manually with `curl` before marking this done.
