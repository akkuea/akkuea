import { describe, it, expect } from 'bun:test';
import { rateLimit, createRedisStore, createMemoryStore } from './rateLimit';
import type { RateLimitRedisClient } from './rateLimit';

function createMockRequest(options: { headers?: Record<string, string> } = {}) {
  const headers = new Headers(options.headers ?? {});
  return { headers } as unknown as Request;
}

function createMockSet() {
  return {
    status: undefined as number | string | undefined,
    headers: undefined as Record<string, string> | undefined,
  };
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

  it('resets the window after expiry', async () => {
    const store = createMemoryStore();
    await store.checkLimit('id', 1, 1); // 1ms window
    await store.checkLimit('id', 1, 1); // over limit
    await new Promise((r) => setTimeout(r, 5));
    const result = await store.checkLimit('id', 1, 1); // new window
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

  it('sets resetAt in the future', async () => {
    const store = createMemoryStore();
    const before = Date.now();
    const result = await store.checkLimit('id', 60000, 10);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
  });
});

// ---------------------------------------------------------------------------
// createRedisStore
// ---------------------------------------------------------------------------

describe('createRedisStore', () => {
  function makeFakeRedisClient(): RateLimitRedisClient & { counts: Map<string, number> } {
    const counts = new Map<string, number>();
    const ttls = new Map<string, number>();
    return {
      counts,
      async incr(key: string) {
        const c = (counts.get(key) ?? 0) + 1;
        counts.set(key, c);
        return c;
      },
      async expire(key: string, seconds: number) {
        ttls.set(key, seconds);
        return 1;
      },
      async ttl(key: string) {
        return ttls.get(key) ?? 60;
      },
    };
  }

  it('allows the first request and sets expiry', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    const result = await store.checkLimit('user:abc', 60000, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('only calls expire on the first increment', async () => {
    const client = makeFakeRedisClient();
    const expireCalls: string[] = [];
    const origExpire = client.expire.bind(client);
    client.expire = async (key, secs) => {
      expireCalls.push(key);
      return origExpire(key, secs);
    };

    const store = createRedisStore(client);
    await store.checkLimit('id', 60000, 5);
    await store.checkLimit('id', 60000, 5);
    await store.checkLimit('id', 60000, 5);

    expect(expireCalls.length).toBe(1);
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

  it('uses TTL from Redis for resetAt', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    const before = Date.now();
    const result = await store.checkLimit('id', 60000, 10);
    // TTL defaults to 60s in our fake client
    expect(result.resetAt).toBeGreaterThanOrEqual(before);
  });

  it('prefixes the key with ratelimit:', async () => {
    const client = makeFakeRedisClient();
    const store = createRedisStore(client);
    await store.checkLimit('user:xyz', 60000, 5);
    expect(client.counts.has('ratelimit:user:xyz')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rateLimit middleware (in-memory mode — no REDIS_URL in tests)
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
      const result = await middleware({ request, set }); // 4th — blocked

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
      await middleware({ request: req1, set: set1 }); // 2nd for IP1 — blocked
      const result2 = await middleware({ request: req2, set: set2 }); // 1st for IP2

      expect(result2).toBeUndefined();
    });

    it('should track authenticated users by x-user-address header', async () => {
      const middleware = rateLimit({ max: 2, windowMs: 60000 });

      const req1 = createMockRequest({
        headers: { 'x-user-address': 'GAAAAAAA123456789', 'x-forwarded-for': '192.0.2.1' },
      });
      const req2 = createMockRequest({
        headers: { 'x-user-address': 'GBBBBBB987654321', 'x-forwarded-for': '192.0.2.1' },
      });
      const set1 = createMockSet();
      const set2 = createMockSet();

      await middleware({ request: req1, set: set1 }); // 1st for user A
      await middleware({ request: req1, set: set1 }); // 2nd for user A — blocked
      const result2 = await middleware({ request: req2, set: set2 }); // 1st for user B

      expect(result2).toBeUndefined();
    });

    it('should prioritize user address over IP for authenticated requests', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });

      const request = createMockRequest({
        headers: {
          'x-user-address': 'GCCCCCC555555555',
          'x-forwarded-for': '192.0.2.100',
        },
      });
      const set1 = createMockSet();
      const set2 = createMockSet();

      await middleware({ request, set: set1 }); // 1st request
      const result = await middleware({ request, set: set2 }); // 2nd — blocked

      expect(result).toEqual({
        success: false,
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      });
    });
  });

  describe('Retry-After header', () => {
    it('should set Retry-After header when rate limited', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });
      const request = createMockRequest({ headers: { 'x-forwarded-for': '192.0.5.1' } });
      const set = createMockSet();

      await middleware({ request, set }); // 1st
      await middleware({ request, set }); // 2nd — blocked

      expect(set.headers!['Retry-After']).toBeDefined();
      expect(Number(set.headers!['Retry-After'])).toBeGreaterThan(0);
    });
  });

  describe('custom keyGenerator', () => {
    it('should use custom key generator when provided', async () => {
      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator: (req) => `custom:${req.headers.get('x-api-key') ?? 'unknown'}`,
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
});
