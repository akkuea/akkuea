import { describe, test, expect } from "bun:test";
import {
  AppError,
  ErrorCode,
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
  type SerializedError,
} from "../src/errors/index.js";

describe("guards.ts and AppError.ts", () => {
  describe("toAppError", () => {
    test("serialized error becomes instanceof AppError", () => {
      const serialized: SerializedError = {
        code: ErrorCode.NOT_FOUND,
        message: "Requested property not found",
        status: 404,
        details: { propertyId: "prop-123" },
        timestamp: new Date().toISOString(),
        requestId: "req-abc-1",
      };

      const result = toAppError(serialized);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCode.NOT_FOUND);
      expect(result.message).toBe("Requested property not found");
      expect(result.status).toBe(404);
      expect(result.details).toEqual({ propertyId: "prop-123" });
      expect(result.requestId).toBe("req-abc-1");
      expect(typeof result.toJSON).toBe("function");
      expect(typeof result.withRequestId).toBe("function");
    });

    test("a string becomes INTERNAL_ERROR", () => {
      const errorMsg = "Database connection timed out";
      const result = toAppError(errorMsg);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.status).toBe(500);
      expect(result.message).toBe(errorMsg);
    });

    test("{} becomes UNKNOWN", () => {
      const result = toAppError({});

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCode.UNKNOWN);
      expect(result.status).toBe(500);
      expect(result.message).toBe("An unknown error occurred");
    });

    test("returns real AppError instance unchanged", () => {
      const original = new AppError(
        ErrorCode.BAD_REQUEST,
        "Malformed request body",
        { key: "value" },
        400,
      ).withRequestId("req-original");

      const result = toAppError(original);

      expect(result).toBe(original);
      expect(result.requestId).toBe("req-original");
    });

    test("returns AppError subclass instances unchanged", () => {
      const validationErr = new ValidationError("Invalid parameters", [
        { field: "amount", message: "must be positive" },
      ]);

      const result = toAppError(validationErr);

      expect(result).toBe(validationErr);
      expect(result).toBeInstanceOf(ValidationError);
      expect(result).toBeInstanceOf(AppError);
    });

    test("standard Error instance becomes INTERNAL_ERROR", () => {
      const nativeErr = new Error("Disk read failure");
      const result = toAppError(nativeErr);

      expect(result).toBeInstanceOf(AppError);
      expect(result.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.status).toBe(500);
      expect(result.message).toBe("Disk read failure");
    });

    test("non-error primitives (null, undefined, numbers) become UNKNOWN", () => {
      expect(toAppError(null).code).toBe(ErrorCode.UNKNOWN);
      expect(toAppError(undefined).code).toBe(ErrorCode.UNKNOWN);
      expect(toAppError(12345).code).toBe(ErrorCode.UNKNOWN);
      expect(toAppError(false).code).toBe(ErrorCode.UNKNOWN);
    });
  });

  describe("AppError constructor and methods", () => {
    test("a code with no explicit status gets its status from the code map", () => {
      const notFoundErr = new AppError(ErrorCode.NOT_FOUND, "Not found");
      expect(notFoundErr.status).toBe(404);

      const validationErr = new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid input",
      );
      expect(validationErr.status).toBe(400);

      const unauthErr = new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized");
      expect(unauthErr.status).toBe(401);

      const forbiddenErr = new AppError(ErrorCode.FORBIDDEN, "Forbidden");
      expect(forbiddenErr.status).toBe(403);

      const conflictErr = new AppError(ErrorCode.CONFLICT, "Conflict");
      expect(conflictErr.status).toBe(409);

      const rateLimitErr = new AppError(
        ErrorCode.RATE_LIMITED,
        "Rate limit exceeded",
      );
      expect(rateLimitErr.status).toBe(429);

      const internalErr = new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Internal failure",
      );
      expect(internalErr.status).toBe(500);
    });

    test("an unknown code gets 500", () => {
      const unknownCodeErr = new AppError(
        "NON_STANDARD_CUSTOM_CODE" as ErrorCode,
        "Something weird happened",
      );
      expect(unknownCodeErr.status).toBe(500);
    });

    test("explicit status overrides default status from the code map", () => {
      const customStatusErr = new AppError(
        ErrorCode.NOT_FOUND,
        "Gone permanently",
        undefined,
        410,
      );
      expect(customStatusErr.status).toBe(410);
    });

    test("toJSON/fromJSON round-trip keeps requestId", () => {
      const original = new AppError(
        ErrorCode.CONFLICT,
        "Wallet already registered",
        { wallet: "GABC123" },
      ).withRequestId("req-roundtrip-789");

      const json = original.toJSON();

      expect(json.requestId).toBe("req-roundtrip-789");
      expect(json.code).toBe(ErrorCode.CONFLICT);
      expect(json.message).toBe("Wallet already registered");
      expect(json.status).toBe(409);
      expect(json.details).toEqual({ wallet: "GABC123" });
      expect(typeof json.timestamp).toBe("string");

      const restored = AppError.fromJSON(json);

      expect(restored).toBeInstanceOf(AppError);
      expect(restored.requestId).toBe("req-roundtrip-789");
      expect(restored.code).toBe(ErrorCode.CONFLICT);
      expect(restored.message).toBe("Wallet already registered");
      expect(restored.status).toBe(409);
      expect(restored.details).toEqual({ wallet: "GABC123" });
    });
  });

  describe("type guards", () => {
    test("each is*Error guard matches only its class", () => {
      const appErr = new AppError(ErrorCode.INTERNAL_ERROR, "base error");
      const valErr = new ValidationError("invalid field");
      const notFoundErr = new NotFoundError("property", "123");
      const authErr = new AuthenticationError("need login");
      const authzErr = new AuthorizationError("need role");
      const conflictErr = new ConflictError("duplicate");
      const businessErr = new BusinessError(
        ErrorCode.INSUFFICIENT_FUNDS,
        "low balance",
      );
      const chainErr = new BlockchainError("tx failed", "0xabc");
      const netErr = new NetworkError("timeout");
      const rateLimitErr = new RateLimitError(60);
      const notImplErr = new NotImplementedError("exportToPdf");
      const plainErr = new Error("vanilla error");
      const serialized = {
        code: ErrorCode.NOT_FOUND,
        message: "Not found",
        status: 404,
      };

      // isAppError matches AppError and subclasses, but not plain objects or standard Errors
      expect(isAppError(appErr)).toBe(true);
      expect(isAppError(valErr)).toBe(true);
      expect(isAppError(notFoundErr)).toBe(true);
      expect(isAppError(authErr)).toBe(true);
      expect(isAppError(chainErr)).toBe(true);
      expect(isAppError(plainErr)).toBe(false);
      expect(isAppError(serialized)).toBe(false);
      expect(isAppError({})).toBe(false);
      expect(isAppError("error")).toBe(false);
      expect(isAppError(null)).toBe(false);

      // isValidationError matches only ValidationError
      expect(isValidationError(valErr)).toBe(true);
      expect(isValidationError(appErr)).toBe(false);
      expect(isValidationError(notFoundErr)).toBe(false);
      expect(isValidationError(plainErr)).toBe(false);
      expect(isValidationError(serialized)).toBe(false);

      // isNotFoundError matches only NotFoundError
      expect(isNotFoundError(notFoundErr)).toBe(true);
      expect(isNotFoundError(appErr)).toBe(false);
      expect(isNotFoundError(valErr)).toBe(false);
      expect(isNotFoundError(plainErr)).toBe(false);
      expect(isNotFoundError(serialized)).toBe(false);

      // isAuthenticationError matches only AuthenticationError
      expect(isAuthenticationError(authErr)).toBe(true);
      expect(isAuthenticationError(appErr)).toBe(false);
      expect(isAuthenticationError(authzErr)).toBe(false);
      expect(isAuthenticationError(plainErr)).toBe(false);

      // isAuthorizationError matches only AuthorizationError
      expect(isAuthorizationError(authzErr)).toBe(true);
      expect(isAuthorizationError(appErr)).toBe(false);
      expect(isAuthorizationError(authErr)).toBe(false);
      expect(isAuthorizationError(plainErr)).toBe(false);

      // isBlockchainError matches only BlockchainError
      expect(isBlockchainError(chainErr)).toBe(true);
      expect(isBlockchainError(appErr)).toBe(false);
      expect(isBlockchainError(netErr)).toBe(false);
      expect(isBlockchainError(plainErr)).toBe(false);

      // isRateLimitError matches only RateLimitError
      expect(isRateLimitError(rateLimitErr)).toBe(true);
      expect(isRateLimitError(appErr)).toBe(false);
      expect(isRateLimitError(plainErr)).toBe(false);

      // isNotImplementedError matches only NotImplementedError
      expect(isNotImplementedError(notImplErr)).toBe(true);
      expect(isNotImplementedError(appErr)).toBe(false);
      expect(isNotImplementedError(plainErr)).toBe(false);
    });

    test("hasErrorCode correctly checks code on AppError instances", () => {
      const err = new AppError(ErrorCode.NOT_FOUND, "Not found");
      expect(hasErrorCode(err, ErrorCode.NOT_FOUND)).toBe(true);
      expect(hasErrorCode(err, ErrorCode.UNAUTHORIZED)).toBe(false);
      expect(hasErrorCode(new Error("standard"), ErrorCode.NOT_FOUND)).toBe(
        false,
      );
      expect(
        hasErrorCode(
          { code: ErrorCode.NOT_FOUND, message: "m", status: 404 },
          ErrorCode.NOT_FOUND,
        ),
      ).toBe(false);
    });

    test("isSerializedError validates serialized error shapes", () => {
      expect(
        isSerializedError({
          code: "NOT_FOUND",
          message: "Missing",
          status: 404,
        }),
      ).toBe(true);
      expect(isSerializedError({ code: "NOT_FOUND", message: "Missing" })).toBe(
        false,
      );
      expect(isSerializedError({ code: "NOT_FOUND", status: 404 })).toBe(false);
      expect(isSerializedError({ message: "Missing", status: 404 })).toBe(
        false,
      );
      expect(isSerializedError(null)).toBe(false);
      expect(isSerializedError(undefined)).toBe(false);
      expect(isSerializedError("error")).toBe(false);
      expect(isSerializedError(123)).toBe(false);
      expect(isSerializedError({})).toBe(false);
    });
  });
});
