import { describe, expect, it, mock } from "bun:test";
import {
  callWithRetry,
  resolveSorobanRpcEndpoints,
  RpcAllEndpointsFailedError,
  isRpcAllEndpointsFailedError,
} from "../rpc.js";

describe("resolveSorobanRpcEndpoints", () => {
  it("returns the default testnet endpoint when no overrides", () => {
    const result = resolveSorobanRpcEndpoints(
      "Test SDF Network ; September 2015",
    );

    expect(result).toEqual(["https://soroban-testnet.stellar.org"]);
  });

  it("returns the default mainnet endpoint for public network", () => {
    const result = resolveSorobanRpcEndpoints(
      "Public Global Stellar Network ; September 2015",
    );

    expect(result).toEqual(["https://rpc.mainnet.stellar.org"]);
  });

  it("returns explicit rpcUrl when provided", () => {
    const result = resolveSorobanRpcEndpoints("testnet", "https://custom.rpc");

    expect(result).toEqual(["https://custom.rpc"]);
  });

  it("returns rpcUrls when provided", () => {
    const result = resolveSorobanRpcEndpoints("testnet", undefined, [
      "https://primary",
      "https://fallback",
    ]);

    expect(result).toEqual(["https://primary", "https://fallback"]);
  });
});

describe("callWithRetry", () => {
  it("returns data on first successful call", async () => {
    const fn = mock(async (_endpoint: string) => "success");

    const result = await callWithRetry(fn, {
      endpoints: ["http://primary"],
      maxRetries: 1,
    });

    expect(result.data).toBe("success");
    expect(result.endpointUsed).toBe("http://primary");
    expect(result.attempts).toBe(1);
  });

  it("retries on transient timeout and eventually succeeds", async () => {
    let attempts = 0;

    const fn = mock(async (_endpoint: string) => {
      attempts++;

      if (attempts < 2) {
        throw new Error("timeout");
      }

      return "success";
    });

    const result = await callWithRetry(fn, {
      endpoints: ["http://primary"],
      maxRetries: 3,
      retryBaseDelayMs: 1,
      maxRetryMs: 100,
    });

    expect(result.data).toBe("success");
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back to the next endpoint after transient failures", async () => {
    const calls: string[] = [];

    const fn = mock(async (endpoint: string) => {
      calls.push(endpoint);

      if (endpoint === "http://primary") {
        throw new Error("ECONNREFUSED");
      }

      return "fallback-success";
    });

    const result = await callWithRetry(fn, {
      endpoints: ["http://primary", "http://fallback"],
      maxRetries: 1,
      retryBaseDelayMs: 1,
      maxRetryMs: 100,
    });

    expect(result.data).toBe("fallback-success");
    expect(result.endpointUsed).toBe("http://fallback");
    expect(calls).toEqual(["http://primary", "http://fallback"]);
  });

  it("recovers from a hung primary call and falls back before maxRetryMs", async () => {
    const calls: string[] = [];
    const maxRetryMs = 5_000;
    const callTimeoutMs = 50;
    const startedAt = Date.now();

    const fn = mock((endpoint: string) => {
      calls.push(endpoint);

      if (endpoint === "http://primary") {
        return new Promise<string>(() => {});
      }

      return Promise.resolve("fallback-success");
    });

    const result = await callWithRetry(fn, {
      endpoints: ["http://primary", "http://fallback"],
      maxRetries: 3,
      retryBaseDelayMs: 1,
      maxRetryMs,
      callTimeoutMs,
    });

    expect(result.data).toBe("fallback-success");
    expect(result.endpointUsed).toBe("http://fallback");
    expect(calls).toEqual([
      "http://primary",
      "http://primary",
      "http://primary",
      "http://fallback",
    ]);
    expect(Date.now() - startedAt).toBeLessThan(maxRetryMs);
  });

  it("falls back after HTTP 503", async () => {
    const fn = mock(async (endpoint: string) => {
      if (endpoint === "http://primary") {
        throw new Error("HTTP 503 Service Unavailable");
      }

      return "fallback-success";
    });

    const result = await callWithRetry(fn, {
      endpoints: ["http://primary", "http://fallback"],
      maxRetries: 1,
      retryBaseDelayMs: 1,
      maxRetryMs: 100,
    });

    expect(result.data).toBe("fallback-success");
    expect(result.endpointUsed).toBe("http://fallback");
  });

  it("does not retry or fall back on deterministic contract errors", async () => {
    const fn = mock(async (_endpoint: string) => {
      throw new Error("contract error: entrypoint not found");
    });

    await expect(
      callWithRetry(fn, {
        endpoints: ["http://primary", "http://fallback"],
        maxRetries: 3,
        retryBaseDelayMs: 1,
        maxRetryMs: 100,
      }),
    ).rejects.toThrow("contract error");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("http://primary");
  });

  it("falls back after ECONNRESET", async () => {
    const fn = mock(async (endpoint: string) => {
      if (endpoint === "http://primary") {
        throw new Error("ECONNRESET");
      }

      return "fallback-success";
    });

    const result = await callWithRetry(fn, {
      endpoints: ["http://primary", "http://fallback"],
      maxRetries: 1,
      retryBaseDelayMs: 1,
      maxRetryMs: 100,
    });

    expect(result.data).toBe("fallback-success");
    expect(result.endpointUsed).toBe("http://fallback");
  });

  it("throws RpcAllEndpointsFailedError when all retries are exhausted", async () => {
    const fn = mock(async () => {
      throw new Error("timeout");
    });

    await expect(
      callWithRetry(fn, {
        endpoints: ["http://primary", "http://fallback"],
        maxRetries: 2,
        retryBaseDelayMs: 1,
        maxRetryMs: 100,
      }),
    ).rejects.toThrow(RpcAllEndpointsFailedError);

    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("respects maxRetryMs deadline", async () => {
    const fn = mock(async () => {
      throw new Error("timeout");
    });

    await expect(
      callWithRetry(fn, {
        endpoints: ["http://primary"],
        maxRetries: 100,
        retryBaseDelayMs: 1,
        maxRetryMs: 50,
      }),
    ).rejects.toThrow(RpcAllEndpointsFailedError);
  });
});

describe("RpcAllEndpointsFailedError", () => {
  it("stores errors array", () => {
    const errors = [new Error("err1"), new Error("err2")];
    const err = new RpcAllEndpointsFailedError("all failed", errors);

    expect(err.errors).toEqual(errors);
    expect(err.name).toBe("RpcAllEndpointsFailedError");
  });
});

describe("isRpcAllEndpointsFailedError", () => {
  it("returns true for RpcAllEndpointsFailedError", () => {
    const err = new RpcAllEndpointsFailedError("test", [new Error("x")]);

    expect(isRpcAllEndpointsFailedError(err)).toBe(true);
  });

  it("returns false for regular errors", () => {
    expect(isRpcAllEndpointsFailedError(new Error("normal"))).toBe(false);
  });
});
