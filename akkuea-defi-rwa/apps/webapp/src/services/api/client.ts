import {
  ApiResponse,
  ApiRequestError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
  RequestConfig,
} from "./types";

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Base API client configuration
 */
interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  getAuthToken?: () => string | null;
  onUnauthorized?: () => void;
}

/**
 * Create a configured API client instance
 */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, defaultHeaders = {}, getAuthToken, onUnauthorized } = config;

  /**
   * Build request headers
   */
  function buildHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...defaultHeaders,
      ...customHeaders,
    });

    const token = getAuthToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Fetch with timeout
   */
  async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(
          `Request to ${url} timed out after ${timeout}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep utility for retry delay
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  function isRetryable(status: number): boolean {
    return status >= 500 || status === 429;
  }

  /**
   * Parse error response
   */
  async function parseErrorResponse(
    response: Response,
  ): Promise<ApiRequestError> {
    // Check if response has a body
    const contentType = response.headers.get("content-type");
    const hasJsonBody = contentType && contentType.includes("application/json");

    // Check if body exists and is not empty
    const contentLength = response.headers.get("content-length");
    const hasBody = contentLength !== "0" && hasJsonBody;

    if (hasBody) {
      try {
        const body = await response.json();
        return new ApiRequestError(
          response.status,
          body.code || "UNKNOWN_ERROR",
          body.message || response.statusText,
          body.details,
        );
      } catch {
        // If JSON parsing fails, fall through to default error
      }
    }

    // For responses without body, return error with status text
    return new ApiRequestError(
      response.status,
      "UNKNOWN_ERROR",
      response.statusText || "Unknown error occurred",
    );
  }

  /**
   * Make HTTP request with retry logic
   */
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    const {
      headers: customHeaders,
      timeout = DEFAULT_TIMEOUT,
      retries = DEFAULT_RETRIES,
      retryDelay = DEFAULT_RETRY_DELAY,
    } = config;

    const url = `${baseUrl}${path}`;
    const headers = buildHeaders(customHeaders);

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retries) {
      try {
        const response = await fetchWithTimeout(url, options, timeout);

        // Handle 401 Unauthorized
        if (response.status === 401) {
          onUnauthorized?.();
          throw new AuthenticationError();
        }

        // Handle error responses
        if (!response.ok) {
          const error = await parseErrorResponse(response);

          // Retry on server errors
          if (isRetryable(response.status) && attempt < retries) {
            lastError = error;
            attempt++;
            await sleep(retryDelay * attempt);
            continue;
          }

          throw error;
        }

        // Parse successful response
        // Handle 204 No Content (no body)
        if (response.status === 204) {
          return {
            data: undefined as T,
            status: response.status,
          };
        }

        // Try to parse JSON, but handle empty responses
        let data: T;
        try {
          const jsonData = await response.json();
          data = jsonData as T;
        } catch (error) {
          // If JSON parsing fails but status is success, return null
          // This handles cases like 200 OK with no body
          if (response.ok) {
            data = null as T;
          } else {
            // For error responses, re-throw to be handled by parseErrorResponse
            throw error;
          }
        }

        return {
          data: data as T,
          status: response.status,
        };
      } catch (error) {
        if (
          error instanceof AuthenticationError ||
          error instanceof ApiRequestError
        ) {
          throw error;
        }

        if (error instanceof TimeoutError) {
          if (attempt < retries) {
            lastError = error;
            attempt++;
            await sleep(retryDelay * attempt);
            continue;
          }
          throw error;
        }

        // Network error
        if (attempt < retries) {
          lastError = error instanceof Error ? error : new Error(String(error));
          attempt++;
          await sleep(retryDelay * attempt);
          continue;
        }

        throw new NetworkError(
          error instanceof Error ? error.message : "Network request failed",
        );
      }
    }

    throw lastError || new NetworkError("Request failed after retries");
  }

  return {
    /**
     * GET request
     */
    get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      return request<T>("GET", path, undefined, config);
    },

    /**
     * POST request
     */
    post<T>(
      path: string,
      body?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      return request<T>("POST", path, body, config);
    },

    /**
     * PUT request
     */
    put<T>(
      path: string,
      body?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      return request<T>("PUT", path, body, config);
    },

    /**
     * PATCH request
     */
    patch<T>(
      path: string,
      body?: unknown,
      config?: RequestConfig,
    ): Promise<ApiResponse<T>> {
      return request<T>("PATCH", path, body, config);
    },

    /**
     * DELETE request
     */
    delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
      return request<T>("DELETE", path, undefined, config);
    },
  };
}

/**
 * Get API base URL from environment variable
 * Next.js replaces NEXT_PUBLIC_* env vars at build time
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - process.env is available in Next.js runtime but TypeScript doesn't recognize it
const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "http://localhost:3001";

const getApiBaseUrl = (): string => {
  return API_BASE_URL;
};

/**
 * Default API client instance
 */
export const apiClient = createApiClient({
  baseUrl: getApiBaseUrl(),
  getAuthToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
    return null;
  },
  onUnauthorized: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
  },
});
