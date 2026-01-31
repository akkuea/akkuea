import { Elysia } from 'elysia';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Format Zod errors into a structured response
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
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
  source: 'body' | 'query' | 'params'
) {
  return {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: `Invalid ${source} parameters`,
    details: {
      source,
      errors,
    },
  };
}

/**
 * Body validation plugin using Elysia's derive pattern
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: 'validate-body' })
    .derive({ as: 'scoped' }, async ({ request }) => {
      try {
        const body = await request.clone().json();
        const result = schema.safeParse(body);

        if (!result.success) {
          return {
            validatedBody: null as z.infer<T> | null,
            bodyValidationError: createValidationError(
              formatZodErrors(result.error),
              'body'
            ),
          };
        }

        return {
          validatedBody: result.data as z.infer<T>,
          bodyValidationError: null as null,
        };
      } catch {
        return {
          validatedBody: null as z.infer<T> | null,
          bodyValidationError: {
            status: 400,
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          } as const,
        };
      }
    })
    .onBeforeHandle({ as: 'scoped' }, ({ bodyValidationError, set }) => {
      if (bodyValidationError) {
        set.status = 400;
        return bodyValidationError;
      }
    });
}

/**
 * Query validation plugin using Elysia's derive pattern
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: 'validate-query' })
    .derive({ as: 'scoped' }, ({ query }) => {
      const result = schema.safeParse(query);

      if (!result.success) {
        return {
          validatedQuery: null as z.infer<T> | null,
          queryValidationError: createValidationError(
            formatZodErrors(result.error),
            'query'
          ),
        };
      }

      return {
        validatedQuery: result.data as z.infer<T>,
        queryValidationError: null as null,
      };
    })
    .onBeforeHandle({ as: 'scoped' }, ({ queryValidationError, set }) => {
      if (queryValidationError) {
        set.status = 400;
        return queryValidationError;
      }
    });
}

/**
 * Path params validation plugin using Elysia's derive pattern
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: 'validate-params' })
    .derive({ as: 'scoped' }, ({ params }) => {
      const result = schema.safeParse(params);

      if (!result.success) {
        return {
          validatedParams: null as z.infer<T> | null,
          paramsValidationError: createValidationError(
            formatZodErrors(result.error),
            'params'
          ),
        };
      }

      return {
        validatedParams: result.data as z.infer<T>,
        paramsValidationError: null as null,
      };
    })
    .onBeforeHandle({ as: 'scoped' }, ({ paramsValidationError, set }) => {
      if (paramsValidationError) {
        set.status = 400;
        return paramsValidationError;
      }
    });
}

/**
 * Combined validation plugin for body, query, and params
 * Uses Elysia's derive pattern for type-safe validated data access
 */
export function validate<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
  TParams extends ZodSchema | undefined = undefined,
>(options: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}) {
  return new Elysia({ name: 'validate' })
    .derive({ as: 'scoped' }, async ({ request, query, params }) => {
      const result: {
        validatedBody: TBody extends ZodSchema ? z.infer<TBody> : undefined;
        validatedQuery: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
        validatedParams: TParams extends ZodSchema ? z.infer<TParams> : undefined;
        validationError: ReturnType<typeof createValidationError> | { status: number; code: string; message: string } | null;
      } = {
        validatedBody: undefined as TBody extends ZodSchema ? z.infer<TBody> : undefined,
        validatedQuery: undefined as TQuery extends ZodSchema ? z.infer<TQuery> : undefined,
        validatedParams: undefined as TParams extends ZodSchema ? z.infer<TParams> : undefined,
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
              'body'
            );
            return result;
          }

          result.validatedBody = bodyResult.data;
        } catch {
          result.validationError = {
            status: 400,
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
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
            'query'
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
            'params'
          );
          return result;
        }

        result.validatedParams = paramsResult.data;
      }

      return result;
    })
    .onBeforeHandle({ as: 'scoped' }, ({ validationError, set }) => {
      if (validationError) {
        set.status = 400;
        return validationError;
      }
    });
}

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schema for property shares owner param validation
 */
export const ownerParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  owner: z.string().min(1, 'Owner address is required'),
});
