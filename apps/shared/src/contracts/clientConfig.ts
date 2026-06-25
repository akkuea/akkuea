import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import type {
  ClientOptions,
  SignTransaction,
} from "@stellar/stellar-sdk/contract";
import { API_ENDPOINTS } from "../constants";

export interface SorobanClientConfig {
  contractId: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  publicKey?: string;
  signTransaction?: SignTransaction;
  allowHttp?: boolean;
}

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
