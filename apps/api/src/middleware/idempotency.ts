import { Elysia } from 'elysia';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';
import { eq, and, gt } from 'drizzle-orm';

export const idempotency = new Elysia({ name: 'idempotency' })
  .derive(({ headers }) => ({
    idempotencyKey: headers['idempotency-key'] as string | undefined
  }))
  .onBeforeHandle(async ({ idempotencyKey, store }) => {
    if (!idempotencyKey) return;
    
    const existing = await db.query.idempotencyKeys.findFirst({
      where: and(
        eq(idempotencyKeys.key, idempotencyKey),
        gt(idempotencyKeys.expiresAt, new Date())
      )
    });
    
    if (existing) {
      (store as { servedFromCache?: boolean }).servedFromCache = true;
      return existing.response;
    }
  })
  .onAfterHandle(async ({ idempotencyKey, response, store }) => {
    if (!idempotencyKey || !response || (store as { servedFromCache?: boolean }).servedFromCache) return;
    
    // Save to db (TTL: 24 hours)
    const TTL_MS = 24 * 60 * 60 * 1000;
    try {
      await db.insert(idempotencyKeys).values({
        key: idempotencyKey,
        response: response,
        expiresAt: new Date(Date.now() + TTL_MS),
      }).onConflictDoUpdate({
        target: idempotencyKeys.key,
        set: {
          response: response,
          expiresAt: new Date(Date.now() + TTL_MS),
        }
      });
    } catch (e) {
      console.error('Failed to save idempotency key', e);
    }
  });
