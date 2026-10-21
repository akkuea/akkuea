import { describe, expect, it, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { idempotency } from '../middleware/idempotency';
import { errorHandler } from '../middleware/errorHandler';
import { ApiError } from '../errors/ApiError';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';

const skipIfNoDatabase = !process.env.DATABASE_URL;

// Does not require a database: an oversized Idempotency-Key is rejected
// before the middleware ever queries or inserts into idempotency_keys.
describe('Idempotency Middleware - oversized key', () => {
  const app = new Elysia().use(idempotency).post('/test-oversized', async ({ body }) => {
    return { success: true, body };
  });

  it('should return 400, not 500, for an Idempotency-Key longer than the column can store', async () => {
    const oversizedKey = 'k'.repeat(199);

    const res = await app.handle(
      new Request('http://localhost/test-oversized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': oversizedKey,
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('IDEMPOTENCY_KEY_TOO_LONG');
  });
});

describe.skipIf(skipIfNoDatabase)('Idempotency Middleware', () => {
  let counter = 0;

  beforeAll(async () => {
    // Force a clean schema matching the migration (CI may re-use the service DB).
    await db.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
    await db.execute(sql`
      CREATE TABLE idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        response JSONB NOT NULL,
        status_code INTEGER NOT NULL DEFAULT 200,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  });

  const app = new Elysia().use(idempotency).post('/test', async ({ body }) => {
    await new Promise((r) => setTimeout(r, 20));
    counter++;
    return { success: true, counter, body };
  });

  beforeEach(async () => {
    counter = 0;
    try {
      await db.delete(idempotencyKeys);
    } catch {
      // ignore if table missing
    }
  });

  it('should process a new key and return the response', async () => {
    const res = await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-1',
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );

    const text = await res.text();
    expect(res.status).toBe(200);
    const body = JSON.parse(text) as { counter: number };
    expect(body.counter).toBe(1);

    const keys = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, 'anonymous:key-1'));
    expect(keys.length).toBe(1);
    expect(keys[0]!.response).toEqual({ success: true, counter: 1, body: { data: 'test' } });
  });

  it('should return the cached response for a repeated key without re-running', async () => {
    await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-2',
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );

    const res2 = await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-2',
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );

    const body2 = JSON.parse(await res2.text()) as { counter: number };
    expect(res2.status).toBe(200);
    expect(body2.counter).toBe(1);
    expect(counter).toBe(1);
  });

  it('should re-run if the key is expired', async () => {
    await db.insert(idempotencyKeys).values({
      key: 'anonymous:key-3',
      response: { success: true, counter: 999, body: { data: 'old' } },
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-3',
        },
        body: JSON.stringify({ data: 'new' }),
      }),
    );

    const body = JSON.parse(await res.text()) as { counter: number };
    expect(res.status).toBe(200);
    expect(body.counter).toBe(1);
  });

  it('should scope the idempotency key by walletAddress if authenticated', async () => {
    const appWithAuth = new Elysia()
      .derive(() => ({
        getAuthenticatedUser: async () => ({ id: 'user-1', walletAddress: 'G123' }),
      }))
      .use(idempotency)
      .post('/test-auth', ({ body }) => {
        counter++;
        return { success: true, counter, body };
      });

    const res = await appWithAuth.handle(
      new Request('http://localhost/test-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-auth',
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );

    expect(res.status).toBe(200);

    const keys = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, 'G123:key-auth'));
    expect(keys.length).toBe(1);
  });

  it('should not run the handler twice under concurrent identical keys', async () => {
    const results = await Promise.all([
      app.handle(
        new Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'key-race',
          },
          body: JSON.stringify({ data: 'race' }),
        }),
      ),
      app.handle(
        new Request('http://localhost/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'key-race',
          },
          body: JSON.stringify({ data: 'race' }),
        }),
      ),
    ]);

    const statuses = results.map((r) => r.status).sort((a, b) => a - b);
    // Exactly one handler execution
    expect(counter).toBe(1);
    // One success; the other is either cached 200 or in-flight 409
    expect(statuses.some((s) => s === 200)).toBe(true);
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
  });

  function post(
    target: { handle: (request: Request) => Promise<Response> },
    path: string,
    key: string,
  ): Promise<Response> {
    return target.handle(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({ data: 'test' }),
      }),
    );
  }

  it('should release the key when the handler throws, so a retry runs again', async () => {
    let calls = 0;
    const failingOnce = new Elysia().use(idempotency).post('/flaky', () => {
      calls++;
      if (calls === 1) throw new Error('insufficient liquidity');
      return { success: true, calls };
    });

    const first = await post(failingOnce, '/flaky', 'key-throw');
    expect(first.status).toBe(500);

    const pending = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, 'anonymous:key-throw'));
    expect(pending.length).toBe(0);

    const second = await post(failingOnce, '/flaky', 'key-throw');
    expect(second.status).toBe(200);
    expect(((await second.json()) as { calls: number }).calls).toBe(2);
    expect(calls).toBe(2);
  });

  it('should release the key when a handler throws behind the global errorHandler', async () => {
    // Mirrors index.ts / app.ts: errorHandler is registered before the route
    // plugins and returns a body from its global onError.
    let calls = 0;
    const routes = new Elysia().use(idempotency).post('/borrow', () => {
      calls++;
      if (calls === 1) throw ApiError.badRequest('Insufficient liquidity');
      return { success: true, calls };
    });
    const realApp = new Elysia().use(errorHandler).use(routes);

    const first = await post(realApp, '/borrow', 'key-error-handler');
    expect(first.status).toBe(400);

    const pending = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, 'anonymous:key-error-handler'));
    expect(pending.length).toBe(0);

    const second = await post(realApp, '/borrow', 'key-error-handler');
    expect(second.status).toBe(200);
    expect(((await second.json()) as { calls: number }).calls).toBe(2);
    expect(calls).toBe(2);
  });

  it('should cache a returned Response with its status and body, and run once', async () => {
    let calls = 0;
    const responseApp = new Elysia().use(idempotency).post('/created', () => {
      calls++;
      return new Response(JSON.stringify({ a: 1 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const first = await post(responseApp, '/created', 'key-response');
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ a: 1 });

    const stored = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, 'anonymous:key-response'));
    expect(stored[0]!.response).toEqual({ a: 1 });
    expect(stored[0]!.statusCode).toBe(201);

    const replay = await post(responseApp, '/created', 'key-response');
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual({ a: 1 });
    expect(calls).toBe(1);
  });

  it('should not cache a 4xx/5xx body set via set.status, so a retry runs again', async () => {
    let calls = 0;
    const errorBodyApp = new Elysia().use(idempotency).post('/rpc', ({ set }) => {
      calls++;
      if (calls === 1) {
        set.status = 502;
        return { success: false, error: 'STELLAR_RPC_UNAVAILABLE' };
      }
      return { success: true, calls };
    });

    const first = await post(errorBodyApp, '/rpc', 'key-error-body');
    expect(first.status).toBe(502);

    const stored = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, 'anonymous:key-error-body'));
    expect(stored.length).toBe(0);

    const second = await post(errorBodyApp, '/rpc', 'key-error-body');
    expect(second.status).toBe(200);
    expect(((await second.json()) as { calls: number }).calls).toBe(2);
    expect(calls).toBe(2);
  });

  it('should replay a cached result with its stored status', async () => {
    await db.insert(idempotencyKeys).values({
      key: 'anonymous:key-202',
      response: { success: true, queued: true },
      statusCode: 202,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await post(app, '/test', 'key-202');
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ success: true, queued: true });
    expect(counter).toBe(0);
  });
});
