/**
 * API response wrapper type shared by app clients.
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

/**
 * API error response payload.
 */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Request configuration options for API clients.
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Query parameters accepted by REST endpoints that use page-based pagination.
 */
export interface ApiPaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Page metadata returned by REST endpoints.
 */
export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated REST response wrapper.
 */
export interface ApiPaginatedResponse<T> {
  data: T[];
  pagination: ApiPaginationMeta;
}

/**
 * HTTP request error raised by frontend API clients.
 */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiRequestError";
    Object.setPrototypeOf(this, ApiRequestError.prototype);
  }

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

export class ApiAuthenticationError extends ApiRequestError {
  constructor(message: string = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, ApiAuthenticationError.prototype);
  }
}

export class ApiNetworkError extends Error {
  constructor(message: string = "Network error occurred") {
    super(message);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, ApiNetworkError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
    };
  }
}

export class ApiTimeoutError extends Error {
  constructor(message: string = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, ApiTimeoutError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
    };
  }
}
