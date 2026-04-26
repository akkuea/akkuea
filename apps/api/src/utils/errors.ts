// No unused imports
import { ApiError } from '../errors/ApiError';

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

  if (error instanceof ApiError) {
    return {
      success: false,
      error: error.code,
      message: error.message,
      statusCode: error.statusCode,
      timestamp,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;
  const code = err?.code ?? err?.errorCode ?? 'INTERNAL_ERROR';
  const statusCode = Number(err?.status ?? err?.statusCode ?? 500);
  const message = err?.message ?? 'An unexpected error occurred';

  // If it's something that looks like our app errors (from local or shared)
  if (err && typeof err === 'object' && ('code' in err || 'errorCode' in err)) {
    if (process.env.CI) {
      console.error('[CI-DEBUG] Handled AppError:', { code, statusCode, message });
    }
    return {
      success: false,
      error: String(code),
      message: String(message),
      statusCode: statusCode <= 0 ? 500 : statusCode,
      timestamp,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message,
      statusCode: 500,
      timestamp,
    };
  }

  return {
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp,
  };
}
