import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import app from '../src/app';
import { userRoutes } from '../src/routes/users';
import { lendingRoutes } from '../src/routes/lending';
import { notificationRoutes } from '../src/routes/notifications';
import { authRoutes } from '../src/routes/auth';

type ValidationBody = {
  code?: string;
  details?: { source?: string; errors?: Record<string, unknown> };
};

const UUID = '123e4567-e89b-12d3-a456-426614174000';

function jsonRequest(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function readBody(response: Response): Promise<ValidationBody> {
  try {
    return (await response.json()) as ValidationBody;
  } catch {
    return {};
  }
}

/**
 * A request may legitimately fail with 400/401/404 for business reasons. What
 * must never happen is a validation error raised by a sibling route's schema,
 * so the assertion is always on the error shape, not only on the status.
 */
function expectNotAValidationError(body: ValidationBody, source?: string) {
  if (body.code !== 'VALIDATION_ERROR') return;
  expect(body.details?.source).not.toBe(source ?? 'body');
}

describe('Validation Middleware', () => {
  it('should reject invalid body on POST /properties', async () => {
    const response = await app.handle(
      jsonRequest('http://localhost/properties', 'POST', { name: '' }),
    );

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details?.source).toBe('body');
    expect(body.details?.errors?.name).toBeDefined();
    expect(body.details?.errors?.description).toBeDefined();
  });

  it('should reject invalid query on GET /properties', async () => {
    const response = await app.handle(new Request('http://localhost/properties?page=abc'));

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details?.source).toBe('query');
    expect(body.details?.errors?.page).toBeDefined();
  });

  it('should reject invalid params on GET /properties/:id', async () => {
    const response = await app.handle(new Request('http://localhost/properties/not-a-uuid'));

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details?.source).toBe('params');
    expect(body.details?.errors?.id).toBeDefined();
  });

  it('should pass valid body on POST /properties', async () => {
    const response = await app.handle(
      jsonRequest(
        'http://localhost/properties',
        'POST',
        {
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
        },
        { 'x-user-address': 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
      ),
    );

    // Validation should pass - if 400 it should NOT be VALIDATION_ERROR
    // (Controller may return 400 for business logic validation)
    if (response.status === 400) {
      const body = await readBody(response);
      expect(body.code).not.toBe('VALIDATION_ERROR');
    }
  });
});

describe('Per-route validation isolation', () => {
  describe('users router', () => {
    const usersApp = new Elysia().use(userRoutes);

    it('does not apply createUserSchema to GET /users/:id', async () => {
      const response = await usersApp.handle(new Request(`http://localhost/users/${UUID}`));

      // The body schema of POST /users must not fire on this route.
      expect(response.status).not.toBe(400);
      expectNotAValidationError(await readBody(response), 'body');
    });

    it('rejects an invalid uuid on GET /users/:id', async () => {
      const response = await usersApp.handle(new Request('http://localhost/users/not-a-uuid'));

      expect(response.status).toBe(400);
      const body = await readBody(response);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details?.source).toBe('params');
    });

    it('does not apply the params schema to POST /users', async () => {
      const response = await usersApp.handle(
        jsonRequest('http://localhost/users', 'POST', {
          walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        }),
      );

      expectNotAValidationError(await readBody(response), 'params');
    });

    it('rejects an invalid body on POST /users', async () => {
      const response = await usersApp.handle(
        jsonRequest('http://localhost/users', 'POST', { walletAddress: 'not-a-wallet' }),
      );

      expect(response.status).toBe(400);
      const body = await readBody(response);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details?.source).toBe('body');
    });
  });

  describe('lending router', () => {
    const lendingApp = new Elysia().use(lendingRoutes);

    it('accepts a valid query on GET /lending/pools', async () => {
      const response = await lendingApp.handle(
        new Request('http://localhost/lending/pools?page=1&limit=10'),
      );

      expectNotAValidationError(await readBody(response), 'query');
    });

    it('does not apply the deposit body schema to GET /lending/pools/:id', async () => {
      const response = await lendingApp.handle(
        new Request(`http://localhost/lending/pools/${UUID}`),
      );

      expect(response.status).not.toBe(400);
      expectNotAValidationError(await readBody(response), 'body');
    });

    it('rejects an invalid body on the later POST /lending/pools/:id/deposit route', async () => {
      const response = await lendingApp.handle(
        jsonRequest(`http://localhost/lending/pools/${UUID}/deposit`, 'POST', {}),
      );

      expect(response.status).toBe(400);
      const body = await readBody(response);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details?.source).toBe('body');
    });
  });

  describe('notifications router', () => {
    const notificationApp = new Elysia().use(notificationRoutes);

    it('accepts a request without query params on GET /notifications', async () => {
      const response = await notificationApp.handle(
        new Request('http://localhost/notifications'),
      );

      expectNotAValidationError(await readBody(response), 'query');
    });

    it('does not apply the read-multiple body schema to GET /notifications/:id', async () => {
      const response = await notificationApp.handle(
        new Request(`http://localhost/notifications/${UUID}`),
      );

      expect(response.status).not.toBe(400);
      expectNotAValidationError(await readBody(response), 'body');
    });

    it('rejects an invalid body on POST /notifications/read-multiple', async () => {
      const response = await notificationApp.handle(
        jsonRequest('http://localhost/notifications/read-multiple', 'POST', {
          notificationIds: 'not-an-array',
        }),
      );

      expect(response.status).toBe(400);
      const body = await readBody(response);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details?.source).toBe('body');
    });

    it('rejects an invalid uuid on PATCH /notifications/:id/read', async () => {
      const response = await notificationApp.handle(
        new Request('http://localhost/notifications/not-a-uuid/read', { method: 'PATCH' }),
      );

      expect(response.status).toBe(400);
      const body = await readBody(response);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details?.source).toBe('params');
    });
  });

  describe('auth router', () => {
    const authApp = new Elysia().use(authRoutes);

    it('does not apply the session schema to POST /auth/challenge', async () => {
      const response = await authApp.handle(
        jsonRequest('http://localhost/auth/challenge', 'POST', {
          stellarAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        }),
      );

      // A challenge request carries no signature; only the session schema
      // requires one, and it must not reach this route.
      expectNotAValidationError(await readBody(response), 'body');
    });

    it('rejects an invalid body on POST /auth/session', async () => {
      const response = await authApp.handle(
        jsonRequest('http://localhost/auth/session', 'POST', {}),
      );

      expect(response.status).toBe(400);
      const body = await readBody(response);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details?.source).toBe('body');
    });
  });
});
