import { Elysia } from 'elysia';
import { ApiError } from '../errors/ApiError';

export const errorHandler = new Elysia().onError(({ error, code, set }) => {
  // Handle custom ApiError instances
  if (error instanceof ApiError) {
    set.status = error.statusCode;
    return {
      success: false,
      error: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
    };
  }

  if (code === 'VALIDATION') {
    set.status = 400;
    return {
      success: false,
      error: 'Validation Error',
      message: error instanceof Error ? error.message : String(error),
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
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };
});
