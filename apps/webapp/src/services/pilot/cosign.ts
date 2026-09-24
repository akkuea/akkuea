import {
  AssembledTransaction,
  type ClientOptions,
} from "@stellar/stellar-sdk/contract";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import type { Operation, Transaction, xdr } from "@stellar/stellar-sdk";
import {
  buildContractClientOptions,
  PilotIncomeTokenClient,
  PilotPayoutSplitClient,
  type PilotIncomeTokenClientInterface,
  type PilotPayoutSplitClientInterface,
} from "@akkuea/shared";
import {
  assertPilotDeployed,
  pilotContractIds,
  pilotNetworkPassphrase,
  pilotRpcUrl,
} from "./config";
import {
  deriveMinEurcPerUsdc,
  defaultEurcSlippageBps,
  quoteAmountOut,
  SoroswapQuoteError,
} from "./soroswapQuote";
import { EVIDENCE_HASH_BYTES } from "./evidenceHash";
import type { SignXdr } from "./writes";

/**
 * Two-party co-signing for the pilot's dual-authorized contract calls:
 * `execute_distribution`, `record_evidence`, and `exit`.
 *
 * See docs/strategy/decision-log.md, "Two-party signing payload transport",
 * for why this passes a plain JSON string between operator and ally rather
 * than routing through an API relay: it is exactly `AssembledTransaction`'s
 * own documented multi-auth pattern (`toJson()` / `fromJson()` /
 * `signAuthEntries()`), which already keeps the "no key material, no signed
 * payload through the API" property `writes.ts` describes, without this
 * module inventing its own transport or envelope format.
 *
 * Ledger sequence, not wall-clock time, is what actually gates an auth
 * entry's validity on-chain, so every expiry check here reads the RPC's
 * current ledger rather than comparing timestamps.
 */

/** ~5 seconds per ledger, matching the contract's own `SWAP_DEADLINE_SECS`
 * assumption (`apps/contracts/contracts/pilot-payout-split/src/lib.rs`). */
const LEDGER_CLOSE_SECONDS = 5;

/** Default validity window for the ally's auth-entry signature: 24 hours.
 * The SDK's own default (about 8.3 minutes) assumes both parties are at
 * their keyboards together; this flow explicitly does not assume that
 * (operator and ally "usually sign on different machines at different
 * times"). Configurable via `NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS`. */
export function defaultCosignExpiryLedgers(): number {
  const parsedHours = Number.parseFloat(
    process.env.NEXT_PUBLIC_PILOT_COSIGN_EXPIRY_HOURS ?? "",
  );
  const hours =
    Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24;
  return Math.round((hours * 3600) / LEDGER_CLOSE_SECONDS);
}

export class CosignError extends Error {
  constructor(
    message: string,
    /** Machine-checkable reason, for the UI to branch on without parsing text. */
    public readonly reason:
      | "paused"
      | "exited"
      | "cycle_status_changed"
      | "zero_eurc_floor"
      | "quote_failed"
      | "expired"
      | "wrong_signer"
      | "already_signed"
      | "not_ready_to_finalize"
      | "already_recorded"
      | "zero_amount"
      | "invalid_evidence_hash"
      | "missing_evidence_link"
      | "missing_reason",
  ) {
    super(message);
    this.name = "CosignError";
  }
}

/**
 * `PilotPayoutSplitClientInterface` (matching the narrower shape `reads.ts`
 * and `writes.ts` already cast to) omits `fromJSON`: it is a concrete field
 * on the generated class, not part of the hand-written interface. Reusing
 * the interface plus that one field, rather than the whole concrete class,
 * keeps this module's typing consistent with the rest of the codebase's
 * client-construction pattern.
 */
type PayoutClient = PilotPayoutSplitClientInterface &
  Pick<PilotPayoutSplitClient, "fromJSON" | "txFromJson">;

function payoutClient(
  publicKey?: string,
  signTransaction?: SignXdr,
): PayoutClient {
  const ids = pilotContractIds();
  assertPilotDeployed(ids);
  const options: ClientOptions = buildContractClientOptions({
    contractId: ids.payoutSplit,
    networkPassphrase: pilotNetworkPassphrase(),
    rpcUrl: pilotRpcUrl(),
    publicKey,
    signTransaction: signTransaction
      ? async (xdr: string) => ({
          signedTxXdr: await signTransaction(xdr, pilotNetworkPassphrase()),
          signerAddress: publicKey,
        })
      : undefined,
  });
  return new PilotPayoutSplitClient(options) as unknown as PayoutClient;
}

/**
 * `buildContractClientOptions` only ever sets `rpcUrl`, never `server`
 * (`apps/shared/src/contracts/clientConfig.ts`), so `tx.options.server` is
 * typed optional and cannot be relied on for the ledger lookups below. A
 * short-lived `Server` built straight from the same RPC URL avoids that.
 */
function rpcServer(): RpcServer {
  return new RpcServer(pilotRpcUrl());
}

function incomeTokenClient(): PilotIncomeTokenClientInterface {
  const ids = pilotContractIds();
  assertPilotDeployed(ids);
  return new PilotIncomeTokenClient(
    buildContractClientOptions({
      contractId: ids.incomeToken,
      networkPassphrase: pilotNetworkPassphrase(),
      rpcUrl: pilotRpcUrl(),
    }),
  ) as unknown as PilotIncomeTokenClientInterface;
}

/**
 * Whether any current token holder has opted into EURC settlement.
 *
 * `execute_distribution` itself panics with `InvalidMinRate` if this is true
 * and the floor is zero, but only *after* simulating the whole distribution
 * loop, which already pulls every holder's preference. Checking here first
 * lets the UI refuse to even prepare (and quote, and show a confirmation
 * screen for) a transaction that the contract would reject anyway.
 */
export async function anyHolderPrefersEurc(): Promise<boolean> {
  const income = incomeTokenClient();
  const payout = payoutClient();
  const holdersTx = await income.holders();
  const holders = holdersTx.result;
  for (const holder of holders) {
    const prefTx = await payout.get_currency_preference({ holder });
    if (prefTx.result.tag === "Eurc") {
      return true;
    }
  }
  return false;
}

/**
 * Live EURC settlement addresses reported by the contract itself
 * (`eurc_swap_path_status`), never hardcoded on the webapp side. `null`
 * before the contract is initialized.
 */
async function eurcSwapPath(): Promise<{
  router: string;
  usdcToken: string;
  eurcToken: string;
} | null> {
  const payout = payoutClient();
  const tx = await payout.eurc_swap_path_status();
  const status = tx.result;
  if (!status) return null;
  return {
    router: status.swap_router,
    usdcToken: status.usdc_token,
    eurcToken: status.eurc_token,
  };
}

/**
 * Derives `min_eurc_per_usdc` from a live Soroswap quote for the cycle's
 * total distributable amount, at the configured (or given) slippage
 * tolerance.
 *
 * Quoting the *total* distributable amount, not a unit amount, matters: a
 * pool's effective rate moves with trade size, so a floor derived from a
 * 1-USDC quote would be systematically too generous for a real cycle-sized
 * swap and could pass the on-chain guard while still executing at a worse
 * rate than intended.
 */
export async function quoteEurcFloor(args: {
  totalDistributableUsdc: bigint;
  slippageBps?: number;
}): Promise<bigint> {
  const path = await eurcSwapPath();
  if (!path) {
    throw new CosignError(
      "EURC settlement is not configured on this deployment.",
      "quote_failed",
    );
  }
  try {
    const quotedOut = await quoteAmountOut({
      routerAddress: path.router,
      tokenIn: path.usdcToken,
      tokenOut: path.eurcToken,
      amountIn: args.totalDistributableUsdc,
    });
    return deriveMinEurcPerUsdc({
      quotedAmountIn: args.totalDistributableUsdc,
      quotedAmountOut: quotedOut,
      slippageBps: args.slippageBps ?? defaultEurcSlippageBps(),
    });
  } catch (error) {
    if (error instanceof SoroswapQuoteError) {
      throw new CosignError(error.message, "quote_failed");
    }
    throw error;
  }
}

/** Cycle-status precondition the caller already read before preparing; kept
 * separate from the contract's own gate so a stale UI (showing an "approved"
 * cycle that has since been rejected, disputed, or distributed elsewhere)
 * fails with a clear message immediately, rather than a raw contract panic. */
export type CyclePrecondition = "approved" | "not_yet_distributed";

async function assertContractReady(
  payout: PilotPayoutSplitClientInterface,
): Promise<void> {
  const [pausedTx, exitTx] = await Promise.all([
    payout.is_paused(),
    payout.exit_status(),
  ]);
  if (pausedTx.result) {
    throw new CosignError(
      "The pilot contract is paused. Distribution cannot be prepared until it is unpaused.",
      "paused",
    );
  }
  if (exitTx.result) {
    throw new CosignError(
      "This pilot has permanently exited and can no longer distribute funds.",
      "exited",
    );
  }
}

/**
 * `exit` itself is not gated by `pause` (see the contract's own doc comment
 * on `exit`): a paused pilot can still be permanently wound down. Only the
 * already-exited case needs checking client-side.
 */
async function assertNotExited(
  payout: PilotPayoutSplitClientInterface,
): Promise<void> {
  const exitTx = await payout.exit_status();
  if (exitTx.result) {
    throw new CosignError("This pilot has already exited.", "exited");
  }
}

/**
 * The operator's first step: builds, simulates, and returns an
 * `execute_distribution` invocation as a JSON payload the ally can review
 * and co-sign in a separate browser session.
 *
 * Refuses to prepare a zero-floor transaction while any holder prefers
 * EURC, per the issue's own quality bar: this is the moment real money
 * leaves the contract, and a silent zero floor is exactly the bug this
 * flow exists to make structurally impossible from the UI side, on top of
 * (not instead of) the contract's own `InvalidMinRate` guard.
 */
export async function prepareExecuteDistribution(args: {
  operator: string;
  ally: string;
  cycleId: string;
  totalDistributableUsdc: bigint;
  slippageBps?: number;
}): Promise<{ payloadJson: string; expiresAtLedger: number }> {
  const payout = payoutClient(args.operator);
  await assertContractReady(payout);

  const holderPrefersEurc = await anyHolderPrefersEurc();
  let minEurcPerUsdc = BigInt(0);
  if (holderPrefersEurc) {
    minEurcPerUsdc = await quoteEurcFloor({
      totalDistributableUsdc: args.totalDistributableUsdc,
      slippageBps: args.slippageBps,
    });
    if (minEurcPerUsdc <= BigInt(0)) {
      throw new CosignError(
        "Refusing to prepare a distribution with a zero EURC price floor while a holder has opted into EURC.",
        "zero_eurc_floor",
      );
    }
  }

  const tx = await payout.execute_distribution({
    operator: args.operator,
    ally: args.ally,
    cycle_id: args.cycleId,
    min_eurc_per_usdc: minEurcPerUsdc,
  });

  const latestLedger = await rpcServer().getLatestLedger();
  const expiresAtLedger = latestLedger.sequence + defaultCosignExpiryLedgers();

  return { payloadJson: tx.toJson(), expiresAtLedger };
}

/** Everything the confirmation screen needs, decoded from the invocation
 * itself. Every field here is read from `tx.built`/`tx.simulationData`, the
 * reconstructed transaction, never from a value passed in alongside the
 * payload. */
export interface ExecuteDistributionSummary {
  cycleId: string;
  operator: string;
  ally: string;
  minEurcPerUsdc: bigint;
  /** Whether the specific wallet reviewing this still needs to sign. */
  stillNeedsSignatureFrom: string[];
  /** `true` once every non-invoker signature has been collected. */
  readyToFinalize: boolean;
}

/**
 * Reconstructs a shared payload and decodes it into a human-readable
 * summary, for display before either party signs.
 *
 * The `cycleId`/`operator`/`ally`/`minEurcPerUsdc` fields below come from
 * `spec.getFunc("execute_distribution").inputs` zipped against the actual
 * decoded arguments of `tx.built`'s single `invokeHostFunction` operation,
 * the same extraction `AssembledTransaction.fromJson` itself performs to
 * validate the envelope, not from a separately supplied display object -
 * there is no other source these values could come from in this function.
 */
export function summarizeExecuteDistribution(
  payloadJson: string,
): ExecuteDistributionSummary {
  const payout = payoutClient();
  const tx = payout.fromJSON.execute_distribution(payloadJson);
  return decodeExecuteDistributionSummary(tx);
}

/**
 * Decodes a built invocation's arguments straight from `tx.built`, the same
 * extraction `AssembledTransaction.fromJson` itself performs to validate the
 * envelope, keyed by `spec.getFunc(methodName).inputs`. Shared by every
 * dual-signed call's summary decoder below, since none of them have any
 * other source these values could come from.
 */
function decodeInvocationArgs(
  tx: AssembledTransaction<unknown>,
  methodName: string,
): Record<string, unknown> {
  if (!tx.built) {
    throw new CosignError(
      "This payload has not been simulated and cannot be summarized.",
      "not_ready_to_finalize",
    );
  }
  const built = tx.built as Transaction;
  const operation = built.operations[0] as Operation.InvokeHostFunction;
  if (
    operation.type !== "invokeHostFunction" ||
    operation.func.type !== "hostFunctionTypeInvokeContract"
  ) {
    throw new CosignError(
      "This payload does not contain a contract invocation.",
      "not_ready_to_finalize",
    );
  }
  const invokeArgs = operation.func.invokeContract;
  const spec = (
    payoutClient() as unknown as {
      spec: import("@stellar/stellar-sdk/contract").Spec;
    }
  ).spec;
  const funcSpec = spec.getFunc(methodName);
  const decoded: Record<string, unknown> = {};
  funcSpec.inputs.forEach((input: xdr.ScSpecFunctionInputV0, index: number) => {
    decoded[input.name.toString()] = spec.scValToNative(
      invokeArgs.args[index],
      input.type,
    );
  });
  return decoded;
}

function decodeExecuteDistributionSummary(
  tx: AssembledTransaction<unknown>,
): ExecuteDistributionSummary {
  const decoded = decodeInvocationArgs(tx, "execute_distribution");
  return {
    cycleId: String(decoded.cycle_id),
    operator: String(decoded.operator),
    ally: String(decoded.ally),
    minEurcPerUsdc: BigInt(decoded.min_eurc_per_usdc as bigint),
    stillNeedsSignatureFrom: tx.needsNonInvokerSigningBy(),
    readyToFinalize: tx.needsNonInvokerSigningBy().length === 0,
  };
}

/** Shared shape every dual-signed call's summary has, enough for the
 * cosign/finalize plumbing below to work without knowing the specific call. */
interface CosignableSummary {
  ally: string;
  operator: string;
  stillNeedsSignatureFrom: string[];
  readyToFinalize: boolean;
}

/**
 * The ally's step, generic over which dual-signed call `tx` reconstructs:
 * verifies the payload is still within its signing window and actually
 * addressed to this ally, signs their own authorization entry, and returns
 * the updated payload to send back to the operator.
 */
async function coSignAsAllyGeneric<TSummary extends CosignableSummary>(args: {
  tx: AssembledTransaction<unknown>;
  allyAddress: string;
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
  expirationLedger?: number;
  decode: (tx: AssembledTransaction<unknown>) => TSummary;
}): Promise<{ payloadJson: string; summary: TSummary }> {
  const { tx, decode } = args;
  const summary = decode(tx);

  if (summary.ally !== args.allyAddress) {
    throw new CosignError(
      "This request is addressed to a different ally address than the connected wallet.",
      "wrong_signer",
    );
  }
  if (!summary.stillNeedsSignatureFrom.includes(args.allyAddress)) {
    throw new CosignError(
      "This request has already been signed by the ally, or no longer needs the ally's signature.",
      "already_signed",
    );
  }

  const networkPassphrase = pilotNetworkPassphrase();
  try {
    await tx.signAuthEntries({
      address: args.allyAddress,
      expiration:
        args.expirationLedger ??
        (async () => {
          const latest = await rpcServer().getLatestLedger();
          return latest.sequence + defaultCosignExpiryLedgers();
        })(),
      signAuthEntry: async (
        authEntryXdr: string,
        opts?: { networkPassphrase?: string; address?: string },
      ) => ({
        signedAuthEntry: await args.signAuthEntry(
          authEntryXdr,
          opts?.address ?? args.allyAddress,
          opts?.networkPassphrase ?? networkPassphrase,
        ),
        signerAddress: args.allyAddress,
      }),
    });
  } catch (error) {
    throw translateAssembledTransactionError(error);
  }

  return { payloadJson: tx.toJson(), summary: decode(tx) };
}

/**
 * The operator's final step, generic over which dual-signed call `tx`
 * reconstructs: signs the transaction envelope (which is what satisfies the
 * operator's own `require_auth`, since the operator is the transaction's
 * source account) and submits it to the network.
 */
async function finalizeAndSubmitGeneric<
  TSummary extends CosignableSummary,
>(args: {
  tx: AssembledTransaction<unknown>;
  operatorAddress: string;
  decode: (tx: AssembledTransaction<unknown>) => TSummary;
}): Promise<{ hash: string }> {
  const summary = args.decode(args.tx);

  if (summary.operator !== args.operatorAddress) {
    throw new CosignError(
      "This request was prepared by a different operator address than the connected wallet.",
      "wrong_signer",
    );
  }
  if (!summary.readyToFinalize) {
    throw new CosignError(
      `Still waiting on a signature from: ${summary.stillNeedsSignatureFrom.join(", ")}.`,
      "not_ready_to_finalize",
    );
  }

  try {
    await args.tx.sign();
    const sent = await args.tx.send();
    return { hash: sent.sendTransactionResponse?.hash ?? "" };
  } catch (error) {
    throw translateAssembledTransactionError(error);
  }
}

/**
 * The ally's step for `execute_distribution`: reconstructs the shared
 * payload and delegates to the generic co-sign flow above.
 */
export async function coSignAsAlly(args: {
  payloadJson: string;
  allyAddress: string;
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
  expirationLedger?: number;
}): Promise<{ payloadJson: string; summary: ExecuteDistributionSummary }> {
  const payout = payoutClient();
  const tx = payout.fromJSON.execute_distribution(args.payloadJson);
  return coSignAsAllyGeneric({
    ...args,
    tx,
    decode: decodeExecuteDistributionSummary,
  });
}

/**
 * The operator's final step for `execute_distribution`: reconstructs the
 * fully-co-signed payload and delegates to the generic finalize flow above.
 */
export async function finalizeAndSubmitExecuteDistribution(args: {
  payloadJson: string;
  operatorAddress: string;
  signTransaction: SignXdr;
}): Promise<{ hash: string }> {
  const payout = payoutClient(args.operatorAddress, args.signTransaction);
  const tx = payout.fromJSON.execute_distribution(args.payloadJson);
  return finalizeAndSubmitGeneric({
    tx,
    operatorAddress: args.operatorAddress,
    decode: decodeExecuteDistributionSummary,
  });
}

/** Everything the confirmation screen needs for a `record_evidence`
 * invocation, decoded from the invocation itself (see `decodeInvocationArgs`). */
export interface RecordEvidenceSummary {
  cycleId: string;
  operator: string;
  ally: string;
  /** Lowercase hex of the 32-byte evidence digest. */
  evidenceHash: string;
  evidenceLink: string;
  totalIncome: bigint;
  stillNeedsSignatureFrom: string[];
  readyToFinalize: boolean;
}

function decodeRecordEvidenceSummary(
  tx: AssembledTransaction<unknown>,
): RecordEvidenceSummary {
  const decoded = decodeInvocationArgs(tx, "record_evidence");
  return {
    cycleId: String(decoded.cycle_id),
    operator: String(decoded.operator),
    ally: String(decoded.ally),
    evidenceHash: Buffer.from(decoded.evidence_hash as Uint8Array).toString(
      "hex",
    ),
    evidenceLink: String(decoded.evidence_link),
    totalIncome: BigInt(decoded.total_income as bigint),
    stillNeedsSignatureFrom: tx.needsNonInvokerSigningBy(),
    readyToFinalize: tx.needsNonInvokerSigningBy().length === 0,
  };
}

/**
 * The operator's first step: builds, simulates, and returns a
 * `record_evidence` invocation as a JSON payload the ally can review and
 * co-sign.
 *
 * `record_evidence` is a separate, dual-signed shortcut around the
 * single-signer `submit_evidence` / `review_evidence` human-review
 * lifecycle (see the contract's own doc comment): both parties jointly
 * commit an already-approved cycle in one transaction, rather than the
 * ally submitting and the operator reviewing as two separate steps.
 */
export async function prepareRecordEvidence(args: {
  operator: string;
  ally: string;
  cycleId: string;
  evidenceHash: Buffer;
  evidenceLink: string;
  totalIncome: bigint;
}): Promise<{ payloadJson: string; expiresAtLedger: number }> {
  const payout = payoutClient(args.operator);
  await assertContractReady(payout);

  if (args.totalIncome <= BigInt(0)) {
    throw new CosignError(
      "Total income must be greater than zero.",
      "zero_amount",
    );
  }
  if (args.evidenceHash.length !== EVIDENCE_HASH_BYTES) {
    throw new CosignError(
      `Evidence hash must be exactly ${EVIDENCE_HASH_BYTES} bytes.`,
      "invalid_evidence_hash",
    );
  }
  if (args.evidenceLink.trim().length === 0) {
    throw new CosignError(
      "Evidence link is required.",
      "missing_evidence_link",
    );
  }

  const existing = await payout.get_evidence({ cycle_id: args.cycleId });
  if (existing.result) {
    throw new CosignError(
      "Evidence has already been recorded for this cycle.",
      "already_recorded",
    );
  }

  const tx = await payout.record_evidence({
    operator: args.operator,
    ally: args.ally,
    cycle_id: args.cycleId,
    evidence_hash: args.evidenceHash,
    evidence_link: args.evidenceLink,
    total_income: args.totalIncome,
  });

  const latestLedger = await rpcServer().getLatestLedger();
  const expiresAtLedger = latestLedger.sequence + defaultCosignExpiryLedgers();
  return { payloadJson: tx.toJson(), expiresAtLedger };
}

/**
 * Reconstructs a shared `record_evidence` payload and decodes it into a
 * human-readable summary, for display before either party signs.
 */
export function summarizeRecordEvidence(
  payloadJson: string,
): RecordEvidenceSummary {
  const payout = payoutClient();
  const tx = payout.fromJSON.record_evidence(payloadJson);
  return decodeRecordEvidenceSummary(tx);
}

/** The ally's step for `record_evidence`. */
export async function coSignRecordEvidenceAsAlly(args: {
  payloadJson: string;
  allyAddress: string;
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
  expirationLedger?: number;
}): Promise<{ payloadJson: string; summary: RecordEvidenceSummary }> {
  const payout = payoutClient();
  const tx = payout.fromJSON.record_evidence(args.payloadJson);
  return coSignAsAllyGeneric({
    ...args,
    tx,
    decode: decodeRecordEvidenceSummary,
  });
}

/** The operator's final step for `record_evidence`. */
export async function finalizeAndSubmitRecordEvidence(args: {
  payloadJson: string;
  operatorAddress: string;
  signTransaction: SignXdr;
}): Promise<{ hash: string }> {
  const payout = payoutClient(args.operatorAddress, args.signTransaction);
  const tx = payout.fromJSON.record_evidence(args.payloadJson);
  return finalizeAndSubmitGeneric({
    tx,
    operatorAddress: args.operatorAddress,
    decode: decodeRecordEvidenceSummary,
  });
}

/** Everything the confirmation screen needs for an `exit` invocation,
 * decoded from the invocation itself (see `decodeInvocationArgs`). */
export interface ExitSummary {
  operator: string;
  ally: string;
  reason: string;
  stillNeedsSignatureFrom: string[];
  readyToFinalize: boolean;
}

function decodeExitSummary(tx: AssembledTransaction<unknown>): ExitSummary {
  const decoded = decodeInvocationArgs(tx, "exit");
  return {
    operator: String(decoded.operator),
    ally: String(decoded.ally),
    reason: String(decoded.reason),
    stillNeedsSignatureFrom: tx.needsNonInvokerSigningBy(),
    readyToFinalize: tx.needsNonInvokerSigningBy().length === 0,
  };
}

/**
 * The operator's first step: builds, simulates, and returns an `exit`
 * invocation as a JSON payload the ally can review and co-sign.
 *
 * Permanent and irreversible once finalized (see the contract's own doc
 * comment on `exit`), so this is the one flow in this module where the UI
 * should make the operator confirm the reason is final before preparing it,
 * not just before finalizing it.
 */
export async function prepareExit(args: {
  operator: string;
  ally: string;
  reason: string;
}): Promise<{ payloadJson: string; expiresAtLedger: number }> {
  const payout = payoutClient(args.operator);
  await assertNotExited(payout);

  if (args.reason.trim().length === 0) {
    throw new CosignError("A reason is required to exit.", "missing_reason");
  }

  const tx = await payout.exit({
    operator: args.operator,
    ally: args.ally,
    reason: args.reason,
  });

  const latestLedger = await rpcServer().getLatestLedger();
  const expiresAtLedger = latestLedger.sequence + defaultCosignExpiryLedgers();
  return { payloadJson: tx.toJson(), expiresAtLedger };
}

/**
 * Reconstructs a shared `exit` payload and decodes it into a human-readable
 * summary, for display before either party signs.
 */
export function summarizeExit(payloadJson: string): ExitSummary {
  const payout = payoutClient();
  const tx = payout.fromJSON.exit(payloadJson);
  return decodeExitSummary(tx);
}

/** The ally's step for `exit`. */
export async function coSignExitAsAlly(args: {
  payloadJson: string;
  allyAddress: string;
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
  expirationLedger?: number;
}): Promise<{ payloadJson: string; summary: ExitSummary }> {
  const payout = payoutClient();
  const tx = payout.fromJSON.exit(args.payloadJson);
  return coSignAsAllyGeneric({
    ...args,
    tx,
    decode: decodeExitSummary,
  });
}

/** The operator's final step for `exit`. */
export async function finalizeAndSubmitExit(args: {
  payloadJson: string;
  operatorAddress: string;
  signTransaction: SignXdr;
}): Promise<{ hash: string }> {
  const payout = payoutClient(args.operatorAddress, args.signTransaction);
  const tx = payout.fromJSON.exit(args.payloadJson);
  return finalizeAndSubmitGeneric({
    tx,
    operatorAddress: args.operatorAddress,
    decode: decodeExitSummary,
  });
}

/**
 * Which dual-signed call a shared payload reconstructs. Read straight off
 * the built invocation's function name, the same way `decodeInvocationArgs`
 * reads its arguments, so the ally's review screen can accept whichever of
 * the three payload types the operator actually sent without needing to be
 * told in advance which one it is.
 */
type CosignPayloadKind = "execute_distribution" | "record_evidence" | "exit";

function detectCosignPayloadKind(payloadJson: string): CosignPayloadKind {
  const payout = payoutClient();
  const tx = payout.txFromJson(payloadJson);
  if (!tx.built) {
    throw new CosignError(
      "This payload has not been simulated and cannot be reviewed.",
      "not_ready_to_finalize",
    );
  }
  const built = tx.built as Transaction;
  const operation = built.operations[0] as Operation.InvokeHostFunction;
  if (
    operation.type !== "invokeHostFunction" ||
    operation.func.type !== "hostFunctionTypeInvokeContract"
  ) {
    throw new CosignError(
      "This payload does not contain a contract invocation.",
      "not_ready_to_finalize",
    );
  }
  const methodName =
    operation.func.invokeContract.functionName.toStringStrict();
  if (
    methodName === "execute_distribution" ||
    methodName === "record_evidence" ||
    methodName === "exit"
  ) {
    return methodName;
  }
  throw new CosignError(
    `This payload invokes "${methodName}", which this dashboard does not review.`,
    "not_ready_to_finalize",
  );
}

/** A decoded summary of any of the three dual-signed calls, tagged by which
 * one it is so a single paste-and-review UI can render the right fields and
 * dispatch to the right co-sign/finalize function. */
export type AnyCosignSummary =
  | ({ kind: "execute_distribution" } & ExecuteDistributionSummary)
  | ({ kind: "record_evidence" } & RecordEvidenceSummary)
  | ({ kind: "exit" } & ExitSummary);

/** Reconstructs any of the three dual-signed payloads and decodes it,
 * detecting which one it is from the invocation itself. */
export function summarizeCosignPayload(payloadJson: string): AnyCosignSummary {
  const kind = detectCosignPayloadKind(payloadJson);
  switch (kind) {
    case "execute_distribution":
      return { kind, ...summarizeExecuteDistribution(payloadJson) };
    case "record_evidence":
      return { kind, ...summarizeRecordEvidence(payloadJson) };
    case "exit":
      return { kind, ...summarizeExit(payloadJson) };
  }
}

/** The ally's step for any of the three dual-signed payloads, detecting
 * which one it is and dispatching to the matching co-sign function. */
export async function coSignPayloadAsAlly(args: {
  payloadJson: string;
  allyAddress: string;
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
  expirationLedger?: number;
}): Promise<{ payloadJson: string; summary: AnyCosignSummary }> {
  const kind = detectCosignPayloadKind(args.payloadJson);
  switch (kind) {
    case "execute_distribution": {
      const result = await coSignAsAlly(args);
      return {
        payloadJson: result.payloadJson,
        summary: { kind, ...result.summary },
      };
    }
    case "record_evidence": {
      const result = await coSignRecordEvidenceAsAlly(args);
      return {
        payloadJson: result.payloadJson,
        summary: { kind, ...result.summary },
      };
    }
    case "exit": {
      const result = await coSignExitAsAlly(args);
      return {
        payloadJson: result.payloadJson,
        summary: { kind, ...result.summary },
      };
    }
  }
}

/**
 * Maps the SDK's own typed `AssembledTransaction` errors to `CosignError`,
 * so the UI can branch on `reason` instead of matching error message text.
 */
function translateAssembledTransactionError(error: unknown): Error {
  const errors = AssembledTransaction.Errors;
  if (error instanceof errors.ExpiredState) {
    return new CosignError(
      "This request has expired. Ask the operator to prepare a new one.",
      "expired",
    );
  }
  if (error instanceof errors.RestorationFailure) {
    return new CosignError(
      "On-chain state needed for this transaction has expired from the ledger and could not be restored automatically.",
      "expired",
    );
  }
  if (error instanceof errors.NeedsMoreSignatures) {
    return new CosignError(
      "This request still needs another signature before it can be finalized.",
      "not_ready_to_finalize",
    );
  }
  if (error instanceof errors.SimulationFailed) {
    return new CosignError(
      `Simulation failed: ${error.message}. The cycle's status may have changed since this request was prepared.`,
      "cycle_status_changed",
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}
