import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import type {
  ClientOptions,
  SignTransaction,
} from "@stellar/stellar-sdk/contract";
import { API_ENDPOINTS } from "../constants/index.js";
import { resolveRpcEndpoints } from "./rpc.js";

export interface SorobanClientConfig {
  contractId: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  /** Ordered list of RPC fallback URLs. Overrides rpcUrl and defaults. */
  rpcUrls?: string[];
  publicKey?: string;
  signTransaction?: SignTransaction;
  allowHttp?: boolean;
}

/** Resolve the Soroban RPC URL (single, backward-compatible). */
export function resolveSorobanRpcUrl(
  networkPassphrase: string,
  rpcUrl?: string,
): string {
  if (rpcUrl) {
    return rpcUrl;
  }

  return networkPassphrase === Networks.PUBLIC
    ? API_ENDPOINTS.SOROBAN_RPC.MAINNET
    : API_ENDPOINTS.SOROBAN_RPC.TESTNET;
}

/**
 * Resolve an ordered list of RPC endpoints for the given network.
 * Primary first, fallbacks after. Respects explicit overrides.
 */
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

export function createNodeContractSigner(
  secretKey: string,
  networkPassphrase: string,
): { publicKey: string; signTransaction: SignTransaction } {
  const keypair = Keypair.fromSecret(secretKey);

  return {
    publicKey: keypair.publicKey(),
    signTransaction: async (xdr: string) => {
      const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
      transaction.sign(keypair);

      return {
        signedTxXdr: transaction.toXDR(),
        signerAddress: keypair.publicKey(),
      };
    },
  };
}

export function buildContractClientOptions(
  config: SorobanClientConfig,
): ClientOptions {
  const networkPassphrase = config.networkPassphrase ?? Networks.TESTNET;

  return {
    contractId: config.contractId,
    networkPassphrase,
    rpcUrl: resolveSorobanRpcUrl(networkPassphrase, config.rpcUrl),
    publicKey: config.publicKey,
    signTransaction: config.signTransaction,
    allowHttp: config.allowHttp,
  };
}

export interface RetryableClientOptions extends ClientOptions {
  rpcUrls: string[];
}

export interface RpcRetryConfig {
  maxRetries: number;
  retryBaseDelayMs: number;
  maxRetryMs: number;
  callTimeoutMs: number;
}

/**
 * Build contract client options with the ordered RPC endpoints
 * for use with the retry layer.
 */
export function buildContractClientOptionsWithRetry(
  config: SorobanClientConfig,
): { clientOptions: ClientOptions; rpcUrls: string[]; retryConfig: RpcRetryConfig } {
  const networkPassphrase = config.networkPassphrase ?? Networks.TESTNET;
  const rpcUrls = resolveSorobanRpcEndpoints(
    networkPassphrase,
    config.rpcUrl,
    config.rpcUrls,
  );

  return {
    clientOptions: {
      contractId: config.contractId,
      networkPassphrase,
      rpcUrl: rpcUrls[0] ?? resolveSorobanRpcUrl(networkPassphrase, config.rpcUrl),
      publicKey: config.publicKey,
      signTransaction: config.signTransaction,
      allowHttp: config.allowHttp,
    },
    rpcUrls,
    retryConfig: {
      maxRetries: 3,
      retryBaseDelayMs: 2_000,
      maxRetryMs: 30_000,
      callTimeoutMs: 30_000,
    },
  };
}
