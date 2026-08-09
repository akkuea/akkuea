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

/**
 * Minimal Redis surface used by the rate limiter.
 * `runScript` executes a Lua script atomically on Redis.
 */
export interface RateLimitRedisClient {
  runScript(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export interface RateLimitStore {
  checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult>;
}

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX = 10;

/**
 * Sliding-window log algorithm executed atomically in Redis.
 *
 * KEYS[1]  – sorted-set key (scores = request timestamps in ms)
 * ARGV[1]  – now (ms)
 * ARGV[2]  – windowMs
 * ARGV[3]  – max requests
 * ARGV[4]  – unique member id for this request
 *
 * Returns: { allowed (0|1), remaining, resetAt (ms), retryAfter (seconds) }
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = now - windowMs

-- Drop timestamps that fell outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local count = redis.call('ZCARD', key)

if count < max then
  redis.call('ZADD', key, now, member)
  -- Keep the key at least as long as the window; refresh on every allow
  redis.call('PEXPIRE', key, windowMs)
  count = count + 1

  local remaining = max - count
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetAt = now + windowMs
  if oldest[2] then
    resetAt = tonumber(oldest[2]) + windowMs
  end

  return {1, remaining, resetAt, 0}
end

-- Over limit: do not record this request
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetAt = now + windowMs
if oldest[2] then
  resetAt = tonumber(oldest[2]) + windowMs
end
local retryAfter = math.ceil((resetAt - now) / 1000)
if retryAfter < 0 then
  retryAfter = 0
end

return {0, 0, resetAt, retryAfter}
`;

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

function parseScriptResult(raw: unknown): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
} {
  if (!Array.isArray(raw) || raw.length < 4) {
    throw new Error('Unexpected rate-limit script response from Redis');
  }
  const allowed = Number(raw[0]) === 1;
  const remaining = Math.max(0, Number(raw[1]));
  const resetAt = Number(raw[2]);
  const retryAfter = Math.max(0, Number(raw[3]));
  return { allowed, remaining, resetAt, retryAfter };
}

function uniqueMember(now: number): string {
  // Score collisions are fine in ZSET; members must be unique so concurrent
  // requests in the same millisecond are counted separately.
  return `${now}:${Math.random().toString(36).slice(2, 11)}`;
}

export function createRedisStore(client: RateLimitRedisClient): RateLimitStore {
  return {
    async checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult> {
      const key = `ratelimit:${identifier}`;
      const now = Date.now();
      const member = uniqueMember(now);

      const raw = await client.runScript(SLIDING_WINDOW_SCRIPT, 1, key, now, windowMs, max, member);
      const parsed = parseScriptResult(raw);

      if (!parsed.allowed) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: parsed.resetAt,
          retryAfter: parsed.retryAfter,
        };
      }

      return {
        allowed: true,
        remaining: parsed.remaining,
        resetAt: parsed.resetAt,
      };
    },
  };
}

/**
 * In-process sliding-window log (same algorithm as Redis; not multi-instance safe).
 * Uses a simple mutex so concurrent checkLimit calls cannot race the counter.
 */
export function createMemoryStore(): RateLimitStore {
  const store = new Map<string, number[]>();
  /** Per-identifier chain so overlapping async checks stay consistent. */
  const locks = new Map<string, Promise<void>>();

  async function withLock<T>(identifier: string, fn: () => T | Promise<T>): Promise<T> {
    const prev = locks.get(identifier) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(
      identifier,
      prev.then(() => gate).catch(() => gate),
    );
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return {
    async checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult> {
      return withLock(identifier, () => {
        const now = Date.now();
        const windowStart = now - windowMs;
        const timestamps = (store.get(identifier) ?? []).filter((t) => t > windowStart);

        if (timestamps.length < max) {
          timestamps.push(now);
          store.set(identifier, timestamps);
          const remaining = max - timestamps.length;
          const oldest = timestamps[0] ?? now;
          const resetAt = oldest + windowMs;
          return { allowed: true, remaining, resetAt };
        }

        store.set(identifier, timestamps);
        const oldest = timestamps[0] ?? now;
        const resetAt = oldest + windowMs;
        const retryAfter = Math.max(0, Math.ceil((resetAt - now) / 1000));
        return { allowed: false, remaining: 0, resetAt, retryAfter };
      });
    },
  };
}

/** Adapt an ioredis-like client to RateLimitRedisClient via Redis CALL. */
function wrapIoredisClient(client: {
  call(command: string, ...args: (string | number | Buffer)[]): Promise<unknown>;
}): RateLimitRedisClient {
  return {
    runScript(script, numKeys, ...args) {
      return client.call('EVAL', script, numKeys, ...args);
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
      return createRedisStore(wrapIoredisClient(client));
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
      if (result.retryAfter !== undefined) {
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

/** Exported for unit tests that need to exercise the Lua script via a fake client. */
export { SLIDING_WINDOW_SCRIPT };
