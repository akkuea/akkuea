import { Elysia } from 'elysia';
import { handleError } from '../utils/errors';

export const errorHandler = new Elysia().onError({ as: 'global' }, ({ error, code, set }) => {
  // ✅ Handle validation errors FIRST (DO NOT override shape)
  if (code === 'VALIDATION') {
    set.status = 400;

    return {
      success: false,
      error: 'VALIDATION_ERROR',
      code: 'VALIDATION_ERROR',
      message: 'Validation Error',
      details: {
        source: 'unknown',
        errors: {},
      },
    };
  }

  const result = handleError(error);

  set.status = result.statusCode;

  return {
    success: result.success,
    error: result.error,
    code: result.error, // ✅ unify both
    message: result.message,
    statusCode: result.statusCode,
    timestamp: result.timestamp,
  };
});
