import {
  PilotPayoutContractClient,
  type SubmitEvidenceArgs,
} from "@real-estate-defi/shared";
import {
  assertPilotDeployed,
  pilotContractIds,
  pilotNetworkPassphrase,
  pilotRpcUrl,
} from "./config";

/**
 * Write layer for the pilot dashboard.
 *
 * Every write is a wallet-signed contract invocation. The dashboard builds and
 * simulates the transaction, the connected wallet signs it, and Soroban RPC
 * submits it. No key material and no signed payload passes through the API.
 */

/**
 * Signs an XDR with the connected wallet.
 *
 * Matches `useWallet`'s contract, which resolves to the signed XDR string. The
 * Soroban contract client expects an object instead, so the adapter below is
 * where the two shapes meet rather than at every call site.
 */
export type SignXdr = (
  xdr: string,
  networkPassphrase: string,
) => Promise<string>;

function payoutClient(publicKey: string, signXdr: SignXdr) {
  const ids = pilotContractIds();
  assertPilotDeployed(ids);
  const networkPassphrase = pilotNetworkPassphrase();

  return PilotPayoutContractClient.fromConfig({
    contractId: ids.payoutSplit,
    networkPassphrase,
    rpcUrl: pilotRpcUrl(),
    publicKey,
    signTransaction: async (xdr) => ({
      signedTxXdr: await signXdr(xdr, networkPassphrase),
      signerAddress: publicKey,
    }),
  });
}

/** Result of a submitted pilot transaction. */
export interface PilotTxResult {
  hash: string;
}

async function send(
  tx: { signAndSend: () => Promise<{ sendTransactionResponse?: { hash?: string } | null }> },
): Promise<PilotTxResult> {
  const sent = await tx.signAndSend();
  return { hash: sent.sendTransactionResponse?.hash ?? "" };
}

/** The ally submits a cycle's evidence, moving it into the review queue. */
export async function submitEvidence(
  args: SubmitEvidenceArgs,
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.ally, signXdr);
  return send(await client.submitEvidence(args));
}

/** The operator opens a submitted cycle, so the ally can see it was picked up. */
export async function startReview(
  operator: string,
  cycleId: string,
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(operator, signXdr);
  return send(await client.startReview(operator, cycleId));
}

/** The operator approves, or rejects with a reason the ally and investors see. */
export async function reviewEvidence(
  args: { operator: string; cycleId: string; approved: boolean; reason: string },
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.operator, signXdr);
  return send(await client.reviewEvidence(args));
}

/** Flags a cycle as disputed. The admin or the operator may call this. */
export async function flagDispute(
  args: { caller: string; cycleId: string; reason: string },
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.caller, signXdr);
  return send(await client.flagDispute(args));
}

/**
 * Executes an approved cycle's payout.
 *
 * The contract itself gates this on approved evidence, so a rejected, disputed,
 * or still-pending cycle fails on-chain rather than relying on the UI to hide
 * the button.
 */
export async function executeDistribution(
  caller: string,
  cycleId: string,
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(caller, signXdr);
  return send(await client.executeDistribution(cycleId));
}
