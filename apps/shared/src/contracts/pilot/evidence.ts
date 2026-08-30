import { scValToNative } from "@stellar/stellar-sdk";
import type {
  EvidenceStatus,
  PilotPayoutSplitClientInterface,
} from "./payout-split";

/**
 * Reading a cycle's evidence record.
 *
 * Kept beside the generated client rather than inside it, so regenerating the
 * bindings does not overwrite this.
 */

/** Status tags as plain strings, for code that does not want the tagged union. */
export type PilotEvidenceStatusTag = EvidenceStatus["tag"];

/**
 * A cycle's evidence record, normalized for application code.
 *
 * Field names are camelCase and timestamps are plain numbers, so callers do not
 * have to carry the contract's snake_case shape or its tagged status union
 * around.
 */
export interface PilotEvidenceRecord {
  cycleId: string;
  /** SHA-256 digest written on-chain. */
  evidenceHash: Buffer;
  evidenceLink: string;
  /** Reported income for the cycle, in USDC stroops. */
  totalIncome: bigint;
  status: PilotEvidenceStatusTag;
  /** Unix seconds. */
  recordedAt: number;
  submittedAt: number;
  /** Unix seconds, or 0 while unreviewed. */
  reviewedAt: number;
  /** Operator's reason on rejection or dispute. Empty otherwise. */
  reviewReason: string;
  distributed: boolean;
  /** Unix seconds, or 0 until the payout executes. */
  distributedAt: number;
}

/** Shape the generic ScVal converter produces for an evidence record. */
interface RawEvidenceRecord {
  cycle_id: string;
  evidence_hash: Buffer;
  evidence_link: string;
  total_income: bigint;
  status: [PilotEvidenceStatusTag];
  recorded_at: bigint;
  submitted_at: bigint;
  reviewed_at: bigint;
  review_reason: string;
  distributed: boolean;
  distributed_at: bigint;
}

function normalize(raw: RawEvidenceRecord): PilotEvidenceRecord {
  return {
    cycleId: raw.cycle_id,
    evidenceHash: raw.evidence_hash,
    evidenceLink: raw.evidence_link,
    totalIncome: raw.total_income,
    status: raw.status[0],
    recordedAt: Number(raw.recorded_at),
    submittedAt: Number(raw.submitted_at),
    reviewedAt: Number(raw.reviewed_at),
    reviewReason: raw.review_reason,
    distributed: raw.distributed,
    distributedAt: Number(raw.distributed_at),
  };
}

/**
 * Reads a cycle's evidence record, or undefined when the cycle is unrecorded.
 *
 * The simulation result is decoded with the generic ScVal converter rather than
 * through the generated client's typed `result`. The contract returns
 * `Option<EvidenceRecord>`, and the pinned @stellar/stellar-sdk (13.3.0) cannot
 * decode an option wrapping a struct: it takes the struct's map value down a
 * branch that expects a spec map type and throws. Verified against a testnet
 * deployment; revisit if the SDK is upgraded.
 */
export async function readEvidence(
  client: PilotPayoutSplitClientInterface,
  cycleId: string,
): Promise<PilotEvidenceRecord | undefined> {
  const tx = await client.get_evidence({ cycle_id: cycleId });
  const retval = tx.simulationData?.result?.retval;
  if (!retval) {
    return undefined;
  }
  const raw = scValToNative(retval) as RawEvidenceRecord | null | undefined;
  return raw ? normalize(raw) : undefined;
}
