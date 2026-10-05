import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
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
const DEFAULT_CALL_TIMEOUT_MS = 10_000;

/** HTTP status codes considered transient (retryable). */
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isDeterministicContractError(error: unknown): boolean {
  const messages: string[] = [];

  if (error instanceof Error) {
    messages.push(error.message);
  }

  if (typeof error === "object" && error !== null) {
    const value = error as { error?: unknown };
    if (typeof value.error === "string") {
      messages.push(value.error);
    }
  }

  const msg = messages.join(" ").toLowerCase();

  return [
    "hosterror",
    "error(contract",
    "simulation failed",
    "entrypoint",
    "panic",
    "assert",
    "instruction",
  ].some((pattern) => msg.includes(pattern));
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();

  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("socket hang up") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("rate limit")
  ) {
    return true;
  }

  for (const code of TRANSIENT_STATUS_CODES) {
    const pattern = new RegExp(
      `\\b(?:status(?:\\s*code)?|http)\\s*[:=]?\\s*${code}\\b`,
      "i",
    );

    if (pattern.test(msg)) return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveRpcEndpoints(networkPassphrase: string): RpcEndpoint[] {
  const isPublic =
    networkPassphrase === "Public Global Stellar Network ; September 2015";
  const baseUrl = isPublic
    ? API_ENDPOINTS.SOROBAN_RPC.MAINNET
    : API_ENDPOINTS.SOROBAN_RPC.TESTNET;

  return [
    {
      url: baseUrl,
      label: isPublic ? "mainnet-primary" : "testnet-primary",
    },
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

  for (const endpoint of endpoints) {
    if (!endpoint) continue;

    const endpointDeadline = Date.now() + maxRetryMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (Date.now() >= endpointDeadline) break;

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new Error(`Call timeout on ${endpoint} after ${callTimeoutMs}ms`),
            );
          }, callTimeoutMs);
        });

        const data = await Promise.race([
          Promise.resolve().then(() => fn(endpoint)),
          timeoutPromise,
        ]);

        return { data, endpointUsed: endpoint, attempts: attempt };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (isDeterministicContractError(error)) {
          throw error;
        }

        if (!isRetryableError(err)) {
          throw error;
        }

        errors.push(err);

        if (attempt < maxRetries && Date.now() < endpointDeadline) {
          const delay = retryBaseDelayMs * Math.pow(2, attempt - 1);
          const remaining = endpointDeadline - Date.now();
          if (remaining > 0) {
            await sleep(Math.min(delay, remaining));
          }
        }
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    }
  }

  const last =
    errors[errors.length - 1] ?? new Error("All RPC endpoints failed");

  throw new RpcAllEndpointsFailedError(last.message, errors);
}

/**
 * Wrap a SorobanRpc.Server.simulateTransaction call with retry logic.
 */
export async function simulateTransactionWithRetry(
  transaction: Parameters<SorobanRpc.Server["simulateTransaction"]>[0],
  config: RpcRetryConfig & { endpoints?: string[]; networkPassphrase?: string },
): Promise<SorobanRpc.Api.SimulateTransactionResponse> {
  const endpoints = resolveSorobanRpcEndpoints(
    config.networkPassphrase ?? "Test SDF Network ; September 2015",
    undefined,
    config.endpoints,
  );
  const retryConfig: RpcRetryConfig = { ...config };
  delete (retryConfig as { endpoints?: string[] }).endpoints;
  delete (retryConfig as { networkPassphrase?: string }).networkPassphrase;

  const result = await callWithRetry(
    async (url: string) => {
      const s = new SorobanRpc.Server(url);
      return s.simulateTransaction(transaction);
    },
    { endpoints, ...retryConfig },
  );
  return result.data;
}
