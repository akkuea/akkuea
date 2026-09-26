import { SorobanRpc } from "@stellar/stellar-sdk";
import { API_ENDPOINTS } from "../constants/index.js";

export interface RpcEndpoint {
  url: string;
  label?: string;
}

export interface RpcRetryConfig {
  maxRetries?: number;
  retryBaseDelayMs?: number;
  maxRetryMs?: number;
  callTimeoutMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 2_000;
const DEFAULT_MAX_RETRY_MS = 30_000;
const DEFAULT_CALL_TIMEOUT_MS = 30_000;

/** HTTP status codes considered transient (retryable). */
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) return true;
    if (msg.includes("429") || msg.includes("rate limit")) return true;
    for (const code of TRANSIENT_STATUS_CODES) {
      if (msg.includes(`${code}`)) return true;
    }
  }
  return false;
}

function isDeterministicContractError(error: unknown): boolean {
  if (error instanceof SorobanRpc.Api.SimulationError) {
    const simError = error as SorobanRpc.Api.SimulationError;
    if (simError.error && typeof simError.error === "string") {
      const errStr = simError.error.toLowerCase();
      return (
        errStr.includes("contract") ||
        errStr.includes("entrypoint") ||
        errStr.includes("instruction") ||
        errStr.includes("assert") ||
        errStr.includes("panic")
      );
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveRpcEndpoints(
  networkPassphrase: string,
): RpcEndpoint[] {
  const isPublic = networkPassphrase === "Public Global Stellar Network ; September 2015";
  const baseUrl = isPublic ? API_ENDPOINTS.SOROBAN_RPC.MAINNET : API_ENDPOINTS.SOROBAN_RPC.TESTNET;

  if (isPublic) {
    return [
      { url: baseUrl, label: "mainnet-primary" },
      { url: "https://rpc-mainnet.stellar.org", label: "mainnet-fallback-1" },
    ];
  }

  return [
    { url: baseUrl, label: "testnet-primary" },
    { url: "https://soroban-testnet.stellar.org", label: "testnet-fallback-1" },
  ];
}

export function resolveSorobanRpcEndpoints(
  networkPassphrase: string,
  rpcUrl?: string,
  rpcUrls?: string[],
): string[] {
  if (rpcUrls && rpcUrls.length > 0) {
    return rpcUrls;
  }
  if (rpcUrl) {
    return [rpcUrl];
  }
  return resolveRpcEndpoints(networkPassphrase).map((e) => e.url);
}

export class RpcAllEndpointsFailedError extends Error {
  public readonly errors: Error[];

  constructor(message: string, errors: Error[]) {
    super(message);
    this.name = "RpcAllEndpointsFailedError";
    this.errors = errors;
  }
}

export function isRpcAllEndpointsFailedError(error: unknown): boolean {
  return error instanceof RpcAllEndpointsFailedError;
}

/**
 * Call an RPC function with bounded exponential-backoff retry
 * on transient errors only, and a per-call timeout.
 *
 * Never retries deterministic contract errors.
 */
export async function callWithRetry<T>(
  fn: (endpoint: string) => Promise<T>,
  config: { endpoints: string[] } & RpcRetryConfig,
): Promise<{ data: T; endpointUsed: string; attempts: number }> {
  const {
    endpoints,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    maxRetryMs = DEFAULT_MAX_RETRY_MS,
    callTimeoutMs = DEFAULT_CALL_TIMEOUT_MS,
  } = config;

  const errors: Error[] = [];
  const retryDeadline = Date.now() + maxRetryMs;

  for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
    const endpoint = endpoints[endpointIndex];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (Date.now() > retryDeadline) {
        break;
      }

      const timeoutMs = callTimeoutMs;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Call timeout on ${endpoint} after ${timeoutMs}ms`)), timeoutMs);
      });

      try {
        const data = await Promise.race([
          Promise.resolve().then(() => fn(endpoint)),
          timeoutPromise,
        ]);
        return { data, endpointUsed: endpoint, attempts: attempt };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (err.message.includes("Call timeout") || err.name === "TimeoutError") {
          errors.push(err);
        } else if (isDeterministicContractError(error)) {
          throw error;
        } else if (!isRetryableError(error)) {
          throw error;
        } else {
          errors.push(err);
        }

        if (attempt < maxRetries && Date.now() < retryDeadline) {
          const delay = retryBaseDelayMs * Math.pow(2, attempt - 1);
          await sleep(Math.min(delay, maxRetryMs / (attempt + 1)));
        }
      }
    }
  }

  const last = errors[errors.length - 1] ?? new Error("All RPC endpoints failed");
  throw new RpcAllEndpointsFailedError(last.message, errors);
}

/**
 * Wrap a SorobanRpc.Server.simulateTransaction call with retry logic.
 */
export async function simulateTransactionWithRetry(
  transaction: Parameters<SorobanRpc.Server["simulateTransaction"]>[0],
  config: RpcRetryConfig & { endpoints?: string[] },
): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
  const endpoints = config.endpoints ?? [];
  const retryConfig: RpcRetryConfig = { ...config };
  delete (retryConfig as { endpoints?: string[] }).endpoints;

  return callWithRetry(
    async (url: string) => {
      const s = new SorobanRpc.Server(url);
      return s.simulateTransaction(transaction);
    },
    { endpoints, ...retryConfig },
  );
}
