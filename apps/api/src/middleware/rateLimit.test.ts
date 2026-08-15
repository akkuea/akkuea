import { describe, it, expect } from 'bun:test';
import {
  rateLimit,
  createRedisStore,
  createMemoryStore,
  walletKeyGenerator,
  SLIDING_WINDOW_SCRIPT,
} from './rateLimit';
import type { RateLimitRedisClient } from './rateLimit';
import type { Context } from 'elysia';

function createMockRequest(options: { headers?: Record<string, string> } = {}) {
  const headers = new Headers(options.headers ?? {});
  return { headers } as unknown as Request;
}

function createMockSet(): Context['set'] {
  return {
    headers: {},
  };
}

// ---------------------------------------------------------------------------
// Fake Redis: runs the sliding-window script body atomically (sync in script)
// ---------------------------------------------------------------------------

/**
 * Minimal Redis sorted-set simulator that executes the rate-limit Lua script
 * atomically inside `runScript` - concurrent callers serialize through a queue so
 * the counter cannot race the way separate INCR+EXPIRE commands could.
 */
function makeFakeRedisClient(): RateLimitRedisClient & {
  zsets: Map<string, Map<string, number>>;
  scriptCalls: number;
} {
  const zsets = new Map<string, Map<string, number>>();
  let chain: Promise<unknown> = Promise.resolve();
  let scriptCalls = 0;

  function runScriptBody(
    numKeys: number,
    args: (string | number)[],
  ): [number, number, number, number] {
    // Mirror SLIDING_WINDOW_SCRIPT semantics in JS
    const key = String(args[0]);
    const now = Number(args[1]);
    const windowMs = Number(args[2]);
    const max = Number(args[3]);
    const member = String(args[4]);
    const windowStart = now - windowMs;

    let zset = zsets.get(key);
    if (!zset) {
      zset = new Map();
      zsets.set(key, zset);
    }

    // ZREMRANGEBYSCORE key -inf windowStart
    for (const [m, score] of [...zset.entries()]) {
      if (score <= windowStart) zset.delete(m);
    }

    let count = zset.size;

    if (count < max) {
      zset.set(member, now);
      count += 1;
      const remaining = max - count;
      let oldestScore = now;
      for (const score of zset.values()) {
        if (score < oldestScore) oldestScore = score;
      }
      const resetAt = oldestScore + windowMs;
      return [1, remaining, resetAt, 0];
    }

    let oldestScore = now;
    for (const score of zset.values()) {
      if (score < oldestScore) oldestScore = score;
    }
    const resetAt = oldestScore + windowMs;
    const retryAfter = Math.max(0, Math.ceil((resetAt - now) / 1000));
    return [0, 0, resetAt, retryAfter];
  }

  const client: RateLimitRedisClient & {
    zsets: Map<string, Map<string, number>>;
    scriptCalls: number;
  } = {
    zsets,
    get scriptCalls() {
      return scriptCalls;
    },
    async runScript(script: string, numKeys: number, ...args: (string | number)[]) {
      // Serialize script invocations to model Redis single-threaded command execution
      const run = chain.then(() => {
        scriptCalls += 1;
        expect(script).toContain('ZREMRANGEBYSCORE');
        expect(numKeys).toBe(1);
        return runScriptBody(numKeys, args);
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };

  return client;
}

// ---------------------------------------------------------------------------
// createMemoryStore
// ---------------------------------------------------------------------------

describe('createMemoryStore', () => {
  it('allows the first request', async () => {
    const store = createMemoryStore();
    const result = await store.checkLimit('test-id', 60000, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('blocks requests over the limit', async () => {
    const store = createMemoryStore();
    for (let i = 0; i < 3; i++) await store.checkLimit('id', 60000, 3);
    const result = await store.checkLimit('id', 60000, 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('allows a new request once the oldest entry slides out of the window', async () => {
    const store = createMemoryStore();
    await store.checkLimit('id', 50, 1); // 50ms window, max 1
    const blocked = await store.checkLimit('id', 50, 1);
    expect(blocked.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    const result = await store.checkLimit('id', 50, 1);
    expect(result.allowed).toBe(true);
  });

  it('tracks identifiers independently', async () => {
    const store = createMemoryStore();
    await store.checkLimit('a', 60000, 1);
    const resultA = await store.checkLimit('a', 60000, 1);
    const resultB = await store.checkLimit('b', 60000, 1);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('sets resetAt based on the oldest request in the sliding window', async () => {
    const store = createMemoryStore();
    const before = Date.now();
    const result = await store.checkLimit('id', 60000, 10);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
  });

  it('handles concurrent checks without exceeding the limit', async () => {
    const store = createMemoryStore();
    const max = 10;
    const concurrent = 50;
    const results = await Promise.all(
      Array.from({ length: concurrent }, () => store.checkLimit('concurrent', 60000, max)),
    );
    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;
    expect(allowed).toBe(max);
    expect(denied).toBe(concurrent - max);
  });
});

// ---------------------------------------------------------------------------
// createRedisStore (atomic Lua sliding-window)
// ---------------------------------------------------------------------------

describe('createRedisStore', () => {
  it('allows the first request via a single atomic script', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    const result = await store.checkLimit('user:abc', 60000, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(client.scriptCalls).toBe(1);
  });

  it('uses one script call per check (no separate INCR/EXPIRE race)', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    await store.checkLimit('id', 60000, 5);
    await store.checkLimit('id', 60000, 5);
    await store.checkLimit('id', 60000, 5);
    expect(client.scriptCalls).toBe(3);
  });

  it('blocks requests over the limit', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    for (let i = 0; i < 3; i++) await store.checkLimit('id', 60000, 3);
    const result = await store.checkLimit('id', 60000, 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThanOrEqual(0);
  });

  it('sets resetAt from the oldest timestamp in the window', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    const before = Date.now();
    const result = await store.checkLimit('id', 60000, 10);
    expect(result.resetAt).toBeGreaterThanOrEqual(before);
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60000 + 50);
  });

  it('prefixes the key with ratelimit:', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    await store.checkLimit('user:xyz', 60000, 5);
    expect(client.zsets.has('ratelimit:user:xyz')).toBe(true);
  });

  it('concurrency: simultaneous requests do not produce an inconsistent counter', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    const max = 15;
    const concurrent = 100;

    const results = await Promise.all(
      Array.from({ length: concurrent }, (_, i) =>
        store.checkLimit(`burst-key`, 60_000, max).then((r) => ({ i, ...r })),
      ),
    );

    const allowed = results.filter((r) => r.allowed);
    const denied = results.filter((r) => !r.allowed);

    expect(allowed.length).toBe(max);
    expect(denied.length).toBe(concurrent - max);

    // Remaining values for allowed requests must be a permutation of max-1 .. 0
    const remainings = allowed.map((r) => r.remaining).sort((a, b) => a - b);
    expect(remainings).toEqual(Array.from({ length: max }, (_, i) => i));

    // Sorted-set cardinality must equal the number of allowed requests
    const zset = client.zsets.get('ratelimit:burst-key');
    expect(zset?.size).toBe(max);
  });

  it('sliding window: crossing the window boundary does not reset the full budget', async () => {
    // Fixed-window would allow a full new burst at each boundary; sliding window
    // only frees capacity as individual timestamps age out.
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    const windowMs = 200;
    const max = 3;
    const id = 'boundary';

    // Fill the entire budget at the start of the window
    for (let i = 0; i < max; i++) {
      const r = await store.checkLimit(id, windowMs, max);
      expect(r.allowed).toBe(true);
    }
    const blocked = await store.checkLimit(id, windowMs, max);
    expect(blocked.allowed).toBe(false);

    // Wait past half the window - under fixed-window this is still the same
    // bucket (still blocked). Under sliding window we are also still blocked
    // because all timestamps remain inside [now-windowMs, now].
    await new Promise((r) => setTimeout(r, Math.floor(windowMs / 2)));
    const mid = await store.checkLimit(id, windowMs, max);
    expect(mid.allowed).toBe(false);

    // Wait until the first batch is fully outside the sliding window.
    // All three original requests should age out; budget is fully restored.
    await new Promise((r) => setTimeout(r, windowMs));
    const after = await store.checkLimit(id, windowMs, max);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(max - 1);
  });

  it('sliding window: partial capacity frees as oldest entries expire', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    // Wide window + clear gap so timer jitter cannot expire both entries at once.
    const windowMs = 500;
    const gapMs = 200;
    const max = 2;
    const id = 'partial-slide';

    // Request 1
    expect((await store.checkLimit(id, windowMs, max)).allowed).toBe(true);
    // Gap so timestamps are ordered and only the oldest ages out first
    await new Promise((r) => setTimeout(r, gapMs));
    // Request 2 fills the limit
    expect((await store.checkLimit(id, windowMs, max)).allowed).toBe(true);
    expect((await store.checkLimit(id, windowMs, max)).allowed).toBe(false);

    // Wait so req1 (age ≈ gap + wait) exits the window while req2 (age ≈ wait) remains.
    // wait = windowMs - gap/2  →  req1 age = windowMs + gap/2  (out), req2 age = windowMs - gap/2 (in)
    await new Promise((r) => setTimeout(r, windowMs - Math.floor(gapMs / 2)));
    const partial = await store.checkLimit(id, windowMs, max);
    // Exactly one slot should free (the oldest), so one request is allowed
    expect(partial.allowed).toBe(true);
    // Immediately after, we should be at capacity again (req2 + new)
    expect((await store.checkLimit(id, windowMs, max)).allowed).toBe(false);
  });

  it('exports a Lua script that uses sorted-set sliding-window operations', () => {
    expect(SLIDING_WINDOW_SCRIPT).toContain('ZREMRANGEBYSCORE');
    expect(SLIDING_WINDOW_SCRIPT).toContain('ZADD');
    expect(SLIDING_WINDOW_SCRIPT).toContain('ZCARD');
    expect(SLIDING_WINDOW_SCRIPT).toContain('PEXPIRE');
  });
});

// ---------------------------------------------------------------------------
// rateLimit middleware (in-memory mode - no REDIS_URL in tests)
// ---------------------------------------------------------------------------

describe('rateLimit middleware', () => {
  describe('basic rate limiting', () => {
    it('should allow requests under the limit', async () => {
      const middleware = rateLimit({ max: 10, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.2.1' } });
      const set = createMockSet();

      const result = await middleware({ request, set });

      expect(result).toBeUndefined();
      expect(set.status).toBeUndefined();
    });

    it('should block requests over the limit', async () => {
      const middleware = rateLimit({ max: 3, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.2.2' } });
      const set = createMockSet();

      await middleware({ request, set }); // 1st
      await middleware({ request, set }); // 2nd
      await middleware({ request, set }); // 3rd
      const result = await middleware({ request, set }); // 4th - blocked

      expect(result).toEqual({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      });
      expect(set.status).toBe(429);
    });

    it('should set rate limit headers', async () => {
      const middleware = rateLimit({ max: 10, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.3.1' } });
      const set = createMockSet();

      await middleware({ request, set });

      expect(set.headers).toBeDefined();
      expect(set.headers!['X-RateLimit-Limit']).toBe('10');
      expect(set.headers!['X-RateLimit-Remaining']).toBe('9');
      expect(set.headers!['X-RateLimit-Reset']).toBeDefined();
    });
  });

  describe('identifier differentiation', () => {
    it('should track anonymous users by IP', async () => {
      const middleware = rateLimit({ max: 2, windowMs: 60000 });

      const req1 = createMockRequest({ headers: { 'x-forwarded-for': '198.51.100.1' } });
      const req2 = createMockRequest({ headers: { 'x-forwarded-for': '198.51.100.2' } });
      const set1 = createMockSet();
      const set2 = createMockSet();

      await middleware({ request: req1, set: set1 }); // 1st for IP1
      await middleware({ request: req1, set: set1 }); // 2nd for IP1 - blocked
      const result2 = await middleware({ request: req2, set: set2 }); // 1st for IP2

      expect(result2).toBeUndefined();
    });
  });

  describe('Retry-After header', () => {
    it('should set Retry-After header when rate limited', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.5.1' } });
      const set = createMockSet();

      await middleware({ request, set }); // 1st
      await middleware({ request, set }); // 2nd - blocked

      expect(set.headers!['Retry-After']).toBeDefined();
      expect(Number(set.headers!['Retry-After'])).toBeGreaterThan(0);
    });
  });

  describe('custom keyGenerator', () => {
    it('should use custom key generator when provided', async () => {
      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator: (ctx) => `custom:${ctx.request.headers.get('x-api-key') ?? 'unknown'}`,
      });

      const req1 = createMockRequest({
        headers: { 'x-api-key': 'key1', 'x-forwarded-for': '192.0.2.1' },
      });
      const req2 = createMockRequest({
        headers: { 'x-api-key': 'key2', 'x-forwarded-for': '192.0.2.1' },
      });
      const set1 = createMockSet();
      const set2 = createMockSet();

      await middleware({ request: req1, set: set1 }); // 1st with key1
      const result2 = await middleware({ request: req2, set: set2 }); // 1st with key2

      expect(result2).toBeUndefined();
    });
  });

  describe('default values', () => {
    it('should use default max of 10 and window of 60000ms', async () => {
      const middleware = rateLimit();
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.7.1' } });
      const set = createMockSet();

      await middleware({ request, set });

      expect(set.headers!['X-RateLimit-Limit']).toBe('10');
      expect(set.headers!['X-RateLimit-Remaining']).toBe('9');
    });
  });

  describe('walletKeyGenerator', () => {
    function createAuthContext(
      walletAddress?: string,
      forwardIp?: string,
    ): Pick<Context, 'request' | 'set'> & {
      getAuthenticatedUser: () => Promise<{ id: string; walletAddress: string }>;
    } {
      const headers: Record<string, string> = {};
      if (forwardIp) headers['x-forwarded-for'] = forwardIp;
      return {
        request: createMockRequest({ headers }) as unknown as Request,
        set: createMockSet(),
        getAuthenticatedUser: walletAddress
          ? async () => ({ id: 'user-1', walletAddress })
          : async () => {
              throw new Error('UNAUTHORIZED');
            },
      };
    }

    it('should extract wallet address from verified auth context', async () => {
      const ctx = createAuthContext('GA7EXAMPLEADDRESS');
      expect(await walletKeyGenerator(ctx)).toBe('wallet:GA7EXAMPLEADDRESS');
    });

    it('should fall back to IP when getAuthenticatedUser throws', async () => {
      const ctx = createAuthContext(undefined, '10.0.0.2');
      expect(await walletKeyGenerator(ctx)).toBe('ip:10.0.0.2');
    });

    it('should fall back to IP when getAuthenticatedUser is missing from context', async () => {
      const ctx = {
        request: createMockRequest({
          headers: { 'x-forwarded-for': '10.0.0.3' },
        }) as unknown as Request,
        set: createMockSet(),
      };
      expect(await walletKeyGenerator(ctx)).toBe('ip:10.0.0.3');
    });

    it('should fall back to IP when walletAddress is empty', async () => {
      const ctx = {
        request: createMockRequest({
          headers: { 'x-forwarded-for': '10.0.0.4' },
        }) as unknown as Request,
        set: createMockSet(),
        getAuthenticatedUser: async () => ({ id: 'user-1', walletAddress: '' }),
      };
      expect(await walletKeyGenerator(ctx)).toBe('ip:10.0.0.4');
    });

    it('should rate-limit by wallet across different IPs', async () => {
      const middleware = rateLimit({ max: 2, windowMs: 60000, keyGenerator: walletKeyGenerator });

      const ctx1 = createAuthContext('GA7SAMEWALLET', '192.168.1.1');
      const ctx2 = createAuthContext('GA7SAMEWALLET', '192.168.2.2');

      await middleware(ctx1); // 1st - allowed
      const result2 = await middleware(ctx2); // 2nd - allowed
      const result3 = await middleware(createAuthContext('GA7SAMEWALLET', '192.168.1.1')); // 3rd - blocked

      expect(result2).toBeUndefined();
      expect(result3).toEqual({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      });
    });

    it('should track different wallets independently', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000, keyGenerator: walletKeyGenerator });

      const ctx1 = createAuthContext('GA7WALLETONE');
      const ctx2 = createAuthContext('GA7WALLETTWO');

      await middleware(ctx1); // wallet1 hits limit
      const result2 = await middleware(ctx2); // wallet2 still allowed

      expect(result2).toBeUndefined();
    });
  });
});
