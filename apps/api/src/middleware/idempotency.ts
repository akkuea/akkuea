import { Elysia } from 'elysia';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';

const TTL_MS = 24 * 60 * 60 * 1000;

/** Marker stored while a request is in-flight (never returned to clients). */
const PENDING_MARKER = { __idempotency: 'pending' } as const;

function isPendingResponse(response: unknown): boolean {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { __idempotency?: string }).__idempotency === 'pending'
  );
}

/**
 * Atomically reserve an idempotency key for this request.
 * Uses primary-key uniqueness as the race guard (INSERT ... ON CONFLICT DO NOTHING).
 * Expired rows are reclaimed via a conditional UPDATE.
 */
async function tryClaimKey(key: string, expiresAt: Date): Promise<boolean> {
  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      key,
      response: PENDING_MARKER,
      expiresAt,
    })
    .onConflictDoNothing({ target: idempotencyKeys.key })
    .returning({ key: idempotencyKeys.key });

  if (inserted.length > 0) {
    return true;
  }

  const reclaimed = await db
    .update(idempotencyKeys)
    .set({
      response: PENDING_MARKER,
      expiresAt,
      createdAt: new Date(),
    })
    .where(and(eq(idempotencyKeys.key, key), lt(idempotencyKeys.expiresAt, new Date())))
    .returning({ key: idempotencyKeys.key });

  return reclaimed.length > 0;
}

export const idempotency = new Elysia({ name: 'idempotency' })
  .derive({ as: 'global' }, async (ctx) => {
    const rawKey = ctx.headers['idempotency-key'] as string | undefined;
    if (!rawKey) {
      return {
        idempotencyKey: undefined as string | undefined,
        claimedIdempotencyKey: false,
        servedFromCache: false,
      };
    }

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

    const idempotencyKey = `${walletAddress}:${rawKey}`;
    const expiresAt = new Date(Date.now() + TTL_MS);

    let claimed = false;
    try {
      claimed = await tryClaimKey(idempotencyKey, expiresAt);
    } catch (error) {
      console.error('Failed to claim idempotency key', error);
      return {
        idempotencyKey,
        claimedIdempotencyKey: false,
        servedFromCache: false,
        idempotencyClaimError: true as boolean,
      };
    }

    if (claimed) {
      return {
        idempotencyKey,
        claimedIdempotencyKey: true,
        servedFromCache: false,
      };
    }

    const existing = await db.query.idempotencyKeys.findFirst({
      where: and(
        eq(idempotencyKeys.key, idempotencyKey),
        gt(idempotencyKeys.expiresAt, new Date()),
      ),
    });

    if (existing && existing.response != null && !isPendingResponse(existing.response)) {
      return {
        idempotencyKey,
        claimedIdempotencyKey: false,
        servedFromCache: true,
        cachedIdempotencyResponse: existing.response as unknown,
      };
    }

    return {
      idempotencyKey,
      claimedIdempotencyKey: false,
      servedFromCache: false,
      idempotencyInFlight: true as boolean,
    };
  })
  .onBeforeHandle(
    { as: 'global' },
    ({
      set,
      servedFromCache,
      cachedIdempotencyResponse,
      idempotencyInFlight,
      idempotencyClaimError,
    }) => {
      if (idempotencyClaimError) {
        set.status = 500;
        return {
          success: false,
          error: 'IDEMPOTENCY_ERROR',
          message: 'Failed to process Idempotency-Key.',
        };
      }

      if (servedFromCache && cachedIdempotencyResponse !== undefined) {
        return cachedIdempotencyResponse;
      }

      if (idempotencyInFlight) {
        set.status = 409;
        return {
          success: false,
          error: 'IDEMPOTENCY_CONFLICT',
          message: 'A request with this Idempotency-Key is already in progress.',
        };
      }
    },
  )
  .onAfterHandle(
    { as: 'global' },
    async ({ idempotencyKey, response, claimedIdempotencyKey, servedFromCache }) => {
      if (!idempotencyKey || response == null || !claimedIdempotencyKey || servedFromCache) {
        return;
      }

      if (isPendingResponse(response)) return;

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
    },
  );
