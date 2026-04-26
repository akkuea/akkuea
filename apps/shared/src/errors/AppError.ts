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

    // Capture stack trace (V8 engines only)
    const ErrorWithCapture = Error as typeof Error & {
      captureStackTrace?: (
        target: object,
        constructor: new (...args: unknown[]) => unknown,
      ) => void;
    };
    if (ErrorWithCapture.captureStackTrace) {
      ErrorWithCapture.captureStackTrace(
        this,
        this.constructor as new (...args: unknown[]) => unknown,
      );
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
