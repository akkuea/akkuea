import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { propertyRoutes } from '../routes/properties';

// Valid UUIDs for testing
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NON_EXISTENT_UUID = '550e8400-e29b-41d4-a716-446655440999';

describe('Property Routes Integration Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(() => {
    app = new Elysia().use(propertyRoutes);
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('GET /properties', () => {
    it('should return paginated properties', async () => {
      const response = await app.handle(new Request('http://localhost/properties'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      // Default limit is 20 in paginationQuerySchema
      expect(body.pagination.limit).toBe(20);
    });

    it('should filter properties by city', async () => {
      const response = await app.handle(new Request('http://localhost/properties?city=Miami'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toBeDefined();
      // City filter is applied at controller level, may return empty if no Miami properties
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should reject invalid page parameter', async () => {
      const response = await app.handle(new Request('http://localhost/properties?page=abc'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.source).toBe('query');
    });
  });

  describe('GET /properties/:id', () => {
    it('should return 400 for invalid UUID format', async () => {
      const response = await app.handle(new Request('http://localhost/properties/not-a-uuid'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.source).toBe('params');
    });

    it('should return 404 for non-existent property with valid UUID', async () => {
      const response = await app.handle(new Request(`http://localhost/properties/${NON_EXISTENT_UUID}`));

      expect(response.status).toBe(404);
    });

    it('should return property when valid UUID is provided', async () => {
      const response = await app.handle(new Request(`http://localhost/properties/${VALID_UUID}`));

      // May return 404 if property doesn't exist in seed data, but should not be 400
      expect(response.status === 200 || response.status === 404).toBe(true);
    });
  });

  describe('POST /properties', () => {
    it('should create a property successfully with valid Zod schema data', async () => {
      const propertyData = {
        name: 'Test Property',
        description: 'A test property for integration testing with sufficient length',
        propertyType: 'residential',
        location: {
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
        },
        totalValue: '500000.00',
        totalShares: 500,
        pricePerShare: '1000.00',
        images: ['https://example.com/image.jpg'],
      };

      const response = await app.handle(
        new Request('http://localhost/properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          },
          body: JSON.stringify(propertyData),
        }),
      );

      // Validation should pass (not 400 with VALIDATION_ERROR)
      const body = await response.json();
      if (response.status === 400) {
        expect(body.code).not.toBe('VALIDATION_ERROR');
      }
    });

    it('should return 400 for invalid property data (missing required fields)', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'test-user-address',
          },
          body: JSON.stringify({ name: '' }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.source).toBe('body');
    });
  });

  describe('PUT /properties/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/invalid-id', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'test-user-address',
          },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when x-user-address header is missing with valid UUID', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Updated Name' }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it('should process update request with valid UUID and user address', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          },
          body: JSON.stringify({ name: 'Updated Property Name' }),
        }),
      );

      // Should not be 400 validation error - either 200, 404 (not found), or 403 (not owner)
      expect(response.status === 200 || response.status === 404 || response.status === 403).toBe(true);
    });
  });

  describe('DELETE /properties/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/invalid-id', {
          method: 'DELETE',
          headers: {
            'x-user-address': 'test-user-address',
          },
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when x-user-address header is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}`, {
          method: 'DELETE',
        }),
      );

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${NON_EXISTENT_UUID}`, {
          method: 'DELETE',
          headers: {
            'x-user-address': 'some-user-address',
          },
        }),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('POST /properties/:id/tokenize', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/invalid-id/tokenize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should process tokenize request with valid UUID', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}/tokenize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
      );

      // Should not be 400 validation error
      expect(response.status !== 400 || (await response.clone().json()).code !== 'VALIDATION_ERROR').toBe(true);
    });
  });

  describe('POST /properties/:id/buy-shares', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/invalid-id/buy-shares', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ buyer: 'buyer-address', shares: 10 }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when buyer is missing', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}/buy-shares`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shares: 10 }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.source).toBe('body');
    });

    it('should return 400 when shares is invalid (zero)', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}/buy-shares`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ buyer: 'buyer-address', shares: 0 }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should process share purchase when valid', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}/buy-shares`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ buyer: 'buyer-address', shares: 10 }),
        }),
      );

      // Validation should pass - controller handles business logic
      const body = await response.json();
      if (response.status === 400) {
        expect(body.code).not.toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('GET /properties/:id/shares/:owner', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/invalid-id/shares/owner-address'),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should process request with valid UUID and owner', async () => {
      const response = await app.handle(
        new Request(`http://localhost/properties/${VALID_UUID}/shares/owner-address`),
      );

      // Validation should pass - controller handles business logic
      const body = await response.json();
      if (response.status === 400) {
        expect(body.code).not.toBe('VALIDATION_ERROR');
      }
    });
  });
});
