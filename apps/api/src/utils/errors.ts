// No unused imports
import { ApiError } from '../errors/ApiError';
import { AppError as SharedAppError, ValidationError as SharedValidationError } from '@akkuea/shared';
import { ZodError } from 'zod';
import { logger } from '../services/logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export function handleError(error: unknown): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (
    error instanceof ApiError ||
    error instanceof AppError ||
    error instanceof SharedAppError ||
    error instanceof SharedValidationError ||
    error instanceof ZodError
  ) {
    return {
      success: false,
      error: error instanceof ZodError ? 'VALIDATION_ERROR' : error.code,
      message: error.message,
      statusCode:
        error instanceof ApiError || error instanceof AppError
          ? error.statusCode
          : error instanceof ZodError
            ? 400
            : error.status,
      timestamp,
    };
  }

  logger.error('Unhandled API error', error instanceof Error ? error : new Error(String(error)));

  return {
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp,
  };
}
