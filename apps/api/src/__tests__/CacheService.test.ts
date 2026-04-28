import { describe, it, expect } from 'bun:test';
import { CacheService } from '../services/CacheService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CacheService that is already "connected" to a fake Redis client. */
function makeConnectedCache() {
  const store = new Map<string, string>();

  const fakeRedis = {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string, _mode: string, _ttl: number) => {
      store.set(key, value);
      return 'OK';
    },
    del: async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    },
    keys: async (pattern: string) => {
      // Simple glob: replace '*' with a regex wildcard
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return [...store.keys()].filter((k) => regex.test(k));
    },
    quit: async () => 'OK',
    on: () => {},
  };

  const cache = new CacheService();
  // Inject the fake client directly (bypasses ioredis import)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cache as any).client = fakeRedis;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cache as any).available = true;

  return { cache, store };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CacheService', () => {
  describe('when Redis is available', () => {
    it('returns null on cache miss', async () => {
      const { cache } = makeConnectedCache();
      const result = await cache.get('missing:key');
      expect(result).toBeNull();
    });

    it('stores and retrieves a value (cache hit)', async () => {
      const { cache } = makeConnectedCache();
      const payload = { data: [1, 2, 3], pagination: { page: 1 } };

      await cache.set('test:key', payload, 30);
      const result = await cache.get<typeof payload>('test:key');

      expect(result).toEqual(payload);
    });

    it('invalidates keys matching a pattern', async () => {
      const { cache, store } = makeConnectedCache();

      await cache.set('properties:list:1:10', { data: [] }, 30);
      await cache.set('properties:list:2:10', { data: [] }, 30);
      await cache.set('lending:pools:1:20', { data: [] }, 10);

      await cache.invalidate('properties:list:*');

      expect(store.has('properties:list:1:10')).toBe(false);
      expect(store.has('properties:list:2:10')).toBe(false);
      // Unrelated key must survive
      expect(store.has('lending:pools:1:20')).toBe(true);
    });

    it('returns null after invalidation (cache miss)', async () => {
      const { cache } = makeConnectedCache();
      await cache.set('properties:list:1:10', { data: [] }, 30);
      await cache.invalidate('properties:list:*');
      const result = await cache.get('properties:list:1:10');
      expect(result).toBeNull();
    });

    it('isAvailable() returns true when connected', () => {
      const { cache } = makeConnectedCache();
      expect(cache.isAvailable()).toBe(true);
    });
  });

  describe('when Redis is unavailable (REDIS_URL not set)', () => {
    it('get() returns null without throwing', async () => {
      const cache = new CacheService(); // client = null, available = false
      const result = await cache.get('any:key');
      expect(result).toBeNull();
    });

    it('set() is a no-op without throwing', async () => {
      const cache = new CacheService();
      await expect(cache.set('any:key', { x: 1 }, 30)).resolves.toBeUndefined();
    });

    it('invalidate() is a no-op without throwing', async () => {
      const cache = new CacheService();
      await expect(cache.invalidate('any:*')).resolves.toBeUndefined();
    });

    it('isAvailable() returns false', () => {
      const cache = new CacheService();
      expect(cache.isAvailable()).toBe(false);
    });

    it('connect() is a no-op when REDIS_URL is absent', async () => {
      const original = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      const cache = new CacheService();
      await cache.connect(); // must not throw

      expect(cache.isAvailable()).toBe(false);
      if (original !== undefined) process.env.REDIS_URL = original;
    });
  });

  describe('when Redis client throws unexpectedly', () => {
    it('get() swallows the error and returns null', async () => {
      const cache = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any).client = {
        get: async () => {
          throw new Error('network error');
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any).available = true;

      const result = await cache.get('key');
      expect(result).toBeNull();
    });

    it('set() swallows the error silently', async () => {
      const cache = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any).client = {
        set: async () => {
          throw new Error('network error');
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any).available = true;

      await expect(cache.set('key', {}, 10)).resolves.toBeUndefined();
    });

    it('invalidate() swallows the error silently', async () => {
      const cache = new CacheService();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any).client = {
        keys: async () => {
          throw new Error('network error');
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cache as any).available = true;

      await expect(cache.invalidate('prefix:*')).resolves.toBeUndefined();
    });
  });
});
