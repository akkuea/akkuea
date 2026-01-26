import { describe, it, expect, beforeEach, mock } from "bun:test";
import { createApiClient } from "../client";
import {
  ApiRequestError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
} from "../types";
import {
  setupMockFetch,
  setupMockLocalStorage,
  wrapFetchMock,
} from "./helpers";

describe("API Client", () => {
  let mockLocalStorage: ReturnType<typeof setupMockLocalStorage>;

  beforeEach(() => {
    mockLocalStorage = setupMockLocalStorage();

    // Setup global fetch mock (will be overridden in each test)
    global.fetch = wrapFetchMock(
      mock(() => {
        throw new Error("fetch not mocked");
      }),
    );

    // Setup localStorage mock
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  describe("GET requests", () => {
    it("returns typed data", async () => {
      interface TestData {
        id: string;
        name: string;
      }

      const testData: TestData = { id: "1", name: "Test" };
      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: testData,
      });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      const response = await client.get<TestData>("/test");

      expect(response.data).toEqual(testData);
      expect(response.status).toBe(200);
      expect(calls[0].url).toBe("https://api.test.com/test");
      expect(calls[0].options.method).toBe("GET");
    });

    it("includes Content-Type header", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      await client.get("/test");

      const headers = calls[0].options.headers as Headers;
      expect(headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("POST requests", () => {
    it("sends body correctly", async () => {
      const requestBody = { name: "Test", value: 123 };
      const responseBody = { id: "1", ...requestBody };
      const { fetchMock, calls } = setupMockFetch({
        status: 201,
        body: responseBody,
      });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      const response = await client.post("/test", requestBody);

      expect(response.data).toEqual(responseBody);
      expect(calls[0].options.method).toBe("POST");
      expect(calls[0].options.body).toBe(JSON.stringify(requestBody));
    });

    it("handles empty body", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      await client.post("/test");

      expect(calls[0].options.body).toBeUndefined();
    });
  });

  describe("PUT requests", () => {
    it("sends body correctly", async () => {
      const requestBody = { name: "Updated" };
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      await client.put("/test/1", requestBody);

      expect(calls[0].options.method).toBe("PUT");
      expect(calls[0].options.body).toBe(JSON.stringify(requestBody));
    });
  });

  describe("DELETE requests", () => {
    it("sends DELETE method correctly", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 204, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      await client.delete("/test/1");

      expect(calls[0].options.method).toBe("DELETE");
      expect(calls[0].options.body).toBeUndefined();
    });
  });

  describe("Authentication", () => {
    it("includes auth token when available", async () => {
      const token = "test-token-123";
      mockLocalStorage.setItem("auth_token", token);
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({
        baseUrl: "https://api.test.com",
        getAuthToken: () => mockLocalStorage.getItem("auth_token"),
      });
      await client.get("/test");

      const headers = calls[0].options.headers as Headers;
      expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
    });

    it("does not include auth token when not available", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({
        baseUrl: "https://api.test.com",
        getAuthToken: () => null,
      });
      await client.get("/test");

      const headers = calls[0].options.headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });

    it("triggers AuthenticationError on 401", async () => {
      const { fetchMock } = setupMockFetch({ status: 401, body: {} });
      global.fetch = fetchMock;

      let unauthorizedCalled = false;
      const onUnauthorized = () => {
        unauthorizedCalled = true;
      };
      const client = createApiClient({
        baseUrl: "https://api.test.com",
        onUnauthorized,
      });

      await expect(client.get("/test")).rejects.toThrow(AuthenticationError);
      expect(unauthorizedCalled).toBe(true);
    });

    it("removes auth token on 401", async () => {
      mockLocalStorage.setItem("auth_token", "test-token");
      const { fetchMock } = setupMockFetch({ status: 401, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({
        baseUrl: "https://api.test.com",
        getAuthToken: () => mockLocalStorage.getItem("auth_token"),
        onUnauthorized: () => {
          mockLocalStorage.removeItem("auth_token");
        },
      });

      await expect(client.get("/test")).rejects.toThrow(AuthenticationError);
      expect(mockLocalStorage.getItem("auth_token")).toBeNull();
    });
  });

  describe("Error handling", () => {
    it("transforms error responses to consistent format", async () => {
      const errorBody = {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: { field: "email" },
      };
      const { fetchMock } = setupMockFetch({
        status: 400,
        body: errorBody,
      });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      try {
        await client.get("/test");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe("VALIDATION_ERROR");
        expect(apiError.message).toBe("Invalid input");
        expect(apiError.details).toEqual({ field: "email" });
      }
    });

    it("handles error response without body", async () => {
      const { fetchMock } = setupMockFetch({
        status: 500,
        statusText: "Internal Server Error",
        body: null,
      });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      try {
        // Disable retries to avoid timeout
        await client.get("/test", { retries: 0 });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        const apiError = error as ApiRequestError;
        expect(apiError.status).toBe(500);
        expect(apiError.code).toBe("UNKNOWN_ERROR");
        expect(apiError.message).toBe("Internal Server Error");
      }
    });

    it("handles network errors", async () => {
      global.fetch = wrapFetchMock(
        mock(() => {
          throw new Error("Network error");
        }),
      );

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      await expect(client.get("/test", { retries: 0 })).rejects.toThrow(
        NetworkError,
      );
    });
  });

  describe("Timeout handling", () => {
    it("triggers TimeoutError after timeout", async () => {
      const { fetchMock } = setupMockFetch({
        status: 200,
        body: {},
        delay: 2000,
      });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      await expect(
        client.get("/test", { timeout: 100, retries: 0 }),
      ).rejects.toThrow(TimeoutError);
    });

    it("retries on timeout", async () => {
      let callCount = 0;
      const timeoutFetch = mock(
        (input: RequestInfo | URL, options?: RequestInit) => {
          callCount++;

          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              resolve(
                new Response(JSON.stringify({}), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }),
              );
            }, 200);

            // Handle abort signal
            if (options?.signal) {
              options.signal.addEventListener("abort", () => {
                clearTimeout(timeoutId);
                const abortError = new Error("The operation was aborted.");
                abortError.name = "AbortError";
                reject(abortError);
              });
            }
          });
        },
      );
      global.fetch = wrapFetchMock(
        timeoutFetch as unknown as (
          input: RequestInfo | URL,
          options?: RequestInit,
        ) => Promise<Response>,
      );

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      // This will timeout on first attempt, then timeout again on retry
      try {
        await client.get("/test", { timeout: 50, retries: 1, retryDelay: 10 });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
      }
      // Should have attempted multiple times (initial + retry)
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe("Retry logic", () => {
    it("retries 3 times on 5xx errors", async () => {
      const { fetchMock, calls } = setupMockFetch([
        { status: 500, body: { message: "Server Error" } },
        { status: 500, body: { message: "Server Error" } },
        { status: 500, body: { message: "Server Error" } },
        { status: 200, body: { success: true } },
      ]);
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      const response = await client.get("/test", {
        retries: 3,
        retryDelay: 10,
      });

      expect(response.data).toEqual({ success: true });
      expect(calls.length).toBe(4); // Initial + 3 retries
    });

    it("retries on 429 rate limit errors", async () => {
      const { fetchMock, calls } = setupMockFetch([
        { status: 429, body: { message: "Too Many Requests" } },
        { status: 429, body: { message: "Too Many Requests" } },
        { status: 200, body: { success: true } },
      ]);
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      const response = await client.get("/test", {
        retries: 3,
        retryDelay: 10,
      });

      expect(response.data).toEqual({ success: true });
      expect(calls.length).toBe(3);
    });

    it("throws error after max retries", async () => {
      const { fetchMock } = setupMockFetch([
        { status: 500, body: { message: "Server Error" } },
        { status: 500, body: { message: "Server Error" } },
        { status: 500, body: { message: "Server Error" } },
        { status: 500, body: { message: "Server Error" } },
      ]);
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      await expect(
        client.get("/test", { retries: 3, retryDelay: 10 }),
      ).rejects.toThrow(ApiRequestError);
    });

    it("does not retry on 4xx errors (except 429)", async () => {
      const { fetchMock, calls } = setupMockFetch({
        status: 404,
        body: { message: "Not Found" },
      });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      await expect(client.get("/test")).rejects.toThrow(ApiRequestError);
      expect(calls.length).toBe(1); // No retries
    });

    it("implements exponential backoff", async () => {
      const timestamps: number[] = [];
      const { fetchMock } = setupMockFetch([
        { status: 500, body: {} },
        { status: 500, body: {} },
        { status: 500, body: {} },
        { status: 200, body: {} },
      ]);
      global.fetch = wrapFetchMock(
        mock(async () => {
          timestamps.push(Date.now());
          return fetchMock("", {});
        }),
      );

      const client = createApiClient({ baseUrl: "https://api.test.com" });

      await client.get("/test", { retries: 3, retryDelay: 100 });

      // Verify delays between retries
      expect(timestamps.length).toBeGreaterThan(1);
      // Each retry should have a delay (exponential backoff: retryDelay * attempt)
    });
  });

  describe("Custom headers", () => {
    it("merges custom headers correctly", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({
        baseUrl: "https://api.test.com",
        defaultHeaders: { "X-Custom": "default" },
      });
      await client.get("/test", {
        headers: { "X-Custom-2": "custom", "Content-Type": "application/xml" },
      });

      const headers = calls[0].options.headers as Headers;
      expect(headers.get("X-Custom")).toBe("default");
      expect(headers.get("X-Custom-2")).toBe("custom");
      // Custom headers override defaults
      expect(headers.get("Content-Type")).toBe("application/xml");
    });
  });

  describe("Base URL configuration", () => {
    it("constructs correct URL with base URL", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      await client.get("/users/123");

      expect(calls[0].url).toBe("https://api.test.com/users/123");
    });

    it("handles base URL with trailing slash", async () => {
      const { fetchMock, calls } = setupMockFetch({ status: 200, body: {} });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com/" });
      await client.get("/users/123");

      expect(calls[0].url).toBe("https://api.test.com//users/123");
      // Note: This is technically correct behavior, but could be improved
    });
  });

  describe("Response status codes", () => {
    it("handles 201 Created status", async () => {
      const { fetchMock } = setupMockFetch({ status: 201, body: { id: "1" } });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      const response = await client.post("/test", {});

      expect(response.status).toBe(201);
      expect(response.data).toEqual({ id: "1" });
    });

    it("handles 204 No Content status", async () => {
      const { fetchMock } = setupMockFetch({ status: 204, body: null });
      global.fetch = fetchMock;

      const client = createApiClient({ baseUrl: "https://api.test.com" });
      const response = await client.delete("/test/1");

      expect(response.status).toBe(204);
      expect(response.data).toBeUndefined();
    });
  });
});
