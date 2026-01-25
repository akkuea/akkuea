import { AppError } from "./AppError";
import { ErrorCode } from "./codes";

/**
 * Validation error with field-level details
 */
export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
}

export class ValidationError extends AppError {
  public readonly fieldErrors: FieldError[];

  constructor(message: string, fieldErrors: FieldError[] = []) {
    super(ErrorCode.VALIDATION_ERROR, message, { fieldErrors });
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }

  static fromFields(fieldErrors: FieldError[]): ValidationError {
    const message =
      fieldErrors.length === 1
        ? fieldErrors[0].message
        : `Validation failed for ${fieldErrors.length} fields`;
    return new ValidationError(message, fieldErrors);
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, { resource, identifier });
    this.name = "NotFoundError";
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(ErrorCode.UNAUTHORIZED, message);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(ErrorCode.FORBIDDEN, message);
    this.name = "AuthorizationError";
  }
}

/**
 * Conflict error (duplicate, already exists)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CONFLICT, message, details);
    this.name = "ConflictError";
  }
}

/**
 * Business logic error
 */
export class BusinessError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, details);
    this.name = "BusinessError";
  }
}

/**
 * Blockchain/transaction error
 */
export class BlockchainError extends AppError {
  public readonly transactionHash?: string;

  constructor(
    message: string,
    transactionHash?: string,
    details?: Record<string, unknown>,
  ) {
    super(ErrorCode.TRANSACTION_FAILED, message, {
      ...details,
      transactionHash,
    });
    this.name = "BlockchainError";
    this.transactionHash = transactionHash;
  }
}

/**
 * Network/timeout error
 */
export class NetworkError extends AppError {
  constructor(message: string = "Network request failed") {
    super(ErrorCode.NETWORK_ERROR, message);
    this.name = "NetworkError";
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `Too many requests. Retry after ${retryAfter} seconds`
      : "Too many requests";
    super(ErrorCode.RATE_LIMITED, message, { retryAfter });
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
