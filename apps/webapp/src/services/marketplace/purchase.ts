import { API_ENDPOINTS } from "@akkuea/shared";
import { Networks, TransactionBuilder, rpc as SorobanRpc } from "@stellar/stellar-sdk";

/**
 * Submission layer for buyer-signed share purchases.
 *
 * The API prepares the transaction and later verifies what landed on-chain,
 * but signing and submission stay with the buyer's wallet and Soroban RPC, so
 * no key material and no signed payload passes through the API. This mirrors
 * `services/pilot/writes.ts`: a signed write with no hash was not confirmed as
 * submitted, so it is surfaced as an error instead of returning an empty hash
 * the UI would show as a success.
 */

export type PurchaseNetwork = "testnet" | "mainnet";

/** How many times submission is polled for inclusion before giving up. */
const GET_TRANSACTION_ATTEMPTS = 10;
const GET_TRANSACTION_DELAY_MS = 1000;

export function purchaseNetworkPassphrase(network: PurchaseNetwork): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
}

export function purchaseRpcUrl(network: PurchaseNetwork): string {
  return network === "mainnet"
    ? API_ENDPOINTS.SOROBAN_RPC.MAINNET
    : API_ENDPOINTS.SOROBAN_RPC.TESTNET;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls Soroban RPC until the transaction leaves the mempool state.
 * Resolves to "SUCCESS" | "FAILED" | "UNKNOWN".
 */
async function waitForTransaction(
  server: InstanceType<typeof SorobanRpc.Server>,
  hash: string,
): Promise<"SUCCESS" | "FAILED" | "UNKNOWN"> {
  for (let attempt = 0; attempt < GET_TRANSACTION_ATTEMPTS; attempt += 1) {
    const response = await server.getTransaction(hash);
    if (response.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return "SUCCESS";
    }
    if (response.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      return "FAILED";
    }
    await sleep(GET_TRANSACTION_DELAY_MS);
  }
  return "UNKNOWN";
}

/**
 * Submits a signed share purchase to Soroban RPC and waits until it is
 * included on-chain. Returns the real transaction hash the API confirms with.
 *
 * @throws when submission reports an error, when no hash comes back, when the
 * transaction fails on-chain, or when it is still pending after all attempts.
 */
export async function submitSignedPurchase(
  signedXdr: string,
  network: PurchaseNetwork,
): Promise<{ hash: string }> {
  const rpcUrl = purchaseRpcUrl(network);
  const server = new SorobanRpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  });
  const signedTransaction = TransactionBuilder.fromXDR(
    signedXdr,
    purchaseNetworkPassphrase(network),
  );

  const sent = await server.sendTransaction(signedTransaction);
  if (sent.status === "ERROR") {
    throw new Error(
      "The network rejected the transaction, so it was not submitted. Check the explorer before trying again.",
    );
  }

  const hash = sent.hash;
  if (!hash) {
    throw new Error(
      "The transaction was signed but the network returned no transaction hash, so it cannot be confirmed as submitted. Check the explorer before trying again.",
    );
  }

  const outcome = await waitForTransaction(server, hash);
  if (outcome === "FAILED") {
    throw new Error(
      `The transaction failed on-chain, so the purchase was not recorded. Check ${hash} in the explorer before trying again.`,
    );
  }
  if (outcome === "UNKNOWN") {
    throw new Error(
      `The network has not included transaction ${hash} yet. Wait for it to confirm, then try again.`,
    );
  }

  return { hash };
}
