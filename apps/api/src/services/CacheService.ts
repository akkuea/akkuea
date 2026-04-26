import { logger } from './logger';

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: string, time: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<unknown>;
}

/**
 * CacheService wraps ioredis with graceful fallback when Redis is unavailable.
 * If REDIS_URL is not set or the connection fails, all operations are no-ops
 * and the app continues to query the database directly.
 */
export class CacheService {
  private client: RedisClient | null = null;
  private available = false;

  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.info('REDIS_URL not set — caching disabled');
      return;
    }

    try {
      // Dynamic import so the app starts fine even if ioredis is not installed
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });

      await redis.connect();
      this.client = redis as unknown as RedisClient;
      this.available = true;
      logger.info('Redis connected — caching enabled');

      redis.on('error', (err: Error) => {
        if (this.available) {
          logger.warn('Redis error — falling back to DB queries', { error: err.message });
          this.available = false;
        }
      });

      redis.on('connect', () => {
        if (!this.available) {
          logger.info('Redis reconnected — caching re-enabled');
          this.available = true;
        }
      });
    } catch (err) {
      logger.warn('Redis unavailable — caching disabled', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // silent — cache write failure is non-fatal
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // silent
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }
}

export const cacheService = new CacheService();
