import { Elysia } from 'elysia';
import { rpc as SorobanRpc } from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

const LEDGER_POLL_MS = Number(process.env.LEDGER_POLL_MS ?? 3_000);

export interface LedgerEvent {
  sequence: number;
  timestamp: string;
}

class LedgerBroadcaster {
  // Lazily constructed so that mock.module() replacements are in effect before
  // the real SorobanRpc.Server constructor is ever called.
  private server: InstanceType<typeof SorobanRpc.Server> | null = null;
  private listeners = new Set<(evt: LedgerEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSequence = 0;

  subscribe(cb: (evt: LedgerEvent) => void): () => void {
    this.listeners.add(cb);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) this.stop();
    };
  }

  /** Call in beforeEach to prevent cross-test lastSequence contamination. */
  _resetForTest() {
    this.lastSequence = 0;
    this.server = null;
  }

  private getServer(): InstanceType<typeof SorobanRpc.Server> {
    if (!this.server) {
      this.server = new SorobanRpc.Server(SOROBAN_RPC_URL);
    }
    return this.server;
  }

  private start() {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), LEDGER_POLL_MS);
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.lastSequence = 0;
  }

  private async poll() {
    try {
      const { sequence } = await this.getServer().getLatestLedger();
      if (sequence === this.lastSequence) return;
      this.lastSequence = sequence;
      const event: LedgerEvent = { sequence, timestamp: new Date().toISOString() };
      for (const cb of this.listeners) cb(event);
    } catch {
      // ignore transient RPC errors
    }
  }
}

const broadcaster = new LedgerBroadcaster();

// GET /api/ledger/stream — SSE stream, emits { sequence, timestamp } on each new ledger
export const ledgerRoutes = new Elysia({ prefix: '/api/ledger' }).get(
  '/stream',
  ({ set, request }) => {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['X-Accel-Buffering'] = 'no';

    const signal = (request as Request & { signal?: AbortSignal }).signal;

    return new ReadableStream({
      start(controller) {
        let closed = false;

        const close = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        const unsubscribe = broadcaster.subscribe((evt: LedgerEvent) => {
          if (closed) return;
          try {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(evt)}\n\n`));
          } catch {
            close();
          }
        });

        // 25 s heartbeat keeps proxy connections alive
        const heartbeatId = setInterval(() => {
          if (closed) {
            clearInterval(heartbeatId);
            return;
          }
          try {
            controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
          } catch {
            clearInterval(heartbeatId);
            close();
          }
        }, 25_000);

        signal?.addEventListener('abort', () => {
          clearInterval(heartbeatId);
          close();
        });
      },
    });
  },
);
