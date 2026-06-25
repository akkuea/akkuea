# C5-014: Add Game Event Indexing and Real-Time Board Updates

## Issue Metadata

| Attribute       | Value          |
| --------------- | -------------- |
| Issue ID        | C5-014         |
| Area            | GAME           |
| Difficulty      | High           |
| Labels          | frontend, high |
| Dependencies    | C5-007         |
| Estimated Lines | 250-350        |

## Architecture

Everything lives inside `apps/akkuea-land`. No dependency on `apps/api`.

```
src/app/api/game/
  events/
    route.ts          ← SSE stream of live GameEvents
    history/
      route.ts        ← paginated event history
  ledger/
    route.ts          ← current ledger number (used by EpochProgress)
src/hooks/useGameEventStream.ts
src/lib/sorobanEvents.ts
```

## SSE Route Handler

```typescript
// src/app/api/game/events/route.ts
import { NextRequest } from "next/server";
import { StellarSdk } from "@stellar/stellar-sdk";
import type { GameEvent } from "@akkuea/shared";
import { parseSorobanEvent } from "@/lib/sorobanEvents";

const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  "https://soroban-testnet.stellar.org";

const CONTRACT_IDS = [
  process.env.NEXT_PUBLIC_GAME_NFT_CONTRACT_ID,
  process.env.NEXT_PUBLIC_GAME_TOKEN_CONTRACT_ID,
  process.env.NEXT_PUBLIC_GAME_MARKETPLACE_CONTRACT_ID,
  process.env.NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID,
].filter(Boolean) as string[];

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      request.signal.addEventListener("abort", () => {
        closed = true;
        controller.close();
      });

      const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
      let backoff = 1_000;

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 30_000);

      while (!closed) {
        try {
          const response = await server.getEvents({
            filters: [{ type: "contract", contractIds: CONTRACT_IDS }],
            limit: 20,
          });

          for (const raw of response.events) {
            const event = parseSorobanEvent(raw);
            if (event) {
              const data = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          backoff = 1_000;
          await sleep(2_000);
        } catch {
          await sleep(backoff);
          backoff = Math.min(backoff * 2, 30_000);
        }
      }

      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering on Vercel
    },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
```

## Event History Route

```typescript
// src/app/api/game/events/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { StellarSdk } from "@stellar/stellar-sdk";
import { parseSorobanEvent } from "@/lib/sorobanEvents";

const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
  "https://soroban-testnet.stellar.org";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const actor = searchParams.get("actor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  try {
    const server = new StellarSdk.SorobanRpc.Server(RPC_URL);
    const response = await server.getEvents({
      filters: [
        {
          type: "contract",
          contractIds: [
            process.env.NEXT_PUBLIC_GAME_NFT_CONTRACT_ID!,
            process.env.NEXT_PUBLIC_GAME_MARKETPLACE_CONTRACT_ID!,
            process.env.NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID!,
          ].filter(Boolean),
        },
      ],
      limit,
    });

    const events = response.events
      .map(parseSorobanEvent)
      .filter(Boolean)
      .filter(
        (e) => !actor || (e && "actorAddress" in e && e.actorAddress === actor),
      );

    return NextResponse.json({
      events,
      hasMore: response.events.length === limit,
    });
  } catch {
    return NextResponse.json({ events: [], hasMore: false });
  }
}
```

## Current Ledger Route

```typescript
// src/app/api/game/ledger/route.ts
import { NextResponse } from "next/server";
import { StellarSdk } from "@stellar/stellar-sdk";

export async function GET() {
  try {
    const server = new StellarSdk.SorobanRpc.Server(
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
        "https://soroban-testnet.stellar.org",
    );
    const info = await server.getLatestLedger();
    return NextResponse.json({ ledger: info.sequence });
  } catch {
    return NextResponse.json({ ledger: 0 });
  }
}
```

## parseSorobanEvent

```typescript
// src/lib/sorobanEvents.ts
import type { GameEvent } from "@akkuea/shared";

type RawSorobanEvent = {
  topic: Array<{ type: string; value: string }>;
  value: { type: string; value: unknown };
  contractId?: string;
  ledger: number;
};

export function parseSorobanEvent(raw: RawSorobanEvent): GameEvent | null {
  const topicStr = raw.topic[0]?.value;
  const ledger = raw.ledger;

  try {
    switch (topicStr) {
      case "transfer":
        return {
          type: "PropertyBought",
          propertyId: String(raw.topic[2]?.value),
          buyer: String(raw.topic[1]?.value),
          price: 0n, // enriched by marketplace contract event
          ledger,
        };
      case "listed":
        return {
          type: "PropertyListed",
          propertyId: String(raw.topic[2]?.value),
          seller: String(raw.topic[1]?.value),
          price: BigInt(String(raw.value?.value ?? 0)),
          ledger,
        };
      case "improved":
        return {
          type: "PropertyImproved",
          propertyId: String(raw.topic[2]?.value),
          owner: String(raw.topic[1]?.value),
          newLevel: String(raw.topic[3]?.value) as GameEvent["newLevel"],
          ledger,
        };
      case "claimed":
        return {
          type: "RentalClaimed",
          propertyId: String(raw.topic[2]?.value),
          owner: String(raw.topic[1]?.value),
          amount: BigInt(String(raw.value?.value ?? 0)),
          ledger,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
```

Adjust topic indexing once the actual Soroban events are inspected from deployed contracts (C5-015). The contract emits topic arrays in a specific order; match those exactly.

## useGameEventStream Hook

```typescript
// src/hooks/useGameEventStream.ts
"use client";

import { useEffect } from "react";
import type { GameEvent } from "@akkuea/shared";

export function useGameEventStream(onEvent: (event: GameEvent) => void) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return;

    const es = new EventSource("/api/game/events");

    es.onmessage = (msg) => {
      try {
        const event: GameEvent = JSON.parse(msg.data);
        onEvent(event);
      } catch {}
    };

    es.onerror = () => {
      // EventSource reconnects automatically on error
    };

    return () => es.close();
  }, []);
}
```

## Vercel Note

Vercel serverless functions have a maximum execution time of 10 seconds for the Hobby plan and 60 seconds on Pro. Long-lived SSE connections will be terminated. For production, either:

- Upgrade to Vercel Pro (60s limit, sufficient for most connections with client-side reconnect).
- Use a persistent server deployment (Railway, Fly.io) for the akkuea-land app.
- Switch to a polling pattern: `useEffect` calls `/api/game/events/history` every 3-5 seconds.

Document this limitation in the issue PR and let the deployment target determine the approach.

## Definition of Done

- `GET /api/game/events` streams `GameEvent` objects via SSE.
- `GET /api/game/events/history` returns paginated events, filterable by actor.
- `GET /api/game/ledger` returns the current Stellar ledger sequence.
- City map tile animates when a `PropertyBought` event arrives for it.
- Heartbeat sent every 30 seconds.
- Exponential backoff on RPC errors.
- All CI workflows pass on the pull request.
