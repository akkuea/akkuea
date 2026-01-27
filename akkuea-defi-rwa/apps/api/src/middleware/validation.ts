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
 * Combined validation helper
 * Returns a hook object for use in route-local options
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
  return {
    // Route-level hook for context injection is transform
    transform: async ({ body, query, params, request }: any) => {
      const result: any = {
        validatedBody: undefined,
        validatedQuery: undefined,
        validatedParams: undefined,
        validationError: null,
      };

      // Validate body
      if (options.body) {
        try {
          let bodyToValidate = body;
          if (!bodyToValidate || bodyToValidate instanceof ReadableStream) {
            try {
              bodyToValidate = await request.clone().json();
            } catch {
              result.validationError = {
                status: 400,
                code: 'INVALID_JSON',
                message: 'Request body must be valid JSON',
              };
              return result;
            }
          }

          const bodyResult = options.body.safeParse(bodyToValidate);
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
    },

    // Route-level hook for interception
    beforeHandle: ({ validationError, set }: any) => {
      if (validationError) {
        set.status = 400;
        return validationError;
      }
    }
  };
}

export const validateBody = (schema: ZodSchema) => validate({ body: schema });
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });
export const validateParams = (schema: ZodSchema) => validate({ params: schema });

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
