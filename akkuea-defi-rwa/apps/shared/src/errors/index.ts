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
