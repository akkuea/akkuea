import { getLatestLedger, pollGameEvents } from "@/lib/soroban-poller";
import { appendEvents } from "@/lib/event-store";
import type { GameEvent } from "@akkuea/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 1_000;

function sseData(event: GameEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function sseComment(msg: string): string {
  return `: ${msg}\n\n`;
}

export async function GET(): Promise<Response> {
  let startLedger: number;
  try {
    startLedger = await getLatestLedger();
  } catch {
    return new Response("RPC unavailable", { status: 503 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let backoff = BASE_BACKOFF_MS;
      let lastHeartbeat = Date.now();

      const enqueue = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };

      enqueue(sseComment("connected"));

      while (!closed) {
        if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          enqueue(sseComment("heartbeat"));
          lastHeartbeat = Date.now();
        }

        try {
          const { events, nextLedger } = await pollGameEvents(startLedger);
          startLedger = nextLedger;
          backoff = BASE_BACKOFF_MS;

          if (events.length > 0) {
            appendEvents(events);
            for (const event of events) {
              enqueue(sseData(event));
            }
          }

          await sleep(POLL_INTERVAL_MS);
        } catch {
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
