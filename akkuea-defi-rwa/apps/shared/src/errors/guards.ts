import { AppError, SerializedError } from "./AppError";
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  BlockchainError,
  RateLimitError,
} from "./types";
import { ErrorCode } from "./codes";

/**
 * Check if value is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if value is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if value is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Check if value is an AuthenticationError
 */
export function isAuthenticationError(
  error: unknown,
): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Check if value is an AuthorizationError
 */
export function isAuthorizationError(
  error: unknown,
): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * Check if value is a BlockchainError
 */
export function isBlockchainError(error: unknown): error is BlockchainError {
  return error instanceof BlockchainError;
}

/**
 * Check if value is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Check if error has specific code
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  return isAppError(error) && error.code === code;
}

/**
 * Check if serialized object is an error response
 */
export function isSerializedError(obj: unknown): obj is SerializedError {
  if (typeof obj !== "object" || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.status === "number"
  );
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(ErrorCode.INTERNAL_ERROR, error.message);
  }

  if (typeof error === "string") {
    return new AppError(ErrorCode.INTERNAL_ERROR, error);
  }

  if (isSerializedError(error)) {
    return AppError.fromJSON(error);
  }

  return new AppError(ErrorCode.UNKNOWN, "An unknown error occurred");
}
