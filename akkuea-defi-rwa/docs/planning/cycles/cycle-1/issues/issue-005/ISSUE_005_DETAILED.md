# C1-005: Implement Property CRUD Operations in PropertyController

## Detailed Implementation Guide

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-005 |
| Title | Implement property CRUD operations in PropertyController |
| Area | API |
| Difficulty | Medium |
| Labels | backend, api, medium |
| Dependencies | None |
| Estimated Lines | 150-200 |

## Overview

This issue replaces the placeholder PropertyController implementation with fully functional CRUD operations. The controller will handle HTTP requests and delegate to the repository layer for data operations.

## Prerequisites

- Understanding of Elysia routing
- Familiarity with repository pattern
- Knowledge of input validation with Zod

## Implementation Steps

### Step 1: Create Property DTOs

Create `apps/api/src/dto/property.dto.ts`:

```typescript
import { z } from 'zod';

/**
 * Property location schema
 */
export const PropertyLocationDto = z.object({
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  postalCode: z.string().optional(),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

/**
 * Create property request schema
 */
export const CreatePropertyDto = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'land', 'mixed']),
  location: PropertyLocationDto,
  totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid monetary value'),
  totalShares: z.number().int().positive().max(1000000),
  pricePerShare: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid monetary value'),
  images: z.array(z.string().url()).min(1, 'At least one image required'),
});

/**
 * Update property request schema
 */
export const UpdatePropertyDto = CreatePropertyDto.partial();

/**
 * Property query parameters schema
 */
export const PropertyQueryDto = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'totalValue', 'listedAt', 'pricePerShare']).default('listedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'land', 'mixed']).optional(),
  country: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  verified: z.coerce.boolean().optional(),
  owner: z.string().length(56).optional(),
});

export type CreatePropertyInput = z.infer<typeof CreatePropertyDto>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertyDto>;
export type PropertyQueryInput = z.infer<typeof PropertyQueryDto>;
```

### Step 2: Create Property Repository

Create `apps/api/src/repositories/PropertyRepository.ts`:

```typescript
import { eq, and, gte, lte, desc, asc, sql, SQL } from 'drizzle-orm';
import { db } from '../db';
import { properties, propertyDocuments, shareOwnerships } from '../db/schema';
import { BaseRepository } from './BaseRepository';
import type { PropertyQueryInput, CreatePropertyInput } from '../dto/property.dto';

type Property = typeof properties.$inferSelect;
type NewProperty = typeof properties.$inferInsert;

export class PropertyRepository extends BaseRepository<
  typeof properties,
  NewProperty,
  Property
> {
  constructor() {
    super(properties);
  }

  /**
   * Find properties with filters and pagination
   */
  async findWithFilters(query: PropertyQueryInput): Promise<{
    data: Property[];
    total: number;
  }> {
    const conditions: SQL[] = [];

    if (query.propertyType) {
      conditions.push(eq(properties.propertyType, query.propertyType));
    }

    if (query.verified !== undefined) {
      conditions.push(eq(properties.verified, query.verified));
    }

    if (query.minPrice) {
      conditions.push(gte(properties.pricePerShare, query.minPrice.toString()));
    }

    if (query.maxPrice) {
      conditions.push(lte(properties.pricePerShare, query.maxPrice.toString()));
    }

    if (query.owner) {
      conditions.push(eq(properties.ownerId, query.owner));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(whereClause);

    // Get paginated results
    const orderBy = query.sortOrder === 'asc'
      ? asc(properties[query.sortBy as keyof typeof properties])
      : desc(properties[query.sortBy as keyof typeof properties]);

    const offset = (query.page - 1) * query.limit;

    const data = await db
      .select()
      .from(properties)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(query.limit)
      .offset(offset);

    return { data, total: Number(count) };
  }

  /**
   * Find property with documents
   */
  async findByIdWithDocuments(id: string): Promise<Property & { documents: any[] } | null> {
    const property = await this.findById(id);
    if (!property) return null;

    const documents = await db
      .select()
      .from(propertyDocuments)
      .where(eq(propertyDocuments.propertyId, id));

    return { ...property, documents };
  }

  /**
   * Create property with owner
   */
  async createProperty(data: CreatePropertyInput, ownerId: string): Promise<Property> {
    const propertyData: NewProperty = {
      name: data.name,
      description: data.description,
      propertyType: data.propertyType,
      location: data.location,
      totalValue: data.totalValue,
      totalShares: data.totalShares,
      availableShares: data.totalShares,
      pricePerShare: data.pricePerShare,
      images: data.images,
      ownerId,
    };

    return this.create(propertyData);
  }

  /**
   * Check if user owns property
   */
  async isOwner(propertyId: string, userId: string): Promise<boolean> {
    const property = await this.findById(propertyId);
    return property?.ownerId === userId;
  }
}

export const propertyRepository = new PropertyRepository();
```

### Step 3: Implement PropertyController

Update `apps/api/src/controllers/PropertyController.ts`:

```typescript
import { Context } from 'elysia';
import { propertyRepository } from '../repositories/PropertyRepository';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyQueryDto,
  type CreatePropertyInput,
  type UpdatePropertyInput,
} from '../dto/property.dto';
import { ApiError } from '../errors/ApiError';

export class PropertyController {
  /**
   * Get all properties with pagination and filters
   */
  static async getAll(ctx: Context): Promise<Response> {
    const queryResult = PropertyQueryDto.safeParse(ctx.query);

    if (!queryResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query parameters', {
        errors: queryResult.error.flatten().fieldErrors,
      });
    }

    const { data, total } = await propertyRepository.findWithFilters(queryResult.data);
    const { page, limit } = queryResult.data;

    return new Response(
      JSON.stringify({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get property by ID
   */
  static async getById(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const { id } = ctx.params;

    const property = await propertyRepository.findByIdWithDocuments(id);

    if (!property) {
      throw new ApiError(404, 'NOT_FOUND', `Property with ID ${id} not found`);
    }

    return new Response(JSON.stringify(property), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Create new property
   */
  static async create(ctx: Context): Promise<Response> {
    const body = await ctx.request.json();
    const validationResult = CreatePropertyDto.safeParse(body);

    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid property data', {
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    // Get user ID from auth context (placeholder for auth implementation)
    const userId = ctx.headers.get('x-user-id');
    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const property = await propertyRepository.createProperty(validationResult.data, userId);

    return new Response(JSON.stringify(property), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Update property
   */
  static async update(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const { id } = ctx.params;
    const body = await ctx.request.json();

    const validationResult = UpdatePropertyDto.safeParse(body);

    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid update data', {
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    // Check if property exists
    const existing = await propertyRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', `Property with ID ${id} not found`);
    }

    // Check ownership
    const userId = ctx.headers.get('x-user-id');
    if (!userId || !(await propertyRepository.isOwner(id, userId))) {
      throw new ApiError(403, 'FORBIDDEN', 'Not authorized to update this property');
    }

    const updated = await propertyRepository.update(id, validationResult.data);

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Delete property
   */
  static async delete(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const { id } = ctx.params;

    // Check if property exists
    const existing = await propertyRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', `Property with ID ${id} not found`);
    }

    // Check ownership
    const userId = ctx.headers.get('x-user-id');
    if (!userId || !(await propertyRepository.isOwner(id, userId))) {
      throw new ApiError(403, 'FORBIDDEN', 'Not authorized to delete this property');
    }

    // Check if property has active shares
    if (existing.availableShares < existing.totalShares) {
      throw new ApiError(
        400,
        'CANNOT_DELETE',
        'Cannot delete property with sold shares'
      );
    }

    await propertyRepository.delete(id);

    return new Response(null, { status: 204 });
  }
}
```

### Step 4: Create ApiError Class

Create `apps/api/src/errors/ApiError.ts`:

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
```

## Testing Guidelines

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../src/index';

describe('PropertyController', () => {
  describe('GET /properties', () => {
    it('should return paginated properties', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties?page=1&limit=10')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    it('should filter by property type', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties?propertyType=residential')
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      body.data.forEach((property: any) => {
        expect(property.propertyType).toBe('residential');
      });
    });
  });

  describe('GET /properties/:id', () => {
    it('should return 404 for non-existent property', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties/non-existent-id')
      );

      expect(response.status).toBe(404);
    });
  });

  describe('POST /properties', () => {
    it('should return 400 for invalid data', async () => {
      const response = await app.handle(
        new Request('http://localhost/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '' }),
        })
      );

      expect(response.status).toBe(400);
    });
  });
});
```

## Related Resources

| Resource | Link |
|----------|------|
| Elysia Documentation | https://elysiajs.com |
| Drizzle ORM | https://orm.drizzle.team |
| Zod Validation | https://zod.dev |

## Verification Checklist

| Item | Status |
|------|--------|
| DTOs created | |
| Repository implemented | |
| Controller methods working | |
| Validation working | |
| Error handling complete | |
| Tests passing | |
