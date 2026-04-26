import { Elysia } from 'elysia';
import { handleError } from '../utils/errors';

/**
 * Global error handler for Elysia.
 * Reuses the robust handleError logic from utils/errors.
 */
export const errorHandler = new Elysia().onError({ as: 'global' }, ({ error, code, set }) => {
  const result = handleError(error);
  
  // Ensure VALIDATION errors from Elysia/Zod are returned as 400
  if (code === 'VALIDATION') {
    set.status = 400;
    return {
      ...result,
      error: 'Validation Error',
      statusCode: 400
    };
  }

  // Handle specific Elysia error codes if necessary
  if (code === 'NOT_FOUND' && result.statusCode === 500) {
    set.status = 404;
    return {
      ...result,
      error: 'Not Found',
      statusCode: 404
    };
  }

  set.status = result.statusCode;
  return result;
});
