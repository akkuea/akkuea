/**
 * API response wrapper type
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

/**
 * API error response
 */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Request configuration options
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Custom error classes
 */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiRequestError';
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }

  /**
   * Serialize error to JSON
   */
  toJSON() {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class AuthenticationError extends ApiRequestError {
  constructor(message: string = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  /**
   * Serialize error to JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
    };
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }

  /**
   * Serialize error to JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
    };
  }
}
