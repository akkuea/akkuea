# C1-009: Add Request Validation Middleware with Zod

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                      |
| --------------- | ------------------------------------------ |
| Issue ID        | C1-009                                     |
| Title           | Add request validation middleware with Zod |
| Area            | API                                        |
| Difficulty      | Medium                                     |
| Labels          | backend, validation, medium                |
| Dependencies    | None                                       |
| Estimated Lines | 100-150                                    |

## Overview

This issue creates validation middleware that integrates Zod schemas with Elysia's request lifecycle. The middleware validates incoming data and provides type-safe access to validated values in route handlers.

## Prerequisites

- Understanding of Elysia middleware/plugin system
- Familiarity with Zod schemas
- Knowledge of HTTP status codes

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd apps/api
bun add zod
```

### Step 2: Create Validation Middleware

Create `apps/api/src/middleware/validation.ts`:

```typescript
import { Elysia, t } from "elysia";
import { z, ZodSchema, ZodError } from "zod";

/**
 * Format Zod errors into a structured response
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Create validation error response
 */
function createValidationError(
  errors: Record<string, string[]>,
  source: "body" | "query" | "params",
) {
  return {
    status: 400,
    code: "VALIDATION_ERROR",
    message: `Invalid ${source} parameters`,
    details: {
      source,
      errors,
    },
  };
}

/**
 * Body validation plugin
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: "validate-body" })
    .derive(async ({ request, set }) => {
      try {
        const body = await request.json();
        const result = schema.safeParse(body);

        if (!result.success) {
          set.status = 400;
          return {
            validatedBody: null as z.infer<T> | null,
            validationError: createValidationError(
              formatZodErrors(result.error),
              "body",
            ),
          };
        }

        return {
          validatedBody: result.data as z.infer<T>,
          validationError: null,
        };
      } catch {
        set.status = 400;
        return {
          validatedBody: null as z.infer<T> | null,
          validationError: {
            status: 400,
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        };
      }
    })
    .onBeforeHandle(({ validationError, set }) => {
      if (validationError) {
        set.status = 400;
        return validationError;
      }
    });
}

/**
 * Query validation plugin
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: "validate-query" })
    .derive(({ query, set }) => {
      const result = schema.safeParse(query);

      if (!result.success) {
        return {
          validatedQuery: null as z.infer<T> | null,
          queryValidationError: createValidationError(
            formatZodErrors(result.error),
            "query",
          ),
        };
      }

      return {
        validatedQuery: result.data as z.infer<T>,
        queryValidationError: null,
      };
    })
    .onBeforeHandle(({ queryValidationError, set }) => {
      if (queryValidationError) {
        set.status = 400;
        return queryValidationError;
      }
    });
}

/**
 * Path params validation plugin
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: "validate-params" })
    .derive(({ params, set }) => {
      const result = schema.safeParse(params);

      if (!result.success) {
        return {
          validatedParams: null as z.infer<T> | null,
          paramsValidationError: createValidationError(
            formatZodErrors(result.error),
            "params",
          ),
        };
      }

      return {
        validatedParams: result.data as z.infer<T>,
        paramsValidationError: null,
      };
    })
    .onBeforeHandle(({ paramsValidationError, set }) => {
      if (paramsValidationError) {
        set.status = 400;
        return paramsValidationError;
      }
    });
}

/**
 * Combined validation plugin for body, query, and params
 */
export function validate<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
  TParams extends ZodSchema | undefined = undefined,
>(options: { body?: TBody; query?: TQuery; params?: TParams }) {
  return new Elysia({ name: "validate" })
    .derive(async ({ request, query, params, set }) => {
      const result: {
        validatedBody: TBody extends ZodSchema ? z.infer<TBody> : undefined;
        validatedQuery: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
        validatedParams: TParams extends ZodSchema
          ? z.infer<TParams>
          : undefined;
        validationError: any;
      } = {
        validatedBody: undefined as any,
        validatedQuery: undefined as any,
        validatedParams: undefined as any,
        validationError: null,
      };

      // Validate body
      if (options.body) {
        try {
          const body = await request.clone().json();
          const bodyResult = options.body.safeParse(body);

          if (!bodyResult.success) {
            result.validationError = createValidationError(
              formatZodErrors(bodyResult.error),
              "body",
            );
            return result;
          }

          result.validatedBody = bodyResult.data;
        } catch {
          result.validationError = {
            status: 400,
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          };
          return result;
        }
      }

      // Validate query
      if (options.query) {
        const queryResult = options.query.safeParse(query);

        if (!queryResult.success) {
          result.validationError = createValidationError(
            formatZodErrors(queryResult.error),
            "query",
          );
          return result;
        }

        result.validatedQuery = queryResult.data;
      }

      // Validate params
      if (options.params) {
        const paramsResult = options.params.safeParse(params);

        if (!paramsResult.success) {
          result.validationError = createValidationError(
            formatZodErrors(paramsResult.error),
            "params",
          );
          return result;
        }

        result.validatedParams = paramsResult.data;
      }

      return result;
    })
    .onBeforeHandle(({ validationError, set }) => {
      if (validationError) {
        set.status = 400;
        return validationError;
      }
    });
}

/**
 * UUID param schema (commonly used)
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid UUID format"),
});

/**
 * Pagination query schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
```

### Step 3: Update Middleware Index

Update `apps/api/src/middleware/index.ts`:

```typescript
export { errorHandler } from "./errorHandler";
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  uuidParamSchema,
  paginationQuerySchema,
} from "./validation";
```

### Step 4: Apply Validation to Routes

Update `apps/api/src/routes/properties.ts`:

```typescript
import { Elysia } from "elysia";
import { z } from "zod";
import {
  validate,
  uuidParamSchema,
  paginationQuerySchema,
} from "../middleware";
import { PropertyController } from "../controllers/PropertyController";

// Property query schema extending pagination
const propertyQuerySchema = paginationQuerySchema.extend({
  propertyType: z
    .enum(["residential", "commercial", "industrial", "land", "mixed"])
    .optional(),
  country: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  verified: z.coerce.boolean().optional(),
  owner: z.string().length(56).optional(),
});

// Create property body schema
const createPropertySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(10),
  propertyType: z.enum([
    "residential",
    "commercial",
    "industrial",
    "land",
    "mixed",
  ]),
  location: z.object({
    address: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().optional(),
  }),
  totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  totalShares: z.number().int().positive(),
  pricePerShare: z.string().regex(/^\d+(\.\d{1,2})?$/),
  images: z.array(z.string().url()).min(1),
});

// Update property body schema
const updatePropertySchema = createPropertySchema.partial();

// Buy shares body schema
const buySharesSchema = z.object({
  shares: z.number().int().positive(),
});

export const propertyRoutes = new Elysia({ prefix: "/properties" })
  // GET /properties - list with filters
  .use(validate({ query: propertyQuerySchema }))
  .get("/", async ({ validatedQuery }) => {
    return PropertyController.getAll(validatedQuery);
  })

  // GET /properties/:id - get single property
  .use(validate({ params: uuidParamSchema }))
  .get("/:id", async ({ validatedParams }) => {
    return PropertyController.getById(validatedParams.id);
  })

  // POST /properties - create property
  .use(validate({ body: createPropertySchema }))
  .post("/", async ({ validatedBody, headers }) => {
    const userId = headers["x-user-id"];
    return PropertyController.create(validatedBody, userId);
  })

  // PUT /properties/:id - update property
  .use(validate({ params: uuidParamSchema, body: updatePropertySchema }))
  .put("/:id", async ({ validatedParams, validatedBody, headers }) => {
    const userId = headers["x-user-id"];
    return PropertyController.update(validatedParams.id, validatedBody, userId);
  })

  // DELETE /properties/:id - delete property
  .use(validate({ params: uuidParamSchema }))
  .delete("/:id", async ({ validatedParams, headers }) => {
    const userId = headers["x-user-id"];
    return PropertyController.delete(validatedParams.id, userId);
  })

  // POST /properties/:id/buy-shares - buy property shares
  .use(validate({ params: uuidParamSchema, body: buySharesSchema }))
  .post(
    "/:id/buy-shares",
    async ({ validatedParams, validatedBody, headers }) => {
      const userId = headers["x-user-id"];
      return PropertyController.buyShares(
        validatedParams.id,
        validatedBody.shares,
        userId,
      );
    },
  );
```

## Usage Example

```typescript
import { Elysia } from "elysia";
import { z } from "zod";
import { validate } from "./middleware";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  age: z.number().int().positive().optional(),
});

const app = new Elysia()
  .use(validate({ body: userSchema }))
  .post("/users", ({ validatedBody }) => {
    // validatedBody is fully typed as { email: string; name: string; age?: number }
    return {
      message: `Created user ${validatedBody.name}`,
      email: validatedBody.email,
    };
  });
```

## Testing Guidelines

### Test Example

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("Validation Middleware", () => {
  it("should reject invalid body", async () => {
    const response = await app.handle(
      new Request("http://localhost/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }), // name too short
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.errors.name).toBeDefined();
  });

  it("should pass valid body", async () => {
    const response = await app.handle(
      new Request("http://localhost/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "test-user-id",
        },
        body: JSON.stringify({
          name: "Test Property",
          description: "A test property description",
          propertyType: "residential",
          location: {
            address: "123 Test St",
            city: "Test City",
            country: "US",
          },
          totalValue: "100000.00",
          totalShares: 100,
          pricePerShare: "1000.00",
          images: ["https://example.com/image.jpg"],
        }),
      }),
    );

    expect(response.status).toBe(201);
  });
});
```

## Related Resources

| Resource          | Link                                        |
| ----------------- | ------------------------------------------- |
| Zod Documentation | https://zod.dev                             |
| Elysia Lifecycle  | https://elysiajs.com/concept/lifecycle.html |
| Elysia Plugin     | https://elysiajs.com/concept/plugin.html    |

## Verification Checklist

| Item                          | Status |
| ----------------------------- | ------ |
| Validation middleware created |        |
| Body validation working       |        |
| Query validation working      |        |
| Params validation working     |        |
| Error format consistent       |        |
| Type inference working        |        |
| Tests passing                 |        |
