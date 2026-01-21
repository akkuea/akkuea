/**
 * Test utilities and helpers for API client tests
 */

export interface MockFetchResponse {
  status?: number;
  statusText?: string;
  body?: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

export interface MockFetchCall {
  url: string;
  options: RequestInit;
}

/**
 * Create a mock Response object
 */
export function createMockResponse(
  response: MockFetchResponse
): Response {
  const {
    status = 200,
    statusText = 'OK',
    body = {},
    headers = {},
  } = response;

  // Handle null body case
  const hasBody = body !== null && body !== undefined;
  const isSuccess = status >= 200 && status < 300;
  const contentType = headers['Content-Type'] || (hasBody ? 'application/json' : 'text/plain');

  const mockResponse = {
    ok: isSuccess,
    status,
    statusText,
    headers: new Headers({
      'Content-Type': contentType,
      ...headers,
      ...(hasBody ? {} : { 'Content-Length': '0' }),
    }),
    json: async () => {
      // For 204 No Content, return empty object
      if (status === 204) {
        return {};
      }
      // For error responses without body, throw error to simulate failed JSON parse
      if (!hasBody && !isSuccess) {
        const error = new Error('Unexpected end of JSON input');
        error.name = 'SyntaxError';
        throw error;
      }
      // For success responses without body, return null
      if (!hasBody && isSuccess) {
        return null;
      }
      return body;
    },
    text: async () => {
      if (!hasBody) {
        return '';
      }
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  } as Response;

  return mockResponse;
}

/**
 * Setup mock fetch with response configuration
 */
export function setupMockFetch(
  responses: MockFetchResponse | MockFetchResponse[]
): {
  fetchMock: typeof fetch;
  calls: MockFetchCall[];
  reset: () => void;
} {
  const calls: MockFetchCall[] = [];
  const responseArray = Array.isArray(responses) ? responses : [responses];
  let responseIndex = 0;

  const fetchMock = async (url: string, options?: RequestInit) => {
    calls.push({ url, options: options || {} });

    const responseConfig = responseArray[responseIndex] || responseArray[0];
    responseIndex++;

    // Check if request was aborted before starting
    if (options?.signal?.aborted) {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    if (responseConfig.delay) {
      // Handle delay with abort support
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // Check if aborted after delay
          if (options?.signal?.aborted) {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
            return;
          }
          resolve(createMockResponse(responseConfig));
        }, responseConfig.delay);

        // Listen for abort during delay
        if (options?.signal) {
          const abortHandler = () => {
            clearTimeout(timeoutId);
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          };
          options.signal.addEventListener('abort', abortHandler);
        }
      });
    }

    // Check again if aborted after delay (if no delay was set)
    if (options?.signal?.aborted) {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      throw abortError;
    }

    return createMockResponse(responseConfig);
  };

  const reset = () => {
    calls.length = 0;
    responseIndex = 0;
  };

  return { fetchMock, calls, reset };
}

/**
 * Setup mock localStorage
 */
export function setupMockLocalStorage(): {
  storage: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
} {
  const storage: Record<string, string> = {};

  return {
    storage,
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
  };
}

/**
 * Create a delayed promise to simulate timeout
 */
export function createDelayedPromise<T>(
  delay: number,
  resolveValue?: T
): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(resolveValue as T), delay);
  });
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
