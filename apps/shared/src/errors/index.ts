// Base error
export { AppError, type SerializedError } from "./AppError.js";

// Error codes
export { ErrorCode, errorCodeToStatus } from "./codes.js";

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
  NotImplementedError,
  type FieldError,
} from "./types.js";

// Type guards
export {
  isAppError,
  isValidationError,
  isNotFoundError,
  isAuthenticationError,
  isAuthorizationError,
  isBlockchainError,
  isRateLimitError,
  isNotImplementedError,
  hasErrorCode,
  isSerializedError,
  toAppError,
} from "./guards.js";
