import { describe, expect, it } from 'bun:test';
import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { corsOptions } from './cors';

describe('CORS configuration', () => {
  it('allows configured origins and rejects other origins', async () => {
    const app = new Elysia()
      .use(cors(corsOptions({
        NODE_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://app.example, https://land.example',
      })))
      .get('/', () => 'ok');

    const allowed = await app.handle(new Request('http://api.example/', {
      headers: { Origin: 'https://app.example' },
    }));
    const rejected = await app.handle(new Request('http://api.example/', {
      headers: { Origin: 'https://evil.example' },
    }));

    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example');
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('uses local web and land origins in development, with no production default', () => {
    expect(corsOptions({ NODE_ENV: 'development' }).origin).toEqual([
      'http://localhost:3000',
      'http://localhost:3002',
    ]);
    expect(corsOptions({ NODE_ENV: 'production' }).origin).toEqual([]);
  });
});
