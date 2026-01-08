import { Elysia } from 'elysia';

export const errorHandler = new Elysia().onError(({ error, code, set }) => {
  if (code === 'VALIDATION') {
    set.status = 400;
    return {
      success: false,
      error: 'Validation Error',
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }

  if (code === 'NOT_FOUND') {
    set.status = 404;
    return {
      success: false,
      error: 'Not Found',
      message: 'The requested resource was not found',
      timestamp: new Date().toISOString(),
    };
  }

  if (code === 'INTERNAL_SERVER_ERROR') {
    set.status = 500;
    return {
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    };
  }

  // Default error handler
  set.status = 500;
  return {
    success: false,
    error: 'Server Error',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };
});
