import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test';
import { Elysia } from 'elysia';
import { DEFAULT_DEV_CORS_ALLOWED_ORIGINS } from '@akkuea/shared';
import app from '../app';
import { createCorsPlugin, readCorsAllowedOrigins } from '../middleware/cors';

const ALLOWED_ORIGIN = 'https://app.akkuea.example';
const EVIL_ORIGIN = 'https://evil.example';

interface RequestHandler {
  handle(request: Request): Promise<Response>;
}

describe('CORS', () => {
  const corsApp = new Elysia()
    .use(createCorsPlugin([ALLOWED_ORIGIN, 'http://localhost:3000']))
    .get('/resource', () => ({ ok: true }));

  const get = (target: RequestHandler, origin?: string) =>
    target.handle(
      new Request('http://localhost/resource', {
        headers: origin ? { origin } : {},
      }),
    );

  const preflight = (target: RequestHandler, origin: string) =>
    target.handle(
      new Request('http://localhost/resource', {
        method: 'OPTIONS',
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,authorization',
        },
      }),
    );

  describe('createCorsPlugin', () => {
    it('echoes an allowed origin and allows credentials', async () => {
      const response = await get(corsApp, ALLOWED_ORIGIN);

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('vary')).toContain('Origin');
    });

    it('sends no Access-Control-Allow-Origin header to an origin that is not allowed', async () => {
      const response = await get(corsApp, EVIL_ORIGIN);

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('does not match an allowed host on a different scheme or port', async () => {
      for (const origin of ['http://app.akkuea.example', 'http://localhost:3001']) {
        const response = await get(corsApp, origin);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
      }
    });

    it('sends no Access-Control-Allow-Origin header when the request has no Origin', async () => {
      const response = await get(corsApp);

      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('answers a preflight from an allowed origin', async () => {
      const response = await preflight(corsApp, ALLOWED_ORIGIN);

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('sends no Access-Control-Allow-Origin header on a preflight from another origin', async () => {
      const response = await preflight(corsApp, EVIL_ORIGIN);

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('allows no origin at all when the list is empty', async () => {
      const closedApp = new Elysia()
        .use(createCorsPlugin([]))
        .get('/resource', () => ({ ok: true }));

      for (const origin of [ALLOWED_ORIGIN, EVIL_ORIGIN, 'http://localhost:3000']) {
        const response = await get(closedApp, origin);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
      }
    });
  });

  describe('API app', () => {
    // CORS headers are applied on every request before routing, so an
    // unrouted path exercises the real plugin without touching the database.
    it('does not reflect an unknown origin', async () => {
      const response = await app.handle(
        new Request('http://localhost/cors-probe', { headers: { origin: EVIL_ORIGIN } }),
      );

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('does not answer a preflight from an unknown origin', async () => {
      const response = await app.handle(
        new Request('http://localhost/cors-probe', {
          method: 'OPTIONS',
          headers: { origin: EVIL_ORIGIN, 'access-control-request-method': 'POST' },
        }),
      );

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('readCorsAllowedOrigins', () => {
    let warnSpy: Mock<typeof console.warn>;

    beforeEach(() => {
      warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('uses the configured list', () => {
      expect(
        readCorsAllowedOrigins({
          NODE_ENV: 'production',
          CORS_ALLOWED_ORIGINS: `${ALLOWED_ORIGIN}, https://land.akkuea.example`,
        }),
      ).toEqual([ALLOWED_ORIGIN, 'https://land.akkuea.example']);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('defaults to the local frontends in development', () => {
      expect(readCorsAllowedOrigins({ NODE_ENV: 'development' })).toEqual([
        ...DEFAULT_DEV_CORS_ALLOWED_ORIGINS,
      ]);
    });

    it('allows no origins and warns in production when unset', () => {
      expect(readCorsAllowedOrigins({ NODE_ENV: 'production' })).toEqual([]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0]?.[0])).toContain('CORS_ALLOWED_ORIGINS');
    });

    it('rejects an invalid entry instead of widening the allowlist', () => {
      expect(() =>
        readCorsAllowedOrigins({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: '*' }),
      ).toThrow('Invalid CORS_ALLOWED_ORIGINS');
    });
  });
});
