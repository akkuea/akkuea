import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { uuidParamSchema, validate, validateBody, validateParams } from './validation';

const bodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address').optional(),
});

describe('validation middleware error shape', () => {
  it('returns the VALIDATION_ERROR envelope with per-path messages for a bad body', async () => {
    const app = new Elysia().use(validateBody(bodySchema)).post('/echo', () => ({ ok: true }));

    const response = await app.handle(
      new Request('http://localhost/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email: 'not-an-email' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'VALIDATION_ERROR',
      code: 'VALIDATION_ERROR',
      message: 'Invalid body parameters',
      statusCode: 400,
      details: {
        source: 'body',
        errors: {
          name: ['Name is required'],
          email: ['Invalid email address'],
        },
      },
    });
  });

  it('keys root-level issues under _root', async () => {
    const app = new Elysia()
      .use(validate({ body: bodySchema }))
      .post('/echo', () => ({ ok: true }));

    const response = await app.handle(
      new Request('http://localhost/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify('nope'),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { details: { errors: Record<string, string[]> } };
    expect(Object.keys(body.details.errors)).toEqual(['_root']);
  });

  it('accepts a valid body', async () => {
    const app = new Elysia().use(validateBody(bodySchema)).post('/echo', () => ({ ok: true }));

    const response = await app.handle(
      new Request('http://localhost/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it('rejects a malformed uuid param and accepts an RFC 4122 one', async () => {
    const app = new Elysia()
      .use(validateParams(uuidParamSchema))
      .get('/items/:id', () => ({ ok: true }));

    const bad = await app.handle(new Request('http://localhost/items/not-a-uuid'));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({
      error: 'VALIDATION_ERROR',
      details: { source: 'params', errors: { id: ['Invalid UUID format'] } },
    });

    const good = await app.handle(
      new Request('http://localhost/items/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'),
    );
    expect(good.status).toBe(200);
  });
});
