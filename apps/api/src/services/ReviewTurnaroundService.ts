import { and, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { getPilotReviewSlaConfig, type PilotReviewSlaConfig } from '../config/pilotReviewSla';
import { getPilotPayoutSplitContractId } from '../config/contracts';
import { PilotPayoutEvidenceReader, type EvidenceLookupResult } from './PilotPayoutEvidenceReader';
import { buildExpectedCycles } from '../workers/pilotEscalation/expectedCycles';
import { logger } from './logger';
import {
  computeReviewTurnaround,
  emptyTurnaroundMetrics,
  resolveMetricsWindow,
  type MetricsWindowQuery,
  type ReviewSample,
  type ReviewTurnaroundMetrics,
  type ReviewWindow,
} from './reviewTurnaround';
import { BadRequestError } from '../utils/errors';

export interface WhitelistRequestRow {
  id: string;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface EvidenceReaderLike {
  hasEvidence(cycleId: string): Promise<EvidenceLookupResult>;
}

export type EvidenceUnavailableReason =
  | 'agreement_start_not_configured'
  | 'contract_not_configured'
  | 'rpc_error';

export interface EvidenceTurnaroundMetrics extends ReviewTurnaroundMetrics {
  available: boolean;
  unavailableReason?: EvidenceUnavailableReason;
}

export interface ReviewMetricsResult {
  whitelist: ReviewTurnaroundMetrics;
  evidence: EvidenceTurnaroundMetrics;
  report: string;
}

export interface ReviewTurnaroundServiceOptions {
  listWhitelistRequests?: (from: Date, to: Date) => Promise<WhitelistRequestRow[]>;
  evidenceReader?: EvidenceReaderLike;
  sla?: PilotReviewSlaConfig;
  agreementStartAt?: Date | null;
  cadenceDays?: number;
  cycleIdPrefix?: string;
  contractId?: string;
  now?: () => Date;
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function defaultListWhitelistRequests(from: Date, to: Date): Promise<WhitelistRequestRow[]> {
  return db
    .select({
      id: pilotWhitelistRequests.id,
      createdAt: pilotWhitelistRequests.createdAt,
      reviewedAt: pilotWhitelistRequests.reviewedAt,
    })
    .from(pilotWhitelistRequests)
    .where(
      and(gte(pilotWhitelistRequests.createdAt, from), lte(pilotWhitelistRequests.createdAt, to)),
    );
}

/**
 * Operator-facing review-turnaround metrics for whitelist requests (database)
 * and evidence cycles (on-chain via Soroban RPC).
 *
 * No new table is introduced for evidence timestamps: `recorded_at` on
 * `pilot-payout-split` is the source of truth, read live the same way the
 * escalation job does.
 */
export class ReviewTurnaroundService {
  private readonly listWhitelistRequests: (from: Date, to: Date) => Promise<WhitelistRequestRow[]>;
  private readonly injectedEvidenceReader: EvidenceReaderLike | undefined;
  private readonly slaOverride: PilotReviewSlaConfig | undefined;
  private readonly agreementStartOverride: Date | null | undefined;
  private readonly cadenceDaysOverride: number | undefined;
  private readonly cycleIdPrefix: string;
  private readonly contractIdOverride: string | undefined;
  private readonly now: () => Date;

  constructor(options?: ReviewTurnaroundServiceOptions) {
    this.listWhitelistRequests = options?.listWhitelistRequests ?? defaultListWhitelistRequests;
    this.injectedEvidenceReader = options?.evidenceReader;
    this.slaOverride = options?.sla;
    this.agreementStartOverride = options?.agreementStartAt;
    this.cadenceDaysOverride = options?.cadenceDays;
    this.cycleIdPrefix = options?.cycleIdPrefix ?? 'cycle-';
    this.contractIdOverride = options?.contractId;
    this.now = options?.now ?? (() => new Date());
  }

  private sla(): PilotReviewSlaConfig {
    return this.slaOverride ?? getPilotReviewSlaConfig();
  }

  private agreementStartAt(): Date | null {
    if (this.agreementStartOverride !== undefined) return this.agreementStartOverride;
    return parseIsoDate(process.env.PILOT_ESCALATION_AGREEMENT_START);
  }

  private cadenceDays(): number {
    return (
      this.cadenceDaysOverride ?? parsePositiveNumber(process.env.PILOT_ESCALATION_CADENCE_DAYS, 30)
    );
  }

  private contractId(): string {
    return this.contractIdOverride ?? getPilotPayoutSplitContractId();
  }

  async getMetrics(query: MetricsWindowQuery = {}): Promise<ReviewMetricsResult> {
    let window: ReviewWindow;
    try {
      window = resolveMetricsWindow(query, this.sla().defaultWindowDays, this.now());
    } catch (error) {
      throw new BadRequestError(error instanceof Error ? error.message : 'Invalid metrics window');
    }

    const [whitelist, evidence] = await Promise.all([
      this.getWhitelistMetrics(window),
      this.getEvidenceMetrics(window),
    ]);

    const report = `${whitelist.report}\n${evidence.report}`;
    logger.info('Pilot review turnaround metrics', {
      operation: 'PILOT_REVIEW_TURNAROUND',
      report,
      whitelistBreached: whitelist.breached,
      evidenceBreached: evidence.available && evidence.breached,
    });

    return { whitelist, evidence, report };
  }

  async getWhitelistMetrics(window: ReviewWindow): Promise<ReviewTurnaroundMetrics> {
    const rows = await this.listWhitelistRequests(window.from, window.to);
    const samples: ReviewSample[] = rows.map((row) => ({
      id: row.id,
      startedAt: row.createdAt,
      completedAt: row.reviewedAt,
    }));
    return computeReviewTurnaround(
      'whitelist',
      samples,
      this.sla().whitelistSlaHours,
      window,
      this.now(),
    );
  }

  async getEvidenceMetrics(window: ReviewWindow): Promise<EvidenceTurnaroundMetrics> {
    const sla = this.sla();
    const agreementStartAt = this.agreementStartAt();
    if (!agreementStartAt) {
      const empty = emptyTurnaroundMetrics('evidence', sla.evidenceSlaHours, window);
      return {
        ...empty,
        available: false,
        unavailableReason: 'agreement_start_not_configured',
        report: `${empty.report} (unavailable: agreement start not configured)`,
      };
    }

    const contractId = this.contractId();
    if (!contractId && !this.injectedEvidenceReader) {
      const empty = emptyTurnaroundMetrics('evidence', sla.evidenceSlaHours, window);
      return {
        ...empty,
        available: false,
        unavailableReason: 'contract_not_configured',
        report: `${empty.report} (unavailable: payout-split contract not configured)`,
      };
    }

    const cycles = buildExpectedCycles(
      {
        agreementStartAt,
        cadenceDays: this.cadenceDays(),
        cycleIdPrefix: this.cycleIdPrefix,
      },
      this.now(),
    ).filter(
      (cycle) =>
        cycle.dueAt.getTime() >= window.from.getTime() &&
        cycle.dueAt.getTime() <= window.to.getTime(),
    );

    const reader = this.injectedEvidenceReader ?? new PilotPayoutEvidenceReader({ contractId });

    try {
      const samples: ReviewSample[] = [];
      for (const cycle of cycles) {
        const lookup = await reader.hasEvidence(cycle.cycleId);
        const recordedAt =
          lookup.present && lookup.recordedAt !== undefined
            ? new Date(lookup.recordedAt * 1000)
            : null;
        samples.push({
          id: cycle.cycleId,
          startedAt: cycle.dueAt,
          completedAt: recordedAt,
        });
      }

      const metrics = computeReviewTurnaround(
        'evidence',
        samples,
        sla.evidenceSlaHours,
        window,
        this.now(),
      );
      return { ...metrics, available: true };
    } catch (error) {
      logger.error('Failed to read on-chain evidence timestamps for review metrics', {
        operation: 'PILOT_REVIEW_TURNAROUND_RPC_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
      const empty = emptyTurnaroundMetrics('evidence', sla.evidenceSlaHours, window);
      return {
        ...empty,
        available: false,
        unavailableReason: 'rpc_error',
        report: `${empty.report} (unavailable: on-chain evidence read failed)`,
      };
    }
  }
}

export const reviewTurnaroundService = new ReviewTurnaroundService();
