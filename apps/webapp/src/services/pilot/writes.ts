import {
  buildContractClientOptions,
  PilotPayoutSplitClient,
  type PilotPayoutSplitClientInterface,
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

  // See reads.ts: the interface is what types the spec-driven call surface.
  return new PilotPayoutSplitClient(
    buildContractClientOptions({
      contractId: ids.payoutSplit,
      networkPassphrase,
      rpcUrl: pilotRpcUrl(),
      publicKey,
      signTransaction: async (xdr: string) => ({
        signedTxXdr: await signXdr(xdr, networkPassphrase),
        signerAddress: publicKey,
      }),
    }),
  ) as unknown as PilotPayoutSplitClientInterface;
}

/** Result of a submitted pilot transaction. */
export interface PilotTxResult {
  hash: string;
}

async function send(tx: {
  signAndSend: () => Promise<{
    sendTransactionResponse?: { hash?: string } | null;
  }>;
}): Promise<PilotTxResult> {
  const sent = await tx.signAndSend();
  return { hash: sent.sendTransactionResponse?.hash ?? "" };
}

export interface SubmitEvidenceArgs {
  ally: string;
  cycleId: string;
  /** SHA-256 digest of the evidence file. Exactly 32 bytes. */
  evidenceHash: Buffer;
  evidenceLink: string;
  /** Reported income for the cycle, in USDC stroops. */
  totalIncome: bigint;
}

/** The ally submits a cycle's evidence, moving it into the review queue. */
export async function submitEvidence(
  args: SubmitEvidenceArgs,
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.ally, signXdr);
  return send(
    await client.submit_evidence({
      ally: args.ally,
      cycle_id: args.cycleId,
      evidence_hash: args.evidenceHash,
      evidence_link: args.evidenceLink,
      total_income: args.totalIncome,
    }),
  );
}

/** The operator opens a submitted cycle, so the ally can see it was picked up. */
export async function startReview(
  operator: string,
  cycleId: string,
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(operator, signXdr);
  return send(await client.start_review({ operator, cycle_id: cycleId }));
}

/** The operator approves, or rejects with a reason the ally and investors see. */
export async function reviewEvidence(
  args: {
    operator: string;
    cycleId: string;
    approved: boolean;
    reason: string;
  },
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.operator, signXdr);
  return send(
    await client.review_evidence({
      operator: args.operator,
      cycle_id: args.cycleId,
      approved: args.approved,
      reason: args.reason,
    }),
  );
}

/** Flags a cycle as disputed. The admin or the operator may call this. */
export async function flagDispute(
  args: { caller: string; cycleId: string; reason: string },
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.caller, signXdr);
  return send(
    await client.flag_dispute({
      caller: args.caller,
      cycle_id: args.cycleId,
      reason: args.reason,
    }),
  );
}

/**
 * Price floor for EURC settlement, scaled by the contract's rate denominator.
 *
 * The pilot settles in USDC, and the contract ignores this bound when no holder
 * has opted into EURC, so zero is correct until a holder does.
 */
export const DEFAULT_MIN_EURC_PER_USDC = BigInt(0);

/**
 * Executes an approved cycle's payout.
 *
 * The contract requires the operator and the ally to authorize the same
 * invocation, so this cannot be driven by one connected wallet alone: the
 * signer has to be able to produce both auth entries. The contract also gates
 * on approved evidence, so a rejected, disputed, or still-pending cycle fails
 * on-chain rather than relying on the UI to hide the action.
 */
export async function executeDistribution(
  args: {
    operator: string;
    ally: string;
    cycleId: string;
    minEurcPerUsdc?: bigint;
  },
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.operator, signXdr);
  return send(
    await client.execute_distribution({
      operator: args.operator,
      ally: args.ally,
      cycle_id: args.cycleId,
      min_eurc_per_usdc: args.minEurcPerUsdc ?? DEFAULT_MIN_EURC_PER_USDC,
    }),
  );
}
