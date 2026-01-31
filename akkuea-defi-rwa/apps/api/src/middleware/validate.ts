import { Elysia } from 'elysia';
import { z } from 'zod';
/**
 * UUID parameter validation schema
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

/**
 * Elysia validation middleware plugin
 *
 * Usage:
 *   .use(validate({ body: mySchema }))
 *   .use(validate({ params: myParamSchema }))
 */
export function validate(schemas: {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
}) {
  return new Elysia().onBeforeHandle(async ({ body, params, set }) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(body);
      if (!result.success) {
        const errorMessages = result.error.issues
          .map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        set.status = 400;
        return {
          error: 'VALIDATION_ERROR',
          message: errorMessages,
          details: result.error.issues,
        };
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(params);
      if (!result.success) {
        const errorMessages = result.error.issues
          .map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        set.status = 400;
        return {
          error: 'INVALID_PARAMS',
          message: errorMessages,
          details: result.error.issues,
        };
      }
    }
  });
}
