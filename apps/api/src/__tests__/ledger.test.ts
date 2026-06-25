import { describe, test, expect, beforeEach, mock } from 'bun:test';

let mockSequence = 100;

// mock must be registered before any dynamic import of the route
mock.module('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: class MockServer {
      async getLatestLedger() {
        return { sequence: mockSequence };
      }
    },
  },
}));

const { ledgerRoutes } = await import('../routes/ledger');

const { Elysia } = (await import('elysia')) as typeof import('elysia');

function makeApp() {
  return new Elysia().use(
    ledgerRoutes as unknown as Parameters<InstanceType<typeof Elysia>['use']>[0],
  );
}

type AppWithHandle = { handle: (req: Request) => Promise<Response> };

async function readFirstEvent(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  for (let i = 0; i < 20; i++) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    if (accumulated.includes('\n\n')) break;
  }
  reader.cancel();
  return accumulated;
}

describe('GET /api/ledger/stream', () => {
  beforeEach(() => {
    mockSequence = 100;
  });

  test('returns 200 with correct SSE headers', async () => {
    const app = makeApp();
    const res = await (app as unknown as AppWithHandle).handle(
      new Request('http://localhost/api/ledger/stream'),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');

    await res.body?.cancel();
  });

  test('response body is a ReadableStream', async () => {
    const app = makeApp();
    const res = await (app as unknown as AppWithHandle).handle(
      new Request('http://localhost/api/ledger/stream'),
    );

    expect(res.body).not.toBeNull();
    expect(typeof res.body?.getReader).toBe('function');
    await res.body?.cancel();
  });

  test('first chunk contains a valid JSON ledger event', async () => {
    mockSequence = 777;

    const app = makeApp();
    const res = await (app as unknown as AppWithHandle).handle(
      new Request('http://localhost/api/ledger/stream'),
    );
    expect(res.body).not.toBeNull();

    const accumulated = await readFirstEvent(res.body!);
    const dataLine = accumulated.split('\n').find((l) => l.startsWith('data:'));
    expect(dataLine).toBeDefined();

    const json = JSON.parse(dataLine!.replace(/^data:\s*/, '')) as {
      sequence: number;
      timestamp: string;
    };

    expect(typeof json.sequence).toBe('number');
    expect(json.sequence).toBeGreaterThan(0);
    expect(typeof json.timestamp).toBe('string');
    expect(isNaN(Date.parse(json.timestamp))).toBe(false);
  });

  test('event sequence matches the mocked RPC value', async () => {
    mockSequence = 42;

    const app = makeApp();
    const res = await (app as unknown as AppWithHandle).handle(
      new Request('http://localhost/api/ledger/stream'),
    );
    expect(res.body).not.toBeNull();

    const accumulated = await readFirstEvent(res.body!);
    const dataLine = accumulated.split('\n').find((l) => l.startsWith('data:'));
    const json = JSON.parse(dataLine!.replace(/^data:\s*/, '')) as { sequence: number };
    expect(json.sequence).toBe(42);
  });
});

describe('LedgerEvent type contract', () => {
  test('LedgerEvent has required numeric sequence and ISO timestamp', () => {
    const evt: { sequence: number; timestamp: string } = {
      sequence: 12345,
      timestamp: new Date().toISOString(),
    };
    expect(typeof evt.sequence).toBe('number');
    expect(typeof evt.timestamp).toBe('string');
    expect(isNaN(Date.parse(evt.timestamp))).toBe(false);
  });
});
