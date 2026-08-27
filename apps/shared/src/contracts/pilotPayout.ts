import { scValToNative } from "@stellar/stellar-sdk";
import type {
  AssembledTransaction,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import {
  Client as GeneratedPayoutSplitClient,
  type DistributionSummary,
  type EvidenceStatus,
} from "./generated/pilotPayoutSplit";
import { Client as GeneratedIncomeTokenClient } from "./generated/pilotIncomeToken";
import { Client as GeneratedWhitelistClient } from "./generated/pilotWhitelist";
import {
  buildContractClientOptions,
  type SorobanClientConfig,
} from "./clientConfig";

export type {
  DistributionSummary,
  EvidenceRecord,
  EvidenceStatus,
} from "./generated/pilotPayoutSplit";

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

/** Shape returned by the generic ScVal converter for an evidence record. */
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

function normalizeEvidence(raw: RawEvidenceRecord): PilotEvidenceRecord {
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

export interface SubmitEvidenceArgs {
  ally: string;
  cycleId: string;
  /** SHA-256 digest of the evidence file. Exactly 32 bytes. */
  evidenceHash: Buffer;
  evidenceLink: string;
  /** Reported income for the cycle, in USDC stroops. */
  totalIncome: bigint;
}

export interface ReviewEvidenceArgs {
  operator: string;
  cycleId: string;
  approved: boolean;
  /** Required when rejecting. The contract refuses an empty rejection reason. */
  reason: string;
}

export interface RecordEvidenceArgs extends SubmitEvidenceArgs {
  operator: string;
}

export interface FlagDisputeArgs {
  /** Admin or operator address. Anyone else is rejected on-chain. */
  caller: string;
  cycleId: string;
  reason: string;
}

/**
 * Typed access to the pilot's payout-split contract.
 *
 * Read methods simulate rather than submit, so a disconnected visitor can still
 * see the dashboard. Write methods return an `AssembledTransaction` for the
 * caller to sign with a connected wallet.
 */
export class PilotPayoutContractClient {
  constructor(private readonly client: GeneratedPayoutSplitClient) {}

  static fromConfig(config: SorobanClientConfig): PilotPayoutContractClient {
    return new PilotPayoutContractClient(
      new GeneratedPayoutSplitClient(buildContractClientOptions(config)),
    );
  }

  /**
   * Read a cycle's evidence record. Resolves to undefined when unrecorded.
   *
   * The simulation result is decoded with the generic ScVal converter rather
   * than through the generated client's typed `result`. The contract returns
   * `Option<EvidenceRecord>`, and the pinned @stellar/stellar-sdk (13.3.0)
   * cannot decode an option wrapping a struct: it takes the struct's map value
   * down a branch that expects a spec map type and throws. Verified against the
   * testnet deployment; revisit if the SDK is upgraded.
   */
  async getEvidence(
    cycleId: string,
    options?: MethodOptions,
  ): Promise<PilotEvidenceRecord | undefined> {
    const tx = await this.client.get_evidence({ cycle_id: cycleId }, options);
    const retval = tx.simulationData?.result?.retval;
    if (!retval) {
      return undefined;
    }
    const raw = scValToNative(retval) as RawEvidenceRecord | null | undefined;
    return raw ? normalizeEvidence(raw) : undefined;
  }

  isPaused(options?: MethodOptions): Promise<AssembledTransaction<boolean>> {
    return this.client.is_paused(options);
  }

  submitEvidence(
    args: SubmitEvidenceArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.submit_evidence(
      {
        ally: args.ally,
        cycle_id: args.cycleId,
        evidence_hash: args.evidenceHash,
        evidence_link: args.evidenceLink,
        total_income: args.totalIncome,
      },
      options,
    );
  }

  startReview(
    operator: string,
    cycleId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.start_review({ operator, cycle_id: cycleId }, options);
  }

  reviewEvidence(
    args: ReviewEvidenceArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.review_evidence(
      {
        operator: args.operator,
        cycle_id: args.cycleId,
        approved: args.approved,
        reason: args.reason,
      },
      options,
    );
  }

  flagDispute(
    args: FlagDisputeArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.flag_dispute(
      {
        caller: args.caller,
        cycle_id: args.cycleId,
        reason: args.reason,
      },
      options,
    );
  }

  /**
   * Co-signed fast path: the operator and the ally authorize one invocation and
   * the cycle lands already approved.
   */
  recordEvidence(
    args: RecordEvidenceArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    return this.client.record_evidence(
      {
        operator: args.operator,
        ally: args.ally,
        cycle_id: args.cycleId,
        evidence_hash: args.evidenceHash,
        evidence_link: args.evidenceLink,
        total_income: args.totalIncome,
      },
      options,
    );
  }

  executeDistribution(
    cycleId: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<DistributionSummary>> {
    return this.client.execute_distribution({ cycle_id: cycleId }, options);
  }
}

/** Typed access to the pilot's non-transferable income participation token. */
export class PilotIncomeTokenContractClient {
  constructor(private readonly client: GeneratedIncomeTokenClient) {}

  static fromConfig(
    config: SorobanClientConfig,
  ): PilotIncomeTokenContractClient {
    return new PilotIncomeTokenContractClient(
      new GeneratedIncomeTokenClient(buildContractClientOptions(config)),
    );
  }

  balance(
    address: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<bigint>> {
    return this.client.balance({ id: address }, options);
  }

  totalSupply(options?: MethodOptions): Promise<AssembledTransaction<bigint>> {
    return this.client.total_supply(options);
  }

  holders(
    options?: MethodOptions,
  ): Promise<AssembledTransaction<Array<string>>> {
    return this.client.holders(options);
  }

  symbol(options?: MethodOptions): Promise<AssembledTransaction<string>> {
    return this.client.symbol(options);
  }

  decimals(options?: MethodOptions): Promise<AssembledTransaction<number>> {
    return this.client.decimals(options);
  }
}

/** Typed access to the pilot's investor whitelist. */
export class PilotWhitelistContractClient {
  constructor(private readonly client: GeneratedWhitelistClient) {}

  static fromConfig(config: SorobanClientConfig): PilotWhitelistContractClient {
    return new PilotWhitelistContractClient(
      new GeneratedWhitelistClient(buildContractClientOptions(config)),
    );
  }

  isApproved(
    address: string,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<boolean>> {
    return this.client.is_approved({ address }, options);
  }
}
