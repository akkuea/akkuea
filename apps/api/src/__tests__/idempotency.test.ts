import { describe, expect, it, beforeEach, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { idempotency } from '../middleware/idempotency';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';

const skipIfNoDatabase = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDatabase)('Idempotency Middleware', () => {
  let counter = 0;

  beforeAll(async () => {
    // Force a clean schema matching the migration (CI may re-use the service DB).
    await db.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
    await db.execute(sql`
      CREATE TABLE idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        response JSONB NOT NULL,
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
});
