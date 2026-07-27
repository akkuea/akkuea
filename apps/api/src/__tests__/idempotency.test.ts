import { describe, expect, it, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { idempotency } from '../middleware/idempotency';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';
import { eq } from 'drizzle-orm';

describe('Idempotency Middleware', () => {
  let counter = 0;

  const app = new Elysia()
    .use(idempotency)
    .post('/test', ({ body }) => {
      counter++;
      return { success: true, counter, body };
    });

  beforeEach(async () => {
    counter = 0;
    try {
      await db.delete(idempotencyKeys);
    } catch (e) {
      // Ignore in case DB isn't fully set up for this test in isolated mode
    }
  });

  it('should process a new key and return the response', async () => {
    const res = await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-1'
        },
        body: JSON.stringify({ data: 'test' })
      })
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.counter).toBe(1);
    
    const keys = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'key-1'));
    expect(keys.length).toBe(1);
    expect(keys[0]!.response).toEqual({ success: true, counter: 1, body: { data: 'test' } });
  });

  it('should return the cached response for a repeated key without re-running', async () => {
    await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-2'
        },
        body: JSON.stringify({ data: 'test' })
      })
    );

    const res2 = await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-2'
        },
        body: JSON.stringify({ data: 'test' })
      })
    );

    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(body2.counter).toBe(1);
    expect(counter).toBe(1);
  });

  it('should re-run if the key is expired', async () => {
    await db.insert(idempotencyKeys).values({
      key: 'key-3',
      response: { success: true, counter: 999, body: { data: 'old' } },
      expiresAt: new Date(Date.now() - 1000)
    }).onConflictDoUpdate({
      target: idempotencyKeys.key,
      set: {
        response: { success: true, counter: 999, body: { data: 'old' } },
        expiresAt: new Date(Date.now() - 1000)
      }
    });

    const res = await app.handle(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-3'
        },
        body: JSON.stringify({ data: 'new' })
      })
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.counter).toBe(1);
  });
});
