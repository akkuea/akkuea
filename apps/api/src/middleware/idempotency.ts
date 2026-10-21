import { Elysia, StatusMap } from 'elysia';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';

const TTL_MS = 24 * 60 * 60 * 1000;

// The stored key is `${walletAddress}:${rawKey}` and the column is
// varchar(255). The longest possible prefix is a 56-character Stellar
// wallet address plus the separator (57 chars), so the raw client-supplied
// key must leave room for that: 255 - 57 = 198.
const MAX_IDEMPOTENCY_KEY_LENGTH = 198;

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

/**
 * Release a claimed key so a retry with the same key runs the handler again.
 * Used by onAfterHandle when the handler returned a non-2xx result.
 */
async function releaseKey(key: string): Promise<void> {
  try {
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
  } catch (error) {
    console.error('Failed to release idempotency key', error);
  }
}

/**
 * Release a claimed key only if it still holds the pending marker, i.e. the
 * request ended without onAfterHandle caching a result (a thrown handler).
 */
async function releasePendingKey(key: string): Promise<void> {
  try {
    await db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, key),
          sql`${idempotencyKeys.response}->>'__idempotency' = ${PENDING_MARKER.__idempotency}`,
        ),
      );
  } catch (error) {
    console.error('Failed to release idempotency key', error);
  }
}

async function releaseIfClaimed(ctx: unknown): Promise<void> {
  const { idempotencyKey, claimedIdempotencyKey, servedFromCache } = ctx as {
    idempotencyKey?: string;
    claimedIdempotencyKey?: boolean;
    servedFromCache?: boolean;
  };
  if (idempotencyKey && claimedIdempotencyKey && !servedFromCache) {
    await releasePendingKey(idempotencyKey);
  }
}

function resolveStatus(status: number | keyof typeof StatusMap | undefined): number {
  if (typeof status === 'number') return status;
  if (status === undefined) return 200;
  return StatusMap[status] ?? 200;
}

/**
 * Read the status and JSON body a handler produced. A returned `Response`
 * is cloned so the client still receives the original stream; a body that
 * is not JSON returns `undefined` and is not cached.
 */
async function readResult(
  response: unknown,
  status: number | keyof typeof StatusMap | undefined,
): Promise<{ status: number; body: unknown } | undefined> {
  if (response instanceof Response) {
    try {
      const text = await response.clone().text();
      return { status: response.status, body: JSON.parse(text) as unknown };
    } catch {
      return undefined;
    }
  }
  return { status: resolveStatus(status), body: response };
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

    if (rawKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      return {
        idempotencyKey: undefined as string | undefined,
        claimedIdempotencyKey: false,
        servedFromCache: false,
        idempotencyKeyTooLong: true as boolean,
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
        cachedIdempotencyStatus: existing.statusCode,
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
      cachedIdempotencyStatus,
      idempotencyInFlight,
      idempotencyClaimError,
      idempotencyKeyTooLong,
    }) => {
      if (idempotencyKeyTooLong) {
        set.status = 400;
        return {
          success: false,
          error: 'IDEMPOTENCY_KEY_TOO_LONG',
          message: `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
        };
      }

      if (idempotencyClaimError) {
        set.status = 500;
        return {
          success: false,
          error: 'IDEMPOTENCY_ERROR',
          message: 'Failed to process Idempotency-Key.',
        };
      }

      if (servedFromCache && cachedIdempotencyResponse !== undefined) {
        set.status = cachedIdempotencyStatus ?? 200;
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
    async ({ idempotencyKey, response, set, claimedIdempotencyKey, servedFromCache }) => {
      if (!idempotencyKey || !claimedIdempotencyKey || servedFromCache) {
        return;
      }

      if (isPendingResponse(response)) return;

      const result = response == null ? undefined : await readResult(response, set.status);

      // Cache only successful results. Anything else releases the key so a
      // retry runs the handler again instead of replaying the failure.
      if (!result || result.status < 200 || result.status >= 300) {
        await releaseKey(idempotencyKey);
        return;
      }

      try {
        await db
          .update(idempotencyKeys)
          .set({
            response: result.body,
            statusCode: result.status,
            expiresAt: new Date(Date.now() + TTL_MS),
          })
          .where(eq(idempotencyKeys.key, idempotencyKey));
      } catch (error) {
        console.error('Failed to save idempotency key', error);
      }
    },
  )
  // Release the key of a request that ended without a cached result (a
  // thrown handler). Two hooks are needed because neither runs on every
  // error path:
  // - mapResponse runs after the app's global errorHandler produced the error
  //   body, where a plugin onError never runs (Elysia stops at the first
  //   onError that returns a body, and errorHandler is registered before the
  //   route plugins). It runs before the response is returned, so an
  //   immediate retry cannot see a stale pending marker.
  // - onError covers apps without such a handler, where Elysia's default
  //   error response skips mapResponse.
  // The release only deletes a row still holding the pending marker, so a
  // cached result is never removed and running both hooks is harmless.
  .onError({ as: 'global' }, async (ctx) => {
    await releaseIfClaimed(ctx);
  })
  .mapResponse({ as: 'global' }, async (ctx) => {
    await releaseIfClaimed(ctx);
  });
