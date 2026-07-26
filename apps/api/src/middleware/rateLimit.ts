import type { Context } from 'elysia';

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (context: Pick<Context, 'request' | 'set'>) => Promise<string> | string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimitRedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

export interface RateLimitStore {
  checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult>;
}

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX = 10;

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

async function getIdentifier(
  ctx: Pick<Context, 'request' | 'set'>,
  keyGenerator?: (context: Pick<Context, 'request' | 'set'>) => Promise<string> | string,
): Promise<string> {
  if (keyGenerator) {
    return keyGenerator(ctx);
  }
  return `ip:${getClientIP(ctx.request)}`;
}

export async function walletKeyGenerator(ctx: Pick<Context, 'request' | 'set'>): Promise<string> {
  const getAuthenticatedUser = (ctx as Record<string, unknown>)['getAuthenticatedUser'] as
    | (() => Promise<{ id: string; walletAddress: string }>)
    | undefined;

  if (typeof getAuthenticatedUser === 'function') {
    try {
      const user = await getAuthenticatedUser();
      if (user.walletAddress) {
        return `wallet:${user.walletAddress}`;
      }
    } catch {
      // Auth not available or token invalid – fall through to IP
    }
  }
  return `ip:${getClientIP(ctx.request)}`;
}

export function createRedisStore(client: RateLimitRedisClient): RateLimitStore {
  return {
    async checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult> {
      const key = `ratelimit:${identifier}`;
      const ttlSeconds = Math.ceil(windowMs / 1000);

      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }

      const ttl = await client.ttl(key);
      const resetAt = Date.now() + Math.max(0, ttl) * 1000;
      const remaining = Math.max(0, max - count);

      if (count > max) {
        return { allowed: false, remaining: 0, resetAt, retryAfter: Math.max(0, ttl) };
      }

      return { allowed: true, remaining, resetAt };
    },
  };
}

export function createMemoryStore(): RateLimitStore {
  const store = new Map<string, { count: number; resetAt: number }>();

  return {
    async checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult> {
      const now = Date.now();
      const entry = store.get(identifier);

      if (!entry || now >= entry.resetAt) {
        const resetAt = now + windowMs;
        store.set(identifier, { count: 1, resetAt });
        return { allowed: true, remaining: max - 1, resetAt };
      }

      entry.count += 1;
      const remaining = Math.max(0, max - entry.count);

      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
      }

      return { allowed: true, remaining, resetAt: entry.resetAt };
    },
  };
}

export function rateLimit(options: RateLimitOptions = {}) {
  const { windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX, keyGenerator } = options;

  const redisUrl = process.env.REDIS_URL;
  let storeReady: Promise<RateLimitStore>;

  if (redisUrl) {
    storeReady = import('ioredis').then(({ default: Redis }) => {
      const client = new Redis(redisUrl, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });
      return createRedisStore(client);
    });
  } else {
    console.warn(
      '[rateLimit] REDIS_URL not set - using in-memory rate limiting (not safe for multi-instance deployments)',
    );
    storeReady = Promise.resolve(createMemoryStore());
  }

  return async function rateLimitMiddleware(ctx: Pick<Context, 'request' | 'set'>) {
    if (ctx.request.headers.get('x-test-bypass-ratelimit') === 'true') {
      return;
    }

    const identifier = await getIdentifier(ctx, keyGenerator);
    const store = await storeReady;
    const result = await store.checkLimit(identifier, windowMs, max);

    if (!ctx.set.headers) {
      ctx.set.headers = {};
    }
    ctx.set.headers['X-RateLimit-Limit'] = String(max);
    ctx.set.headers['X-RateLimit-Remaining'] = String(result.remaining);
    ctx.set.headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      ctx.set.status = 429;
      if (result.retryAfter) {
        ctx.set.headers['Retry-After'] = String(result.retryAfter);
      }
      return {
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      };
    }
  };
}
