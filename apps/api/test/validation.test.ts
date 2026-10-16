import { describe, it, expect } from 'bun:test';
import app from '../src/app';
import { userRoutes } from '../src/routes/users';

describe('Validation Middleware', () => {
  it('should reject invalid body on POST /properties', async () => {
    const response = await app.handle(
      new Request('http://localhost/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }), // name too short, plus missing fields
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      code: string;
      details: {
        source: string;
        errors: Record<string, unknown>;
      };
    };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.source).toBe('body');
    expect(body.details.errors.name).toBeDefined();
    expect(body.details.errors.description).toBeDefined();
  });

  it('should reject invalid query on GET /properties', async () => {
    const response = await app.handle(new Request('http://localhost/properties?page=abc'));

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      code: string;
      details: {
        source: string;
        errors: Record<string, unknown>;
      };
    };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.source).toBe('query');
    expect(body.details.errors.page).toBeDefined();
  });

  it('should reject invalid params on GET /properties/:id', async () => {
    const response = await app.handle(new Request('http://localhost/properties/not-a-uuid'));

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      code: string;
      details: {
        source: string;
        errors: Record<string, unknown>;
      };
    };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.source).toBe('params');
    expect(body.details.errors.id).toBeDefined();
  });

  it('should pass valid body on POST /properties', async () => {
    // We expect a 201 or 200 depending on implementation, but NOT a 400 VALIDATION_ERROR
    const response = await app.handle(
      new Request('http://localhost/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-address': 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        },
        body: JSON.stringify({
          name: 'Test Property',
          description: 'A test property description longer than 10 chars',
          propertyType: 'residential',
          location: {
            address: '123 Test St',
            city: 'Test City',
            country: 'US',
          },
          totalValue: '100000.00',
          totalShares: 100,
          pricePerShare: '1000.00',
          images: ['https://example.com/image.jpg'],
        }),
      }),
    );

    // Validation should pass - if 400 it should NOT be VALIDATION_ERROR
    // (Controller may return 400 for business logic validation)
    if (response.status === 400) {
      const body = (await response.json()) as { code?: string };
      expect(body.code).not.toBe('VALIDATION_ERROR');
    }
  });

  it('should not apply a sibling body schema to GET /users/:id', async () => {
    const { Elysia } = await import('elysia');
    const isolated = new Elysia().use(userRoutes);
    const response = await isolated.handle(
      new Request('http://localhost/users/123e4567-e89b-12d3-a456-426614174000'),
    );

    // Must not be a body validation error from createUserSchema
    if (response.status === 400) {
      const body = (await response.json()) as { code?: string; details?: { source?: string } };
      expect(body.code).not.toBe('VALIDATION_ERROR');
      expect(body.details?.source).not.toBe('body');
    }
  });

  it('should reject invalid body on POST /lending/pools/:id/deposit', async () => {
    const { lendingRoutes } = await import('../src/routes/lending');
    const { Elysia } = await import('elysia');
    const isolated = new Elysia().use(lendingRoutes);
    const response = await isolated.handle(
      new Request('http://localhost/lending/pools/123e4567-e89b-12d3-a456-426614174000/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; details: { source: string } };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.source).toBe('body');
  });

  it('should reject invalid body on POST /notifications/read-all', async () => {
    const { notificationRoutes } = await import('../src/routes/notifications');
    const { Elysia } = await import('elysia');
    const isolated = new Elysia().use(notificationRoutes);
    const response = await isolated.handle(
      new Request('http://localhost/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: 'not-an-array' }),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; details: { source: string } };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.source).toBe('body');
  });

  it('should reject invalid body on POST /auth/session', async () => {
    const { authRoutes } = await import('../src/routes/auth');
    const { Elysia } = await import('elysia');
    const isolated = new Elysia().use(authRoutes);
    const response = await isolated.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; details: { source: string } };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.source).toBe('body');
  });
});
