# C1-006: Add Error Types and Error Handling Utilities

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                        |
| --------------- | -------------------------------------------- |
| Issue ID        | C1-006                                       |
| Title           | Add error types and error handling utilities |
| Area            | SHARED                                       |
| Difficulty      | Medium                                       |
| Labels          | shared, error-handling, medium               |
| Dependencies    | None                                         |
| Estimated Lines | 100-150                                      |

## Overview

Centralized error handling ensures consistent error responses across the API and meaningful error messages in the webapp. This implementation creates a type-safe error system with proper serialization.

## Prerequisites

- Understanding of TypeScript error handling
- Knowledge of HTTP status codes

## Implementation Steps

### Step 1: Define Error Codes

Create `apps/shared/src/errors/codes.ts`:

```typescript
/**
 * Standard error codes for the application
 */
export enum ErrorCode {
  // General errors (1xxx)
  UNKNOWN = "E1000",
  INTERNAL_ERROR = "E1001",
  SERVICE_UNAVAILABLE = "E1002",
  TIMEOUT = "E1003",

  // Validation errors (2xxx)
  VALIDATION_ERROR = "E2000",
  INVALID_INPUT = "E2001",
  MISSING_FIELD = "E2002",
  INVALID_FORMAT = "E2003",

  // Authentication errors (3xxx)
  UNAUTHORIZED = "E3000",
  INVALID_TOKEN = "E3001",
  TOKEN_EXPIRED = "E3002",
  WALLET_NOT_CONNECTED = "E3003",

  // Authorization errors (4xxx)
  FORBIDDEN = "E4000",
  INSUFFICIENT_PERMISSIONS = "E4001",
  KYC_REQUIRED = "E4002",
  KYC_PENDING = "E4003",

  // Resource errors (5xxx)
  NOT_FOUND = "E5000",
  ALREADY_EXISTS = "E5001",
  CONFLICT = "E5002",

  // Business logic errors (6xxx)
  INSUFFICIENT_BALANCE = "E6000",
  INSUFFICIENT_SHARES = "E6001",
  PROPERTY_NOT_TOKENIZED = "E6002",
  POOL_PAUSED = "E6003",
  POSITION_UNHEALTHY = "E6004",
  INVALID_AMOUNT = "E6005",

  // Blockchain errors (7xxx)
  TRANSACTION_FAILED = "E7000",
  CONTRACT_ERROR = "E7001",
  NETWORK_ERROR = "E7002",
  SIGNATURE_INVALID = "E7003",

  // Rate limiting (8xxx)
  RATE_LIMITED = "E8000",
  TOO_MANY_REQUESTS = "E8001",
}

/**
 * HTTP status codes mapped to error codes
 */
export const errorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNKNOWN]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TIMEOUT]: 504,

  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,

  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.WALLET_NOT_CONNECTED]: 401,

  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.KYC_REQUIRED]: 403,
  [ErrorCode.KYC_PENDING]: 403,

  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,

  [ErrorCode.INSUFFICIENT_BALANCE]: 400,
  [ErrorCode.INSUFFICIENT_SHARES]: 400,
  [ErrorCode.PROPERTY_NOT_TOKENIZED]: 400,
  [ErrorCode.POOL_PAUSED]: 400,
  [ErrorCode.POSITION_UNHEALTHY]: 400,
  [ErrorCode.INVALID_AMOUNT]: 400,

  [ErrorCode.TRANSACTION_FAILED]: 500,
  [ErrorCode.CONTRACT_ERROR]: 500,
  [ErrorCode.NETWORK_ERROR]: 502,
  [ErrorCode.SIGNATURE_INVALID]: 400,

  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
};
```

### Step 2: Create Base Error Class

Create `apps/shared/src/errors/AppError.ts`:

```typescript
import { ErrorCode, errorCodeToStatus } from "./codes";

/**
 * Serialized error format
 */
export interface SerializedError {
  code: ErrorCode | string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode | string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;
  public requestId?: string;

  constructor(
    code: ErrorCode | string,
    message: string,
    details?: Record<string, unknown>,
    status?: number,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Determine status from code if not provided
    if (status !== undefined) {
      this.status = status;
    } else if (code in errorCodeToStatus) {
      this.status = errorCodeToStatus[code as ErrorCode];
    } else {
      this.status = 500;
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error for API response
   */
  toJSON(): SerializedError {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId,
    };
  }

  /**
   * Create error from serialized format
   */
  static fromJSON(json: SerializedError): AppError {
    const error = new AppError(
      json.code,
      json.message,
      json.details,
      json.status,
    );
    error.requestId = json.requestId;
    return error;
  }

  /**
   * Set request ID for tracing
   */
  withRequestId(requestId: string): this {
    this.requestId = requestId;
    return this;
  }
}
```

### Step 3: Create Specific Error Types

Create `apps/shared/src/errors/types.ts`:

```typescript
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
```

### Step 4: Create Type Guards

Create `apps/shared/src/errors/guards.ts`:

```typescript
import { AppError, SerializedError } from "./AppError";
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  BusinessError,
  BlockchainError,
  NetworkError,
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
```

### Step 5: Create Error Index

Create `apps/shared/src/errors/index.ts`:

```typescript
// Base error
export { AppError, type SerializedError } from "./AppError";

// Error codes
export { ErrorCode, errorCodeToStatus } from "./codes";

// Specific error types
export {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  BusinessError,
  BlockchainError,
  NetworkError,
  RateLimitError,
  type FieldError,
} from "./types";

// Type guards
export {
  isAppError,
  isValidationError,
  isNotFoundError,
  isAuthenticationError,
  isAuthorizationError,
  isBlockchainError,
  isRateLimitError,
  hasErrorCode,
  isSerializedError,
  toAppError,
} from "./guards";
```

### Step 6: Update Main Index

Update `apps/shared/src/index.ts`:

```typescript
// Types
export * from "./types";

// Schemas
export * from "./schemas";

// Errors
export * from "./errors";

// Utils
export * from "./utils";

// Constants
export * from "./constants";
```

## Usage Examples

### In API

```typescript
import { ValidationError, NotFoundError, isAppError } from "@akkuea/shared";

// Throwing validation error
if (!input.email) {
  throw ValidationError.fromFields([
    { field: "email", message: "Email is required" },
  ]);
}

// Throwing not found error
const user = await userRepository.findById(id);
if (!user) {
  throw new NotFoundError("User", id);
}

// Error handler middleware
app.onError(({ error, set }) => {
  if (isAppError(error)) {
    set.status = error.status;
    return error.toJSON();
  }
  return { code: "E1000", message: "Internal server error", status: 500 };
});
```

### In Webapp

```typescript
import { isValidationError, isNotFoundError, toAppError } from "@akkuea/shared";

try {
  await propertyApi.create(data);
} catch (error) {
  const appError = toAppError(error);

  if (isValidationError(appError)) {
    // Show field errors
    appError.fieldErrors.forEach((fe) => {
      setFieldError(fe.field, fe.message);
    });
  } else if (isNotFoundError(appError)) {
    // Show not found message
    showNotFound(appError.message);
  } else {
    // Generic error handling
    showError(appError.message);
  }
}
```

## Related Resources

| Resource                      | Link                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| TypeScript Error Handling     | https://www.typescriptlang.org/docs/handbook/2/narrowing.html               |
| Error Handling Best Practices | https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript |

## Verification Checklist

| Item                         | Status |
| ---------------------------- | ------ |
| Error codes defined          |        |
| Base error class created     |        |
| Specific error types created |        |
| Type guards implemented      |        |
| Serialization working        |        |
| Tests passing                |        |
