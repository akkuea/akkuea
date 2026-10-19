import type { Context } from 'elysia';
import { trustedProxyHopsSchema } from '@akkuea/shared';

/**
 * The subset of a Bun server the limiter reads.
 *
 * `requestIP` is the only peer address a client cannot forge, which is why it is
 * the default source of identity.
 */
export interface RateLimitServer {
  requestIP(request: Request): { address: string } | null | undefined;
}

/**
 * Context slice a rate limiter reads.
 *
 * `server` is populated by the Elysia/Bun adapter and is `null` for requests that
 * never arrived over a socket (for example `app.handle(request)` in tests).
 */
export type RateLimitContext = Pick<Context, 'request' | 'set'> & {
  server?: RateLimitServer | null;
};

/**
 * Resolve the address a request is attributed to, or `null` when the request
 * cannot be attributed to a network peer.
 */
export type ClientAddressResolver = (context: RateLimitContext) => string | null;

/**
 * Derive the bucket key for a request.
 *
 * The already resolved client address is passed in so a generator never has to
 * re-implement the trust model (or accidentally trust a header of its own).
 * Returning `null` or an empty string falls back to the address-based key.
 */
export type RateLimitKeyGenerator = (
  context: RateLimitContext,
  clientAddress: string | null,
) => Promise<string | null | undefined> | string | null | undefined;

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: RateLimitKeyGenerator;
}

export interface RateLimiterOptions extends RateLimitOptions {
  /**
   * Counter store. A promise is accepted so the router-facing limiter can defer
   * Redis connection setup instead of blocking module load.
   */
  store: RateLimitStore | Promise<RateLimitStore>;
  /** Address resolver. Defaults to the trust model documented on {@link resolveClientAddress}. */
  clientAddressResolver?: ClientAddressResolver;
  /** Number of trusted reverse proxies in front of the API. Defaults to `0`. */
  trustedProxyHops?: number;
}

export interface RateLimitResult {
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

/** Body returned to the client when a request is over the limit. */
export interface RateLimitRejection {
  success: false;
  error: 'RATE_LIMITED';
  message: string;
}

export type RateLimitMiddleware = (
  context: RateLimitContext,
) => Promise<RateLimitRejection | undefined>;

const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX = 10;

/** Longest textual IPv6 address (IPv4-mapped form included). */
const MAX_ADDRESS_LENGTH = 45;

const DEFAULT_MEMORY_STORE_MAX_IDENTIFIERS = 10000;
const DEFAULT_MEMORY_STORE_SWEEP_INTERVAL_MS = 60000;

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

// ---------------------------------------------------------------------------
// Client address resolution
// ---------------------------------------------------------------------------

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_CHARACTERS = /^[0-9a-f:.]+$/;

function normalizeIpv4(value: string): string | null {
  const match = IPV4_PATTERN.exec(value);
  if (!match) return null;

  const octets = match.slice(1).map((octet) => Number(octet));
  if (octets.some((octet) => octet > 255)) return null;

  // Leading zeros are not significant, so `010.0.0.1` and `10.0.0.1` must not
  // become two identities for one peer.
  return octets.join('.');
}

function normalizeIpv6(value: string): string | null {
  const candidate = value.toLowerCase();
  if (!candidate.includes(':') || !IPV6_CHARACTERS.test(candidate)) return null;
  // Two or more colons is the shortest honest shape (`::1`) of an IPv6 address.
  if (candidate.split(':').length - 1 < 2) return null;
  return candidate;
}

/**
 * Normalize an address so the same peer cannot present several identities.
 *
 * Handles the optional port a proxy may append, the bracketed IPv6 form, and the
 * IPv4-mapped IPv6 form of an IPv4 peer. Anything that is not an IP address, or
 * that carries whitespace or is oversized, resolves to `null` and sends
 * resolution to the next source, so a client cannot create a bucket (or a new
 * one per request) out of text of its own choosing.
 */
export function normalizeClientAddress(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  let value = raw.trim();
  if (value === '' || value.length > MAX_ADDRESS_LENGTH || /\s/.test(value)) return null;

  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(value);

  if (bracketed?.[1]) value = bracketed[1];
  else if (ipv4WithPort?.[1]) value = ipv4WithPort[1];

  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mappedIpv4?.[1]) return normalizeIpv4(mappedIpv4[1]);

  return normalizeIpv4(value) ?? normalizeIpv6(value);
}

/**
 * Resolve the client address for a request.
 *
 * Trust model:
 *
 * 1. `x-forwarded-for` is read only when `trustedProxyHops` is greater than zero,
 *    and only the entry that many trusted proxies from the right is used. Every
 *    entry further left is client-supplied and therefore ignored. A chain shorter
 *    than the configured hop count is not trusted either.
 * 2. Otherwise, and as the final fallback, the peer address comes from the socket
 *    (`server.requestIP`), which a client cannot forge.
 *
 * `x-real-ip` is deliberately not trusted at all: it carries no hop information,
 * so it cannot be validated against the configured proxy count.
 *
 * Returns `null` when no address can be determined, and the caller must then
 * decline to share a bucket between unrelated clients.
 */
export function resolveClientAddress(
  context: RateLimitContext,
  trustedProxyHops: number,
): string | null {
  if (trustedProxyHops > 0) {
    const forwarded = context.request.headers.get('x-forwarded-for');
    if (forwarded !== null && forwarded !== '') {
      const chain = forwarded
        .split(',')
        .map((entry) => normalizeClientAddress(entry))
        .filter((entry): entry is string => entry !== null);

      const address = chain[chain.length - trustedProxyHops];
      if (address) return address;
    }
  }

  return normalizeClientAddress(readSocketAddress(context));
}

function readSocketAddress(context: RateLimitContext): string | null {
  try {
    return context.server?.requestIP(context.request)?.address ?? null;
  } catch {
    // Bun throws when a request did not arrive over a socket (in-process
    // `app.handle()`); there is no peer to identify in that case.
    return null;
  }
}

/**
 * Read the configured proxy trust level.
 *
 * The value is validated at startup by `validateApiEnv`; it is re-validated here
 * so a bad value can never be coerced into a different number of trusted hops by
 * the limiter's own parsing.
 */
function readTrustedProxyHops(): number {
  const parsed = trustedProxyHopsSchema.safeParse(process.env.TRUSTED_PROXY_HOPS);
  if (!parsed.success) {
    throw new Error(
      `Invalid TRUSTED_PROXY_HOPS: ${
        parsed.error.errors[0]?.message ?? 'expected a non-negative integer'
      }`,
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

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

/** A tracked identifier and the moment it stops mattering. */
interface MemoryEntry {
  timestamps: number[];
  /** `newest timestamp + windowMs`: when every timestamp is outside the window. */
  expiresAt: number;
}

/**
 * In-process store, with the observable state tests need to assert that it stays
 * bounded.
 */
export interface MemoryRateLimitStore extends RateLimitStore {
  /** Identifiers currently tracked. */
  size(): number;
  /** Identifiers with a check in flight. */
  pendingChecks(): number;
  /** Drop every tracked identifier and lock. Does not cancel in-flight checks. */
  clear(): void;
  /** Run one expiry sweep immediately instead of waiting for the timer. */
  sweep(): void;
  /** Stop the periodic sweep. */
  stop(): void;
}

export interface MemoryStoreOptions {
  /**
   * Hard cap on tracked identifiers. Reaching it evicts the entries nearest
   * expiry, see {@link MemoryRateLimitStore}.
   */
  maxIdentifiers?: number;
  /** Periodic sweep interval in ms. `0` disables the timer. */
  sweepIntervalMs?: number;
  /** Clock, injectable for deterministic tests. */
  now?: () => number;
}

/**
 * In-process sliding-window log (same algorithm as Redis; not multi-instance safe).
 *
 * Bounded by construction:
 *
 * - expired identifiers are dropped whenever they are touched and by a periodic
 *   sweep, so an idle process holds nothing;
 * - the lock map only ever holds identifiers with work in flight and is cleared
 *   as soon as the last queued check finishes;
 * - a hard cap on tracked identifiers keeps a client that rotates its identity
 *   from growing the map without limit.
 */
export function createMemoryStore(options: MemoryStoreOptions = {}): MemoryRateLimitStore {
  const {
    maxIdentifiers = DEFAULT_MEMORY_STORE_MAX_IDENTIFIERS,
    sweepIntervalMs = DEFAULT_MEMORY_STORE_SWEEP_INTERVAL_MS,
    now = Date.now,
  } = options;

  const entries = new Map<string, MemoryEntry>();
  /** Per-identifier chain so overlapping async checks stay consistent. */
  const locks = new Map<string, Promise<void>>();

  function dropExpired(nowMs: number): void {
    for (const [identifier, entry] of entries) {
      if (entry.expiresAt <= nowMs) entries.delete(identifier);
    }
  }

  function storeEntry(identifier: string, timestamps: number[], windowMs: number): void {
    const newest = timestamps[timestamps.length - 1];
    entries.set(identifier, {
      timestamps,
      expiresAt: (newest ?? now()) + windowMs,
    });
  }

  function evictForCapacity(nowMs: number): void {
    if (entries.size < maxIdentifiers) return;

    dropExpired(nowMs);
    if (entries.size < maxIdentifiers) return;

    // Free a whole batch in one pass so the sort below is amortized over the
    // inserts that follow it. The entries nearest expiry go first: their
    // counters were about to reset anyway, so a client cannot use the cap to
    // force a fresh budget for a counter that is still hot.
    const keep = Math.max(1, Math.floor(maxIdentifiers * 0.9));
    const byExpiry = [...entries.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    for (const [identifier] of byExpiry.slice(0, byExpiry.length - keep + 1)) {
      entries.delete(identifier);
    }
  }

  async function withLock<T>(identifier: string, fn: () => T | Promise<T>): Promise<T> {
    const previous = locks.get(identifier) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(
      () => gate,
      () => gate,
    );
    locks.set(identifier, current);

    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      // Only the last waiter clears the entry: a check queued behind this one has
      // already replaced it with a longer chain.
      if (locks.get(identifier) === current) locks.delete(identifier);
    }
  }

  const store: MemoryRateLimitStore = {
    async checkLimit(identifier: string, windowMs: number, max: number): Promise<RateLimitResult> {
      return withLock(identifier, () => {
        const nowMs = now();
        const windowStart = nowMs - windowMs;
        const timestamps = (entries.get(identifier)?.timestamps ?? []).filter(
          (timestamp) => timestamp > windowStart,
        );

        // Nothing in the window: the identifier is idle, so it stops costing anything.
        if (timestamps.length === 0) entries.delete(identifier);

        if (timestamps.length >= max) {
          storeEntry(identifier, timestamps, windowMs);
          const resetAt = (timestamps[0] ?? nowMs) + windowMs;
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            retryAfter: Math.max(0, Math.ceil((resetAt - nowMs) / 1000)),
          };
        }

        // Only an unseen identifier can grow the map, so only it can need room.
        if (timestamps.length === 0) evictForCapacity(nowMs);

        const recorded = [...timestamps, nowMs];
        storeEntry(identifier, recorded, windowMs);

        return {
          allowed: true,
          remaining: max - recorded.length,
          resetAt: (recorded[0] ?? nowMs) + windowMs,
        };
      });
    },

    size(): number {
      return entries.size;
    },

    pendingChecks(): number {
      return locks.size;
    },

    clear(): void {
      entries.clear();
      locks.clear();
    },

    sweep(): void {
      dropExpired(now());
    },

    stop(): void {
      if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = undefined;
      }
    },
  };

  let sweepTimer: ReturnType<typeof setInterval> | undefined;
  if (sweepIntervalMs > 0) {
    sweepTimer = setInterval(() => store.sweep(), sweepIntervalMs);
    // Pruning bookkeeping is never a reason to keep the process alive.
    if (typeof sweepTimer.unref === 'function') sweepTimer.unref();
  }

  return store;
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

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Build a limiter from injected dependencies only: no environment reads and no
 * module-level state. Unit tests construct limiters with a store (and, when they
 * need one, an address) they control.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimitMiddleware {
  const {
    store,
    windowMs = DEFAULT_WINDOW_MS,
    max = DEFAULT_MAX,
    keyGenerator,
    trustedProxyHops = 0,
    clientAddressResolver = (context) => resolveClientAddress(context, trustedProxyHops),
  } = options;

  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error(
      `trustedProxyHops must be a non-negative integer, received ${String(trustedProxyHops)}`,
    );
  }

  return async function rateLimitMiddleware(context) {
    const clientAddress = clientAddressResolver(context);

    const generated = keyGenerator ? await keyGenerator(context, clientAddress) : null;
    const identifier = generated || (clientAddress !== null ? `ip:${clientAddress}` : null);

    // No client to attribute the request to. Sharing one bucket between unrelated
    // clients would throttle innocent callers and would not isolate an abuser, so
    // the request is not counted instead. In a served deployment the socket
    // address always resolves, so this path is only reachable for in-process
    // callers such as `app.handle()`.
    if (identifier === null) {
      warnMissingClientAddressOnce();
      return;
    }

    const resolvedStore = await store;
    const result = await resolvedStore.checkLimit(identifier, windowMs, max);

    if (!context.set.headers) {
      context.set.headers = {};
    }
    context.set.headers['X-RateLimit-Limit'] = String(max);
    context.set.headers['X-RateLimit-Remaining'] = String(result.remaining);
    context.set.headers['X-RateLimit-Reset'] = String(Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      context.set.status = 429;
      if (result.retryAfter !== undefined) {
        context.set.headers['Retry-After'] = String(result.retryAfter);
      }
      return {
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      };
    }
  };
}

let warnedMissingClientAddress = false;

function warnMissingClientAddressOnce(): void {
  if (warnedMissingClientAddress) return;
  warnedMissingClientAddress = true;
  console.warn(
    '[rateLimit] no client address available for this request (no socket address and no trusted proxy); the request was not counted',
  );
}

/**
 * Shared store for every router that calls {@link rateLimit}.
 *
 * One store per process keeps the memory backend consistent with Redis, where all
 * routers already share `ratelimit:<identifier>` keys.
 */
let sharedStore: Promise<RateLimitStore> | undefined;

function getSharedStore(): Promise<RateLimitStore> {
  sharedStore ??= createSharedStore();
  return sharedStore;
}

async function createSharedStore(): Promise<RateLimitStore> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(
      '[rateLimit] REDIS_URL not set - using in-memory rate limiting (not safe for multi-instance deployments)',
    );
    return createMemoryStore();
  }

  const { default: Redis } = await import('ioredis');
  const client = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
  });
  return createRedisStore(wrapIoredisClient(client));
}

/**
 * Rate limit middleware for a router.
 *
 * Identity comes from the socket address by default, or from `x-forwarded-for`
 * when `TRUSTED_PROXY_HOPS` says proxies are in front of the API. No request
 * header can skip the limit: the removed `x-test-bypass-ratelimit` header has no
 * effect anywhere.
 */
export function rateLimit(options: RateLimitOptions = {}): RateLimitMiddleware {
  const trustedProxyHops = readTrustedProxyHops();

  return createRateLimiter({
    ...options,
    trustedProxyHops,
    store: getSharedStore(),
    // Read per request so a suite can install its resolver before driving routes.
    clientAddressResolver: (context) =>
      clientAddressResolverOverride?.(context) ?? resolveClientAddress(context, trustedProxyHops),
  });
}

/**
 * Key a request by the authenticated wallet, falling back to its client address.
 *
 * `walletKeyGenerator` is used as a `keyGenerator`, so the limiter has already
 * resolved `clientAddress` with the same trust model the limiter itself uses.
 */
export async function walletKeyGenerator(
  context: RateLimitContext,
  clientAddress: string | null,
): Promise<string | null> {
  const getAuthenticatedUser = (context as Record<string, unknown>)['getAuthenticatedUser'] as
    (() => Promise<{ id: string; walletAddress: string }>) | undefined;

  if (typeof getAuthenticatedUser === 'function') {
    try {
      const user = await getAuthenticatedUser();
      if (user.walletAddress) {
        return `wallet:${user.walletAddress}`;
      }
    } catch {
      // Auth not available or token invalid – fall through to the client address
    }
  }

  return clientAddress !== null ? `ip:${clientAddress}` : null;
}

// ---------------------------------------------------------------------------
// Test support
// ---------------------------------------------------------------------------

let clientAddressResolverOverride: ClientAddressResolver | null = null;

/**
 * Install the client address resolver used by the router-facing limiter.
 *
 * Route-level suites drive handlers through `app.handle()`, which gives Bun no
 * socket to read a peer address from, so a test that wants a resolvable client
 * has to supply one. This is the supported replacement for the removed
 * `x-test-bypass-ratelimit` header, and it only exists under the test runner: a
 * deployment resolving `NODE_ENV` to anything but `test` cannot reach it, so no
 * configuration can turn the limiter off.
 */
export function setClientAddressResolverForTesting(resolver: ClientAddressResolver | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'setClientAddressResolverForTesting is only available when NODE_ENV is "test"; production resolves client addresses from the socket',
    );
  }
  clientAddressResolverOverride = resolver;
}

/** Exported for unit tests that need to exercise the Lua script via a fake client. */
export { SLIDING_WINDOW_SCRIPT };
