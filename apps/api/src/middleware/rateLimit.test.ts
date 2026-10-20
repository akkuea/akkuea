import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import {
  createRateLimiter,
  createRedisStore,
  createMemoryStore,
  normalizeClientAddress,
  resolveClientAddress,
  rateLimit,
  setClientAddressResolverForTesting,
  walletKeyGenerator,
  SLIDING_WINDOW_SCRIPT,
} from './rateLimit';
import type {
  RateLimitContext,
  RateLimitKeyGenerator,
  RateLimitRedisClient,
  RateLimitStore,
} from './rateLimit';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/test', { headers });
}

/**
 * A request context.
 *
 * `address` models the peer address Bun exposes through `server.requestIP`:
 * `undefined` means the request never reached a socket (an in-process
 * `app.handle()`), which is what the limiter has to cope with in route suites.
 */
function createContext(
  options: {
    headers?: Record<string, string>;
    address?: string | null;
  } = {},
): RateLimitContext & { server: { requestIP: (request: Request) => { address: string } | null } } {
  return {
    request: createMockRequest(options.headers),
    set: { headers: {} },
    server: {
      requestIP: () =>
        options.address === undefined || options.address === null
          ? null
          : { address: options.address },
    },
  };
}

/** Context for a request without any socket, like Elysia's `app.handle()`. */
function createOfflineContext(headers: Record<string, string> = {}): RateLimitContext {
  return { request: createMockRequest(headers), set: { headers: {} } };
}

/** Store that records the identifiers the limiter asked about, and limits for real. */
function createRecordingStore(): RateLimitStore & { identifiers: string[] } {
  const inner = createMemoryStore();
  const identifiers: string[] = [];

  return {
    identifiers,
    async checkLimit(identifier, windowMs, max) {
      identifiers.push(identifier);
      return inner.checkLimit(identifier, windowMs, max);
    },
  };
}

function rejection() {
  return {
    success: false as const,
    error: 'RATE_LIMITED' as const,
    message: 'Too many requests. Please try again later.',
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
// normalizeClientAddress
// ---------------------------------------------------------------------------

describe('normalizeClientAddress', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeClientAddress('  203.0.113.7  ')).toBe('203.0.113.7');
  });

  it('drops the port a proxy may append', () => {
    expect(normalizeClientAddress('203.0.113.7:51234')).toBe('203.0.113.7');
  });

  it('unwraps the bracketed IPv6 form', () => {
    expect(normalizeClientAddress('[2001:db8::1]')).toBe('2001:db8::1');
    expect(normalizeClientAddress('[2001:db8::1]:443')).toBe('2001:db8::1');
  });

  it('keeps an unbracketed IPv6 address intact', () => {
    expect(normalizeClientAddress('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('folds an IPv4-mapped IPv6 address onto its IPv4 form', () => {
    expect(normalizeClientAddress('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('folds leading zeros onto one identity', () => {
    expect(normalizeClientAddress('010.0.0.1')).toBe('10.0.0.1');
  });

  it('rejects values that are not IP addresses', () => {
    expect(normalizeClientAddress(null)).toBeNull();
    expect(normalizeClientAddress(undefined)).toBeNull();
    expect(normalizeClientAddress('')).toBeNull();
    expect(normalizeClientAddress('   ')).toBeNull();
    expect(normalizeClientAddress('not an address')).toBeNull();
    expect(normalizeClientAddress('attacker.example.com')).toBeNull();
    expect(normalizeClientAddress('999.1.1.1')).toBeNull();
    expect(normalizeClientAddress('1.2.3.4.5')).toBeNull();
    expect(normalizeClientAddress('a'.repeat(46))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveClientAddress
// ---------------------------------------------------------------------------

describe('resolveClientAddress', () => {
  it('uses the socket address and ignores a client-supplied x-forwarded-for', () => {
    const context = createContext({
      address: '203.0.113.7',
      headers: { 'x-forwarded-for': '198.51.100.9' },
    });

    expect(resolveClientAddress(context, 0)).toBe('203.0.113.7');
  });

  it('never trusts x-real-ip, which carries no hop information', () => {
    const context = createContext({
      address: '203.0.113.7',
      headers: { 'x-real-ip': '198.51.100.9' },
    });

    expect(resolveClientAddress(context, 0)).toBe('203.0.113.7');
    expect(resolveClientAddress(context, 1)).toBe('203.0.113.7');
  });

  it('uses the entry the single trusted proxy appended', () => {
    const context = createContext({
      address: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });

    expect(resolveClientAddress(context, 1)).toBe('10.0.0.1');
  });

  it('uses the entry the second trusted proxy appended when two are configured', () => {
    const context = createContext({
      address: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.9, 10.0.0.1' },
    });

    expect(resolveClientAddress(context, 2)).toBe('198.51.100.9');
  });

  it('ignores a chain that is shorter than the configured hop count', () => {
    const context = createContext({
      address: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });

    expect(resolveClientAddress(context, 2)).toBe('10.0.0.1');
  });

  it('ignores unusable chain entries instead of building a bucket from them', () => {
    const context = createContext({
      address: '10.0.0.1',
      headers: { 'x-forwarded-for': 'not an address, 203.0.113.7' },
    });

    expect(resolveClientAddress(context, 1)).toBe('203.0.113.7');
  });

  it('normalizes the selected chain entry', () => {
    const context = createContext({
      address: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7:51234, 10.0.0.1:51235' },
    });

    expect(resolveClientAddress(context, 1)).toBe('10.0.0.1');
  });

  it('returns null for a request that never reached a socket', () => {
    expect(resolveClientAddress(createOfflineContext(), 0)).toBeNull();
    expect(
      resolveClientAddress(createOfflineContext({ 'x-forwarded-for': '203.0.113.7' }), 0),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createMemoryStore
// ---------------------------------------------------------------------------

describe('createMemoryStore', () => {
  it('allows the first request', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    const result = await store.checkLimit('test-id', 60000, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('blocks requests over the limit', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    for (let i = 0; i < 3; i++) await store.checkLimit('id', 60000, 3);
    const result = await store.checkLimit('id', 60000, 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('allows a new request once the oldest entry slides out of the window', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    await store.checkLimit('id', 50, 1); // 50ms window, max 1
    const blocked = await store.checkLimit('id', 50, 1);
    expect(blocked.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    const result = await store.checkLimit('id', 50, 1);
    expect(result.allowed).toBe(true);
  });

  it('tracks identifiers independently', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    await store.checkLimit('a', 60000, 1);
    const resultA = await store.checkLimit('a', 60000, 1);
    const resultB = await store.checkLimit('b', 60000, 1);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it('sets resetAt based on the oldest request in the sliding window', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    const before = Date.now();
    const result = await store.checkLimit('id', 60000, 10);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
  });

  it('handles concurrent checks without exceeding the limit', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
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

  it('returns its tracked identifiers to zero once the window passes', async () => {
    let clock = 1_000_000;
    const store = createMemoryStore({ sweepIntervalMs: 0, now: () => clock });

    await store.checkLimit('id', 60_000, 10);
    await store.checkLimit('other', 60_000, 10);
    expect(store.size()).toBe(2);

    clock += 59_999; // Still inside both windows: the entries are live.
    store.sweep();
    expect(store.size()).toBe(2);

    clock += 1; // Both entries are now fully outside their windows.
    store.sweep();
    expect(store.size()).toBe(0);
  });

  it('restarts an idle identifier on access instead of accumulating entries for it', async () => {
    let clock = 1_000_000;
    const store = createMemoryStore({ sweepIntervalMs: 0, now: () => clock });

    const first = await store.checkLimit('repeat', 1_000, 10);
    expect(first.remaining).toBe(9);
    expect(store.size()).toBe(1);

    for (let i = 0; i < 3; i++) {
      clock += 5_000; // Well past the window: the identifier is idle, not blocked.
      const next = await store.checkLimit('repeat', 1_000, 10);
      expect(next.allowed).toBe(true);
      expect(next.remaining).toBe(9);
    }

    // One entry for one identifier, however many windows have passed.
    expect(store.size()).toBe(1);
  });

  it('sweeps expired identifiers on a timer without any request arriving', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 5, now: () => Date.now() });
    await store.checkLimit('idle', 10, 10);
    expect(store.size()).toBe(1);

    await new Promise((r) => setTimeout(r, 25));
    expect(store.size()).toBe(0);

    store.stop();
  });

  it('clears the lock map once a check settles', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });

    const pending = store.checkLimit('id', 60_000, 10);
    // The lock is taken synchronously, before the check resolves.
    expect(store.pendingChecks()).toBe(1);

    await pending;
    expect(store.pendingChecks()).toBe(0);
  });

  it('does not leak lock entries across concurrent checks', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => store.checkLimit(`burst-${i}`, 60_000, 10)),
    );
    expect(store.pendingChecks()).toBe(0);
  });

  it('enforces the identifier cap', async () => {
    const maxIdentifiers = 5;
    const store = createMemoryStore({
      maxIdentifiers,
      sweepIntervalMs: 0,
      now: () => 1_000_000,
    });

    for (let i = 0; i < 50; i++) {
      await store.checkLimit(`rotating-${i}`, 60_000, 10);
    }

    expect(store.size()).toBeLessThanOrEqual(maxIdentifiers);
  });

  it('evicts the identifiers nearest expiry first when the cap is reached', async () => {
    let clock = 1_000_000;
    const store = createMemoryStore({ maxIdentifiers: 4, sweepIntervalMs: 0, now: () => clock });
    const max = 5;
    const windowMs = 60_000;

    await store.checkLimit('oldest', windowMs, max);
    clock += 100;
    await store.checkLimit('older', windowMs, max);
    clock += 100;
    await store.checkLimit('recent', windowMs, max);
    clock += 100;
    await store.checkLimit('newest', windowMs, max);
    expect(store.size()).toBe(4);

    // The cap is reached, so admitting one more identifier has to free room.
    clock += 100;
    await store.checkLimit('incoming', windowMs, max);

    expect(store.size()).toBeLessThanOrEqual(4);

    // The two entries closest to expiry were dropped, and a check against them
    // starts from a full budget again.
    const dropped = await store.checkLimit('oldest', windowMs, max);
    expect(dropped.allowed).toBe(true);
    expect(dropped.remaining).toBe(max - 1);

    // The newest entry kept its counter: one request is already recorded for it.
    const kept = await store.checkLimit('newest', windowMs, max);
    expect(kept.remaining).toBe(max - 2);
  });

  it('clear() drops every tracked identifier', async () => {
    const store = createMemoryStore({ sweepIntervalMs: 0 });
    await store.checkLimit('a', 60_000, 10);
    await store.checkLimit('b', 60_000, 10);
    expect(store.size()).toBe(2);

    store.clear();
    expect(store.size()).toBe(0);
    expect(store.pendingChecks()).toBe(0);
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
// createRateLimiter
// ---------------------------------------------------------------------------

describe('createRateLimiter', () => {
  describe('basic rate limiting', () => {
    it('allows requests under the limit', async () => {
      const middleware = createRateLimiter({
        max: 10,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });
      const context = createContext({ address: '192.0.2.1' });

      expect(await middleware(context)).toBeUndefined();
      expect(context.set.status).toBeUndefined();
    });

    it('blocks requests over the limit', async () => {
      const middleware = createRateLimiter({
        max: 3,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });
      const context = createContext({ address: '192.0.2.2' });

      expect(await middleware(context)).toBeUndefined(); // 1st
      expect(await middleware(context)).toBeUndefined(); // 2nd
      expect(await middleware(context)).toBeUndefined(); // 3rd

      expect(await middleware(context)).toEqual(rejection()); // 4th - blocked
      expect(context.set.status).toBe(429);
    });

    it('sets rate limit headers', async () => {
      const middleware = createRateLimiter({
        max: 10,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });
      const context = createContext({ address: '192.0.3.1' });

      await middleware(context);

      expect(context.set.headers).toBeDefined();
      expect(context.set.headers['X-RateLimit-Limit']).toBe('10');
      expect(context.set.headers['X-RateLimit-Remaining']).toBe('9');
      expect(context.set.headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('sets Retry-After when rate limited', async () => {
      const middleware = createRateLimiter({
        max: 1,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });
      const context = createContext({ address: '192.0.5.1' });

      await middleware(context); // 1st
      await middleware(context); // 2nd - blocked

      expect(context.set.headers['Retry-After']).toBeDefined();
      expect(Number(context.set.headers['Retry-After'])).toBeGreaterThan(0);
    });

    it('uses 10 requests per 60s by default', async () => {
      const middleware = createRateLimiter({
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });
      const context = createContext({ address: '192.0.7.1' });

      await middleware(context);

      expect(context.set.headers['X-RateLimit-Limit']).toBe('10');
      expect(context.set.headers['X-RateLimit-Remaining']).toBe('9');
    });

    it('rejects an invalid trusted proxy hop count', () => {
      expect(() =>
        createRateLimiter({
          store: createMemoryStore({ sweepIntervalMs: 0 }),
          trustedProxyHops: -1,
        }),
      ).toThrow(/trustedProxyHops/);
      expect(() =>
        createRateLimiter({
          store: createMemoryStore({ sweepIntervalMs: 0 }),
          trustedProxyHops: 1.5,
        }),
      ).toThrow(/trustedProxyHops/);
    });
  });

  describe('client identity', () => {
    it('keys by the socket address', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({ max: 2, windowMs: 60000, store });

      await middleware(createContext({ address: '198.51.100.1' }));

      expect(store.identifiers).toEqual(['ip:198.51.100.1']);
    });

    it('does not let a request header disable limiting', async () => {
      const middleware = createRateLimiter({
        max: 2,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });

      // The removed bypass header is just a header now: every request below
      // carries it and the third is still blocked.
      for (let i = 0; i < 2; i++) {
        const context = createContext({
          address: '192.0.2.30',
          headers: { 'x-test-bypass-ratelimit': 'true' },
        });
        expect(await middleware(context)).toBeUndefined();
      }

      const blocked = createContext({
        address: '192.0.2.30',
        headers: { 'x-test-bypass-ratelimit': 'true' },
      });
      expect(await middleware(blocked)).toEqual(rejection());
      expect(blocked.set.status).toBe(429);
    });

    it('ignores x-forwarded-for while no proxy is trusted', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({ max: 3, windowMs: 60000, store });

      for (let i = 0; i < 4; i++) {
        const context = createContext({
          address: '192.0.2.40',
          headers: { 'x-forwarded-for': `203.0.113.${i + 1}` },
        });
        const result = await middleware(context);
        // Every request is the same peer, so the fourth is blocked no matter
        // which address the client claims.
        expect(result === undefined).toBe(i < 3);
      }

      expect(new Set(store.identifiers)).toEqual(new Set(['ip:192.0.2.40']));
    });

    it('uses the configured trusted proxy hop when proxies are trusted', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({
        max: 10,
        windowMs: 60000,
        store,
        trustedProxyHops: 1,
      });

      await middleware(
        createContext({
          address: '10.0.0.1',
          headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
        }),
      );

      expect(store.identifiers).toEqual(['ip:10.0.0.1']);
    });

    it('reads the entry at the configured hop count, not the leftmost one', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({
        max: 10,
        windowMs: 60000,
        store,
        trustedProxyHops: 2,
      });

      // Only the entry two hops from the right (the one the last trusted proxy
      // appended) is authoritative; the rest is client-supplied.
      await middleware(
        createContext({
          address: '10.0.0.1',
          headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.9, 10.0.0.1' },
        }),
      );

      expect(store.identifiers).toEqual(['ip:198.51.100.9']);
    });

    it('tracks separate peers independently', async () => {
      const middleware = createRateLimiter({
        max: 1,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
      });

      await middleware(createContext({ address: '198.51.100.1' })); // 1st for peer 1 - blocked next
      expect(await middleware(createContext({ address: '198.51.100.1' }))).toEqual(rejection());
      expect(await middleware(createContext({ address: '198.51.100.2' }))).toBeUndefined();
    });

    it('never shares one bucket between requests it cannot attribute', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({ max: 1, windowMs: 60000, store });

      // Two unrelated in-process requests, no socket and no trusted proxy.
      const first = createOfflineContext();
      const second = createOfflineContext();

      expect(await middleware(first)).toBeUndefined();
      expect(await middleware(second)).toBeUndefined();

      // No identifier was invented: the limiter declined to count them rather
      // than throttling unrelated clients through a shared bucket.
      expect(store.identifiers).toEqual([]);
      expect(first.set.headers['X-RateLimit-Limit']).toBeUndefined();
    });

    it('falls back to the socket address for an unusable proxy chain', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({
        max: 10,
        windowMs: 60000,
        store,
        trustedProxyHops: 1,
      });

      await middleware(
        createContext({ address: '10.0.0.1', headers: { 'x-forwarded-for': 'garbage' } }),
      );

      expect(store.identifiers).toEqual(['ip:10.0.0.1']);
    });
  });

  describe('custom keyGenerator', () => {
    it('receives the resolved client address and overrides the bucket key', async () => {
      const store = createRecordingStore();
      const keyGenerator: RateLimitKeyGenerator = (context, clientAddress) =>
        `custom:${context.request.headers.get('x-api-key') ?? 'unknown'}@${clientAddress}`;

      const middleware = createRateLimiter({ max: 10, windowMs: 60000, store, keyGenerator });

      await middleware(createContext({ address: '192.0.2.11', headers: { 'x-api-key': 'key1' } }));

      expect(store.identifiers).toEqual(['custom:key1@192.0.2.11']);
    });

    it('falls back to the address key when the generator returns nothing', async () => {
      const store = createRecordingStore();
      const middleware = createRateLimiter({
        max: 10,
        windowMs: 60000,
        store,
        keyGenerator: () => null,
      });

      await middleware(createContext({ address: '192.0.2.12' }));

      expect(store.identifiers).toEqual(['ip:192.0.2.12']);
    });

    it('tracks custom keys independently', async () => {
      const middleware = createRateLimiter({
        max: 1,
        windowMs: 60000,
        store: createMemoryStore({ sweepIntervalMs: 0 }),
        keyGenerator: (context) => `key:${context.request.headers.get('x-api-key') ?? 'unknown'}`,
      });

      await middleware(createContext({ address: '192.0.2.1', headers: { 'x-api-key': 'key1' } }));
      expect(
        await middleware(createContext({ address: '192.0.2.1', headers: { 'x-api-key': 'key2' } })),
      ).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Over a real socket
// ---------------------------------------------------------------------------

describe('served over a real socket', () => {
  it('identifies a request by the address Bun reports for its connection', async () => {
    const store = createRecordingStore();
    const middleware = createRateLimiter({ max: 2, windowMs: 60_000, store });
    const app = new Elysia().get('/', () => 'ok', { beforeHandle: [middleware] }).listen(0);

    try {
      const url = `http://127.0.0.1:${app.server?.port}/`;
      // The spoofed forwarding header changes nothing: the limiter reads the
      // socket, which is what a deployment without a trusted proxy must do.
      const headers = { 'x-forwarded-for': '203.0.113.1' };

      expect((await fetch(url, { headers })).status).toBe(200);
      expect((await fetch(url, { headers })).status).toBe(200);
      expect((await fetch(url, { headers })).status).toBe(429);

      expect(new Set(store.identifiers).size).toBe(1);
      expect(store.identifiers[0]).toMatch(/^ip:(127\.0\.0\.1|::1)$/);
    } finally {
      app.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// walletKeyGenerator
// ---------------------------------------------------------------------------

describe('walletKeyGenerator', () => {
  function createAuthContext(
    walletAddress: string | undefined,
    address = '10.0.0.2',
  ): RateLimitContext & {
    getAuthenticatedUser: () => Promise<{ id: string; walletAddress: string }>;
  } {
    return {
      ...createContext({ address }),
      getAuthenticatedUser: walletAddress
        ? async () => ({ id: 'user-1', walletAddress })
        : async () => {
            throw new Error('UNAUTHORIZED');
          },
    };
  }

  it('keys by wallet address from the verified auth context', async () => {
    const context = createAuthContext('GA7EXAMPLEADDRESS');
    expect(await walletKeyGenerator(context, '10.0.0.2')).toBe('wallet:GA7EXAMPLEADDRESS');
  });

  it('falls back to the resolved client address when auth fails', async () => {
    const context = createAuthContext(undefined);
    expect(await walletKeyGenerator(context, '10.0.0.2')).toBe('ip:10.0.0.2');
  });

  it('falls back to the resolved client address when getAuthenticatedUser is missing', async () => {
    expect(await walletKeyGenerator(createContext({ address: '10.0.0.3' }), '10.0.0.3')).toBe(
      'ip:10.0.0.3',
    );
  });

  it('returns nothing when there is neither a wallet nor an address', async () => {
    expect(await walletKeyGenerator(createOfflineContext(), null)).toBeNull();
  });

  it('rate-limits by wallet across different addresses', async () => {
    const middleware = createRateLimiter({
      max: 2,
      windowMs: 60000,
      store: createMemoryStore({ sweepIntervalMs: 0 }),
      keyGenerator: walletKeyGenerator,
    });

    const first = createAuthContext('GA7SAMEWALLET', '192.168.1.1');
    const second = createAuthContext('GA7SAMEWALLET', '192.168.2.2');

    // Same wallet from two addresses: both requests share one budget.
    expect(await middleware(first)).toBeUndefined();
    expect(await middleware(second)).toBeUndefined();

    const third = createAuthContext('GA7SAMEWALLET', '192.168.3.3');
    expect(await middleware(third)).toEqual(rejection());
  });

  it('tracks different wallets independently', async () => {
    const middleware = createRateLimiter({
      max: 1,
      windowMs: 60000,
      store: createMemoryStore({ sweepIntervalMs: 0 }),
      keyGenerator: walletKeyGenerator,
    });

    await middleware(createAuthContext('GA7WALLETONE')); // wallet 1 hits the limit

    expect(await middleware(createAuthContext('GA7WALLETTWO'))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// rateLimit (router-facing) and its test hook
// ---------------------------------------------------------------------------

describe('rateLimit', () => {
  it('rate-limits router requests by socket address', async () => {
    // A unique peer keeps this test independent of the shared process-wide store.
    const middleware = rateLimit({ max: 1, windowMs: 60_000 });
    const peer = `192.0.2.${200 + Math.floor(Math.random() * 40)}`;

    expect(await middleware(createContext({ address: peer }))).toBeUndefined();

    const blocked = createContext({ address: peer });
    expect(await middleware(blocked)).toEqual(rejection());
    expect(blocked.set.status).toBe(429);
  });

  it('cannot be disabled from a request', async () => {
    const middleware = rateLimit({ max: 1, windowMs: 60_000 });
    const peer = `198.51.100.${200 + Math.floor(Math.random() * 40)}`;

    await middleware(
      createContext({ address: peer, headers: { 'x-test-bypass-ratelimit': 'true' } }),
    );

    expect(
      await middleware(
        createContext({ address: peer, headers: { 'x-test-bypass-ratelimit': 'true' } }),
      ),
    ).toEqual(rejection());
  });

  it('skips a request it cannot attribute instead of sharing a bucket', async () => {
    const middleware = rateLimit({ max: 1, windowMs: 60_000 });

    const context = createOfflineContext();
    expect(await middleware(context)).toBeUndefined();
    expect(context.set.status).toBeUndefined();
  });
});

describe('setClientAddressResolverForTesting', () => {
  // The hook itself is exercised end to end by the router-level suite in
  // tests/whitelist.manual-verification.test.ts, which is its only consumer.
  // This suite only pins the guard that keeps it out of a deployment.
  it('refuses to install itself outside the test environment', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => setClientAddressResolverForTesting(() => '203.0.113.99')).toThrow(
        /only available when NODE_ENV is "test"/,
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
