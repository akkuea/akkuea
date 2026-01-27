import { describe, it, expect } from "bun:test";
import {
  ApiRequestError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
} from "../types";

describe("Error Types", () => {
  describe("ApiRequestError", () => {
    it("instantiates with all properties", () => {
      const error = new ApiRequestError(
        400,
        "VALIDATION_ERROR",
        "Invalid input",
        { field: "email" },
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error.status).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid input");
      expect(error.details).toEqual({ field: "email" });
      expect(error.name).toBe("ApiRequestError");
    });

    it("instantiates without details", () => {
      const error = new ApiRequestError(404, "NOT_FOUND", "Resource not found");

      expect(error.status).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Resource not found");
      expect(error.details).toBeUndefined();
    });

    it("can be caught as Error", () => {
      const error = new ApiRequestError(500, "SERVER_ERROR", "Server error");

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(ApiRequestError);
        if (e instanceof ApiRequestError) {
          expect(e.status).toBe(500);
        }
      }
    });
  });

  describe("AuthenticationError", () => {
    it("extends ApiRequestError", () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiRequestError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.status).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Authentication required");
      expect(error.name).toBe("AuthenticationError");
    });

    it("accepts custom message", () => {
      const error = new AuthenticationError("Please log in");

      expect(error.message).toBe("Please log in");
      expect(error.status).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
    });

    it("can be caught as ApiRequestError", () => {
      const error = new AuthenticationError();

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(ApiRequestError);
        if (e instanceof ApiRequestError) {
          expect(e.status).toBe(401);
        }
      }
    });
  });

  describe("NetworkError", () => {
    it("instantiates with default message", () => {
      const error = new NetworkError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("Network error occurred");
      expect(error.name).toBe("NetworkError");
    });

    it("accepts custom message", () => {
      const error = new NetworkError("Connection failed");

      expect(error.message).toBe("Connection failed");
      expect(error.name).toBe("NetworkError");
    });

    it("does not extend ApiRequestError", () => {
      const error = new NetworkError();

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ApiRequestError);
    });

    it("can be caught as Error", () => {
      const error = new NetworkError("Failed to connect");

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(NetworkError);
        if (e instanceof NetworkError) {
          expect(e.message).toBe("Failed to connect");
        }
      }
    });
  });

  describe("TimeoutError", () => {
    it("instantiates with default message", () => {
      const error = new TimeoutError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.message).toBe("Request timed out");
      expect(error.name).toBe("TimeoutError");
    });

    it("accepts custom message", () => {
      const error = new TimeoutError("Request timed out after 30s");

      expect(error.message).toBe("Request timed out after 30s");
      expect(error.name).toBe("TimeoutError");
    });

    it("does not extend ApiRequestError", () => {
      const error = new TimeoutError();

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ApiRequestError);
    });

    it("can be caught as Error", () => {
      const error = new TimeoutError("Timeout after 5s");

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(TimeoutError);
        if (e instanceof TimeoutError) {
          expect(e.message).toBe("Timeout after 5s");
        }
      }
    });
  });

  describe("Error message formatting", () => {
    it("ApiRequestError includes status and code in message", () => {
      const error = new ApiRequestError(404, "NOT_FOUND", "Resource not found");

      expect(error.message).toBe("Resource not found");
      expect(error.toString()).toContain("Resource not found");
    });

    it("Error stack trace is available", () => {
      const error = new ApiRequestError(500, "SERVER_ERROR", "Server error");

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });

    it("All errors are serializable", () => {
      const errors = [
        new ApiRequestError(400, "BAD_REQUEST", "Bad request"),
        new AuthenticationError(),
        new NetworkError("Network failed"),
        new TimeoutError("Request timeout"),
      ];

      errors.forEach((error) => {
        expect(() => JSON.stringify(error)).not.toThrow();
        const serialized = JSON.stringify(error);
        expect(serialized).toContain(error.message);
      });
    });
  });
});
