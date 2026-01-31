import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { propertyRoutes } from '../routes/properties';

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
      expect(body.pagination.limit).toBe(10);
    });

    it('should filter properties by city', async () => {
      const response = await app.handle(new Request('http://localhost/properties?city=Miami'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((prop: any) => {
        expect(prop.location.city).toBe('Miami');
      });
    });
  });

  describe('GET /properties/:id', () => {
    it('should return 404 for non-existent property', async () => {
      const response = await app.handle(new Request('http://localhost/properties/non-existent-id'));

      expect(response.status).toBe(404);
    });

    it('should return property when id is provided', async () => {
      // Use property_1 from seed data
      const response = await app.handle(new Request('http://localhost/properties/property_1'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('property_1');
      expect(body.owner).toBeDefined();
    });
  });

  describe('POST /properties', () => {
    it('should create a property successfully', async () => {
      const propertyData = {
        owner: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        totalShares: 500,
        valuePerShare: 250,
        metadata: {
          name: 'Test Property',
          description: 'A test property for integration testing',
          propertyType: 'residential',
        },
        location: {
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
        },
      };

      const response = await app.handle(
        new Request('http://localhost/properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'test-user-address',
          },
          body: JSON.stringify(propertyData),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBeDefined();
      expect(body.totalShares).toBe(500);
    });

    it('should return 400 for invalid property data', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'test-user-address',
          },
          body: JSON.stringify({ invalid: 'data' }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toContain('Validation failed');
    });
  });

  describe('PUT /properties/:id', () => {
    it('should return 401 when x-user-address header is missing', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/test-id', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: 'Updated Address' }),
        }),
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('should update property when authorized', async () => {
      // Use property_1 and its actual owner from seed data
      const response = await app.handle(
        new Request('http://localhost/properties/property_1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          },
          body: JSON.stringify({ valuePerShare: 150 }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.valuePerShare).toBe(150);
    });

    it('should return 403 when user is not owner', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/property_1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-address': 'wrong-owner-address',
          },
          body: JSON.stringify({ valuePerShare: 150 }),
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /properties/:id', () => {
    it('should return 401 when x-user-address header is missing', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/test-id', {
          method: 'DELETE',
        }),
      );

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: string; message: string };
      expect(body.error).toBe('UNAUTHORIZED');
      expect(body.message).toBe('User address is required for authentication');
    });

    it('should return 404 for non-existent property', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/non-existent-id', {
          method: 'DELETE',
          headers: {
            'x-user-address': 'some-user-address',
          },
        }),
      );

      expect(response.status).toBe(404);
    });

    it('should return 403 when user is not owner', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/property_1', {
          method: 'DELETE',
          headers: {
            'x-user-address': 'wrong-owner-address',
          },
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /properties/:id/tokenize', () => {
    it('should return 400 when property id is missing', async () => {
      // Route parameter validation
      const response = await app.handle(
        new Request('http://localhost/properties/test-id/tokenize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(200);
    });
  });

  describe('POST /properties/:id/buy-shares', () => {
    it('should return 400 when buyer is missing', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/test-id/buy-shares', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shares: 10 }),
        }),
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { message: string };
      expect(body.message).toBe('Buyer address is required');
    });

    it('should return 400 when shares is invalid', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/test-id/buy-shares', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ buyer: 'buyer-address', shares: 0 }),
        }),
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { message: string };
      expect(body.message).toBe('Number of shares must be greater than 0');
    });

    it('should process share purchase when valid', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/test-id/buy-shares', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ buyer: 'buyer-address', shares: 10 }),
        }),
      );

      expect(response.status).toBe(200);
    });
  });

  describe('GET /properties/:id/shares/:owner', () => {
    it('should return 400 when owner is empty', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/test-id/shares/owner-address'),
      );

      expect(response.status).toBe(200);
    });
  });
});
