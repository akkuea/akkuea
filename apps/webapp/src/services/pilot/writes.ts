import {
  buildContractClientOptions,
  PilotPayoutSplitClient,
  type PilotPayoutSplitClientInterface,
  type PilotSettlementCurrency,
} from "@akkuea/shared";
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
 * Sets the connected holder's own settlement-currency preference.
 *
 * The contract gates this on the holder's own signature and on whitelist
 * approval, so only the connected wallet can change what it is paid in.
 */
export async function setCurrencyPreference(
  args: { holder: string; currency: PilotSettlementCurrency },
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(args.holder, signXdr);
  return send(
    await client.set_currency_preference({
      holder: args.holder,
      currency:
        args.currency === "eurc"
          ? { tag: "Eurc", values: undefined }
          : { tag: "Usdc", values: undefined },
    }),
  );
}

/**
 * Claims USDC the contract withheld after a failed EURC swap leg.
 *
 * Self-serve and available even while the contract is paused or exited, because
 * the funds already belong to the holder. The contract rejects a claim with
 * nothing reserved using the typed `NothingToClaim` error.
 */
export async function claimWithheld(
  holder: string,
  signXdr: SignXdr,
): Promise<PilotTxResult> {
  const client = payoutClient(holder, signXdr);
  return send(await client.claim_withheld({ holder }));
}
