import { Elysia } from 'elysia';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';

const TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyStore = {
  servedFromCache?: boolean;
  claimedIdempotencyKey?: boolean;
};

/**
 * Atomically claim an idempotency key for this request.
 * Inserts a pending row (response NULL). On conflict, reclaims only if expired.
 * Returns the claimed row when this request owns the key; otherwise null.
 */
async function tryClaimKey(key: string, expiresAt: Date) {
  const result = await db.execute(sql`
    INSERT INTO idempotency_keys (key, response, expires_at)
    VALUES (${key}, NULL, ${expiresAt})
    ON CONFLICT (key) DO UPDATE
    SET
      response = NULL,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
    WHERE idempotency_keys.expires_at < NOW()
    RETURNING key
  `);

  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return rows.length > 0;
}

export const idempotency = new Elysia({ name: 'idempotency' })
  .derive({ as: 'global' }, async (ctx) => {
    const rawKey = ctx.headers['idempotency-key'] as string | undefined;
    if (!rawKey) return { idempotencyKey: undefined as string | undefined };

    let walletAddress = 'anonymous';
    if ('getAuthenticatedUser' in ctx) {
      const getAuthenticatedUser = (
        ctx as { getAuthenticatedUser?: () => Promise<{ walletAddress: string }> }
      ).getAuthenticatedUser;
      if (typeof getAuthenticatedUser === 'function') {
        try {
          const user = await getAuthenticatedUser();
          walletAddress = user.walletAddress;
        } catch {
          // user not authenticated, default to anonymous
        }
      }
    }

    return {
      idempotencyKey: `${walletAddress}:${rawKey}`,
    };
  })
  .onBeforeHandle({ as: 'global' }, async ({ idempotencyKey, store, set }) => {
    if (!idempotencyKey) return;

    const state = store as IdempotencyStore;
    const expiresAt = new Date(Date.now() + TTL_MS);
    const claimed = await tryClaimKey(idempotencyKey, expiresAt);

    if (claimed) {
      state.claimedIdempotencyKey = true;
      return;
    }

    // Another request holds a non-expired claim (or completed response)
    const existing = await db.query.idempotencyKeys.findFirst({
      where: and(
        eq(idempotencyKeys.key, idempotencyKey),
        gt(idempotencyKeys.expiresAt, new Date()),
      ),
    });

    if (existing?.response != null) {
      state.servedFromCache = true;
      return existing.response;
    }

    // In-flight concurrent request with the same key — do not re-run the handler
    set.status = 409;
    return {
      success: false,
      error: 'IDEMPOTENCY_CONFLICT',
      message: 'A request with this Idempotency-Key is already in progress.',
    };
  })
  .onAfterHandle({ as: 'global' }, async ({ idempotencyKey, response, store }) => {
    const state = store as IdempotencyStore;
    if (!idempotencyKey || !response || !state.claimedIdempotencyKey || state.servedFromCache) {
      return;
    }

    try {
      await db
        .update(idempotencyKeys)
        .set({
          response,
          expiresAt: new Date(Date.now() + TTL_MS),
        })
        .where(eq(idempotencyKeys.key, idempotencyKey));
    } catch (error) {
      console.error('Failed to save idempotency key', error);
    }
  });
