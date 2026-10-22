import { Elysia } from 'elysia';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '../services/logger';

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
  source: 'body' | 'query' | 'params',
): {
  success: false;
  error: 'VALIDATION_ERROR';
  code: 'VALIDATION_ERROR';
  message: string;
  statusCode: 400;
  details: { source: 'body' | 'query' | 'params'; errors: Record<string, string[]> };
} {
  // Same envelope `handleError` returns for an ApiError, so a validation
  // failure looks the same whether the schema rejected the request or a
  // controller threw: `error` carries the code and `success` is false.
  return {
    success: false,
    error: 'VALIDATION_ERROR',
    code: 'VALIDATION_ERROR',
    message: `Invalid ${source} parameters`,
    statusCode: 400,
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
    .resolve({ as: 'scoped' }, ({ body }: { body: unknown }) => {
      try {
        const result = schema.safeParse(body);

        if (!result.success) {
          return {
            validatedBody: null as z.infer<T> | null,
            bodyValidationError: createValidationError(formatZodErrors(result.error), 'body'),
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
            success: false,
            error: 'INVALID_JSON',
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
            statusCode: 400,
          },
        };
      }
    })
    .onBeforeHandle(
      { as: 'scoped' },
      ({
        bodyValidationError,
        set,
      }: {
        bodyValidationError:
          | ReturnType<typeof createValidationError>
          | { success: false; error: string; code: string; message: string; statusCode: number }
          | null;
        set: { status?: number | string };
      }) => {
        if (bodyValidationError) {
          set.status = 400;
          return bodyValidationError;
        }
      },
    );
}

/**
 * Query validation plugin using Elysia's derive pattern
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: 'validate-query' })
    .resolve({ as: 'scoped' }, ({ query }: { query: Record<string, string | undefined> }) => {
      const result = schema.safeParse(query);

      if (!result.success) {
        return {
          validatedQuery: null as z.infer<T> | null,
          queryValidationError: createValidationError(formatZodErrors(result.error), 'query'),
        };
      }

      return {
        validatedQuery: result.data as z.infer<T>,
        queryValidationError: null as null,
      };
    })
    .onBeforeHandle(
      { as: 'scoped' },
      ({
        queryValidationError,
        set,
      }: {
        queryValidationError: ReturnType<typeof createValidationError> | null;
        set: { status?: number | string };
      }) => {
        if (queryValidationError) {
          set.status = 400;
          return queryValidationError;
        }
      },
    );
}

/**
 * Path params validation plugin using Elysia's derive pattern
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return new Elysia({ name: 'validate-params' })
    .resolve({ as: 'scoped' }, ({ params }: { params: Record<string, string | undefined> }) => {
      const result = schema.safeParse(params);

      if (!result.success) {
        return {
          validatedParams: null as z.infer<T> | null,
          paramsValidationError: createValidationError(formatZodErrors(result.error), 'params'),
        };
      }

      return {
        validatedParams: result.data as z.infer<T>,
        paramsValidationError: null as null,
      };
    })
    .onBeforeHandle(
      { as: 'scoped' },
      ({
        paramsValidationError,
        set,
      }: {
        paramsValidationError: ReturnType<typeof createValidationError> | null;
        set: { status?: number | string };
      }) => {
        if (paramsValidationError) {
          set.status = 400;
          return paramsValidationError;
        }
      },
    );
}

/**
 * Monotonic counter backing the per-call `seed`. Elysia deduplicates plugins
 * by `name` + `seed`, so without a unique seed two `validate()` calls in the
 * same instance collapse into one plugin and the first schema silently wins.
 * A counter is unique per call, unlike a seed derived from schema key names,
 * which collides for two different schemas that share the same keys.
 */
let validateSeq = 0;

/**
 * Combined validation plugin for body, query, and params
 * Uses Elysia's derive pattern for type-safe validated data access
 *
 * Each call is its own plugin, and callers register it inside a group next to
 * the single route it guards. A scoped hook added with `.use()` at instance
 * level would otherwise apply to every route registered after it.
 */
export function validate<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
  TParams extends ZodSchema | undefined = undefined,
>(options: { body?: TBody; query?: TQuery; params?: TParams }) {
  return new Elysia({ name: 'validate', seed: ++validateSeq })
    .resolve(
      { as: 'scoped' },
      ({
        body,
        query,
        params,
      }: {
        body: unknown;
        query: Record<string, string | undefined>;
        params: Record<string, string | undefined>;
      }) => {
        const result: {
          validatedBody: TBody extends ZodSchema ? z.infer<TBody> : undefined;
          validatedQuery: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
          validatedParams: TParams extends ZodSchema ? z.infer<TParams> : undefined;
          validationError:
            | ReturnType<typeof createValidationError>
            | { success: false; error: string; code: string; message: string; statusCode: number }
            | null;
        } = {
          validatedBody: undefined as TBody extends ZodSchema ? z.infer<TBody> : undefined,
          validatedQuery: undefined as TQuery extends ZodSchema ? z.infer<TQuery> : undefined,
          validatedParams: undefined as TParams extends ZodSchema ? z.infer<TParams> : undefined,
          validationError: null,
        };

        // Validate body
        if (options.body) {
          try {
            const bodyResult = options.body.safeParse(body);

            if (!bodyResult.success) {
              result.validationError = createValidationError(
                formatZodErrors(bodyResult.error),
                'body',
              );
              return result;
            }

            result.validatedBody = bodyResult.data;
          } catch (e) {
            logger.error('Error parsing JSON body', e);
            result.validationError = {
              success: false,
              error: 'INVALID_JSON',
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON',
              statusCode: 400,
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
              'query',
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
              'params',
            );
            return result;
          }

          result.validatedParams = paramsResult.data;
        }

        return result;
      },
    )
    .onBeforeHandle(
      { as: 'scoped' },
      ({
        validationError,
        set,
      }: {
        validationError:
          | ReturnType<typeof createValidationError>
          | { success: false; error: string; code: string; message: string; statusCode: number }
          | null;
        set: { status?: number | string };
      }) => {
        if (validationError) {
          set.status = 400;
          return validationError;
        }
      },
    );
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
