import {
  InvalidCookieSignature,
  InvalidFileType,
  NotFoundError as ElysiaNotFoundError,
  ParseError,
  ValidationError as ElysiaValidationError,
} from 'elysia';
import { AppError as SharedAppError } from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
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

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Errors Elysia raises itself while reading and routing a request (schema
 * validation, body parsing, unknown routes, signed cookies, file types). Their
 * messages describe the client's request, not server internals.
 */
type ElysiaRequestError =
  | ElysiaValidationError
  | ParseError
  | ElysiaNotFoundError
  | InvalidCookieSignature
  | InvalidFileType;

function isElysiaRequestError(error: unknown): error is ElysiaRequestError {
  return (
    error instanceof ElysiaValidationError ||
    error instanceof ParseError ||
    error instanceof ElysiaNotFoundError ||
    error instanceof InvalidCookieSignature ||
    error instanceof InvalidFileType
  );
}

/** Keeps a known error's status, falling back to 500 for anything outside 4xx and 5xx. */
function toErrorStatus(status: number): number {
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

/** The driver or library code on an unknown error (for example a Postgres SQLSTATE), for logs only. */
function readErrorCode(error: object): string | undefined {
  const code: unknown = 'code' in error ? error.code : undefined;
  return code === undefined || code === null ? undefined : String(code);
}

function describeThrownValue(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Logs everything about an error the client will not see, so the generic
 * response can still be traced back to its cause.
 */
function logUnknownError(error: unknown): void {
  const message = 'Unhandled error while processing a request';
  if (error instanceof Error) {
    logger.error(message, error, { code: readErrorCode(error) });
    return;
  }
  logger.error(message, {
    thrownType: typeof error,
    code: typeof error === 'object' && error !== null ? readErrorCode(error) : undefined,
    thrown: describeThrownValue(error),
  });
}

/**
 * Converts anything thrown while handling a request into the API's error
 * envelope.
 *
 * Only errors the API raises on purpose keep their message, code, and status:
 * `ApiError`, the `AppError` classes in this file, the shared package's
 * `AppError` classes, and Elysia's request errors (validation, parsing, unknown
 * route). Everything else, including plain `Error`s and driver errors that
 * carry a `code` (such as Postgres `23505` or `42P01`), can contain SQL text or
 * other internals: it is logged in full server-side and the client receives a
 * generic 500 `INTERNAL_ERROR`.
 */
export function handleError(error: unknown): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError || error instanceof AppError) {
    return {
      success: false,
      error: error.code,
      message: error.message,
      statusCode: toErrorStatus(error.statusCode),
      timestamp,
    };
  }

  if (error instanceof SharedAppError || isElysiaRequestError(error)) {
    return {
      success: false,
      error: String(error.code),
      message: error.message,
      statusCode: toErrorStatus(error.status),
      timestamp,
    };
  }

  logUnknownError(error);

  return {
    success: false,
    error: 'INTERNAL_ERROR',
    message: GENERIC_ERROR_MESSAGE,
    statusCode: 500,
    timestamp,
  };
}
