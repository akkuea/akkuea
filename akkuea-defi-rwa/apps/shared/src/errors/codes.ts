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
