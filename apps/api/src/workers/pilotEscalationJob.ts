import { getPilotPayoutSplitContractId } from '../config/contracts';
import {
  PilotPayoutEvidenceReader,
  type EvidenceLookupResult,
} from '../services/PilotPayoutEvidenceReader';
import { NotificationService } from '../services/NotificationService';
import {
  pilotEscalationRepository,
  PilotEscalationRepository,
} from '../repositories/PilotEscalationRepository';
import { logger } from '../services/logger';
import { buildExpectedCycles } from './pilotEscalation/expectedCycles';
import { detectMissedCycles, type CycleEvidenceStatus } from './pilotEscalation/detectMissedCycles';

export interface EvidenceReaderLike {
  hasEvidence(cycleId: string): Promise<EvidenceLookupResult>;
}

export interface PilotEscalationJobConfig {
  /** How often the job runs, in milliseconds. Default: 6 hours. */
  pollIntervalMs?: number;
  /** Expected evidence-reporting cadence, in days. Default: 30. */
  cadenceDays?: number;
  /** Consecutive missed cycles that constitutes a breach. Default: 2. */
  thresholdCycles?: number;
  /** When the ally's reporting agreement began. Required to run. */
  agreementStartAt?: Date;
  /**
   * How often to re-send the escalation notification while the same gap
   * persists (it is never re-sent on every poll). Default: 7 days.
   */
  renotifyIntervalMs?: number;
  /** User ID of the operator to notify. Required to run. */
  operatorUserId?: string;
  /** `pilot-payout-split` contract ID. Defaults to the resolved deployment artifact. */
  contractId?: string;
  /** Number of RPC retry attempts per cycle lookup before giving up for this tick. */
  rpcMaxRetries?: number;
  /** Base delay for RPC retry backoff, in milliseconds. */
  rpcRetryBaseDelayMs?: number;
  /** Injected evidence reader (useful for testing). */
  evidenceReader?: EvidenceReaderLike;
  /** Injected NotificationService (useful for testing). */
  notificationService?: NotificationService;
  /** Injected dedup repository (useful for testing). */
  escalationRepository?: PilotEscalationRepository;
}

interface ResolvedConfig {
  pollIntervalMs: number;
  cadenceDays: number;
  thresholdCycles: number;
  agreementStartAt: Date | null;
  renotifyIntervalMs: number;
  operatorUserId: string | null;
  contractId: string;
  rpcMaxRetries: number;
  rpcRetryBaseDelayMs: number;
  evidenceReader: EvidenceReaderLike | null;
  notificationService: NotificationService;
  escalationRepository: PilotEscalationRepository;
}

const DEFAULT_POLL_INTERVAL_MS = 6 * 60 * 60 * 1_000; // 6 hours
const DEFAULT_CADENCE_DAYS = 30;
const DEFAULT_THRESHOLD_CYCLES = 2;
const DEFAULT_RENOTIFY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days
const DEFAULT_RPC_MAX_RETRIES = 3;
const DEFAULT_RPC_RETRY_BASE_DELAY_MS = 2_000;

export type PilotEscalationTickResult =
  | { status: 'skipped'; reason: string }
  | { status: 'rpc_error'; error: string }
  | { status: 'ok'; breached: boolean; consecutiveMissed: number; notified: boolean };

/**
 * PilotEscalationJob
 *
 * Periodically reads `pilot-payout-split`'s on-chain evidence history for
 * the pilot ally and proactively notifies an operator when two or more
 * consecutive expected reporting cycles have gone by without a recorded
 * `record_evidence` call, instead of leaving this as a passive dashboard
 * signal (see docs/strategy/product-brief.md).
 *
 * Structured after `kycExpiryJob.ts`: self-scheduling poll loop, no crash
 * on transient failure, disable via env.
 *
 * Dedup strategy: a small local table (`pilot_escalation_state`) tracks the
 * last breach an escalation was sent for. This is genuinely new operational
 * metadata (not a cache of on-chain data, which stays the source of truth
 * for the evidence itself), and it lets the job cheaply distinguish "same
 * gap, already notified" from "gap grew / new gap" without re-deriving
 * notification history from `NotificationService` on every tick.
 *
 * Disable via env: PILOT_ESCALATION_JOB_ENABLED=false
 */
export class PilotEscalationJob {
  private readonly config: ResolvedConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private processing = false;

  constructor(config?: PilotEscalationJobConfig) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      cadenceDays: config?.cadenceDays ?? DEFAULT_CADENCE_DAYS,
      thresholdCycles: config?.thresholdCycles ?? DEFAULT_THRESHOLD_CYCLES,
      agreementStartAt: config?.agreementStartAt ?? null,
      renotifyIntervalMs: config?.renotifyIntervalMs ?? DEFAULT_RENOTIFY_INTERVAL_MS,
      operatorUserId: config?.operatorUserId ?? null,
      contractId: config?.contractId ?? getPilotPayoutSplitContractId(),
      rpcMaxRetries: config?.rpcMaxRetries ?? DEFAULT_RPC_MAX_RETRIES,
      rpcRetryBaseDelayMs: config?.rpcRetryBaseDelayMs ?? DEFAULT_RPC_RETRY_BASE_DELAY_MS,
      evidenceReader: config?.evidenceReader ?? null,
      notificationService: config?.notificationService ?? new NotificationService(),
      escalationRepository: config?.escalationRepository ?? pilotEscalationRepository,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Pilot escalation job started', {
      operation: 'PILOT_ESCALATION_JOB_START',
      pollIntervalMs: this.config.pollIntervalMs,
      cadenceDays: this.config.cadenceDays,
      thresholdCycles: this.config.thresholdCycles,
    });
    void this.tick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    logger.info('Pilot escalation job stopped', { operation: 'PILOT_ESCALATION_JOB_STOP' });
  }

  isRunning(): boolean {
    return this.running;
  }

  private getEvidenceReader(): EvidenceReaderLike {
    if (this.config.evidenceReader) return this.config.evidenceReader;
    return new PilotPayoutEvidenceReader({ contractId: this.config.contractId });
  }

  /**
   * Execute one cycle of the job. Public so tests can call it directly with
   * mocked evidence reader/services to simulate arbitrary cycle histories.
   */
  async tick(): Promise<PilotEscalationTickResult> {
    if (this.processing) return { status: 'skipped', reason: 'already_processing' };
    this.processing = true;

    try {
      if (!this.config.agreementStartAt) {
        logger.warn('Pilot escalation job skipped: no agreement start date configured', {
          operation: 'PILOT_ESCALATION_SKIPPED',
        });
        return { status: 'skipped', reason: 'no_agreement_start' };
      }
      if (!this.config.operatorUserId) {
        logger.warn('Pilot escalation job skipped: no operator user ID configured', {
          operation: 'PILOT_ESCALATION_SKIPPED',
        });
        return { status: 'skipped', reason: 'no_operator_user' };
      }
      if (!this.config.contractId) {
        logger.warn('Pilot escalation job skipped: no pilot-payout-split contract ID resolved', {
          operation: 'PILOT_ESCALATION_SKIPPED',
        });
        return { status: 'skipped', reason: 'no_contract_id' };
      }

      const expectedCycles = buildExpectedCycles({
        agreementStartAt: this.config.agreementStartAt,
        cadenceDays: this.config.cadenceDays,
      });

      if (expectedCycles.length === 0) {
        return { status: 'ok', breached: false, consecutiveMissed: 0, notified: false };
      }

      const reader = this.getEvidenceReader();
      const cycleStatuses: CycleEvidenceStatus[] = [];

      for (const cycle of expectedCycles) {
        const result = await this.readWithRetry(reader, cycle.cycleId);
        cycleStatuses.push({ cycleId: cycle.cycleId, hasEvidence: result.present });
      }

      const gap = detectMissedCycles(cycleStatuses, this.config.thresholdCycles);

      if (!gap.breached) {
        // Clear any stale dedup state so a future gap is treated as new.
        await this.config.escalationRepository.clear(this.config.contractId);
        return {
          status: 'ok',
          breached: false,
          consecutiveMissed: gap.consecutiveMissed,
          notified: false,
        };
      }

      const notified = await this.maybeNotify(gap);
      return { status: 'ok', breached: true, consecutiveMissed: gap.consecutiveMissed, notified };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Pilot escalation job tick failed', {
        operation: 'PILOT_ESCALATION_JOB_TICK_ERROR',
        error: message,
      });
      return { status: 'rpc_error', error: message };
    } finally {
      this.processing = false;
      this.scheduleNext();
    }
  }

  /**
   * Reads evidence presence for a single cycle, retrying transient RPC
   * failures with exponential backoff (matching `notificationWorker.ts`'s
   * retry/backoff convention). Rethrows once retries are exhausted so the
   * tick aborts rather than risking a false "missed" read.
   */
  private async readWithRetry(
    reader: EvidenceReaderLike,
    cycleId: string,
  ): Promise<EvidenceLookupResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.rpcMaxRetries; attempt++) {
      try {
        return await reader.hasEvidence(cycleId);
      } catch (err) {
        lastError = err;
        logger.warn('Pilot escalation evidence RPC read failed, will retry', {
          operation: 'PILOT_ESCALATION_RPC_RETRY',
          cycleId,
          attempt,
          maxRetries: this.config.rpcMaxRetries,
          error: err instanceof Error ? err.message : String(err),
        });
        if (attempt < this.config.rpcMaxRetries) {
          const delay = this.config.rpcRetryBaseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to read evidence for cycle "${cycleId}" after retries`);
  }

  private async maybeNotify(gap: {
    breached: boolean;
    consecutiveMissed: number;
    missedCycleIds: string[];
    lastMissedCycleId: string | null;
  }): Promise<boolean> {
    const contractId = this.config.contractId;
    const existing = await this.config.escalationRepository.findByContractId(contractId);
    const now = new Date();

    const isSameBreach = existing?.lastMissedCycleId === gap.lastMissedCycleId;
    const dueForRenotify =
      !existing ||
      !isSameBreach ||
      now.getTime() - existing.lastNotifiedAt.getTime() >= this.config.renotifyIntervalMs;

    if (!dueForRenotify) {
      return false;
    }

    await this.config.notificationService.notifyPilotReportingEscalation(
      this.config.operatorUserId as string,
      contractId,
      gap.consecutiveMissed,
      gap.missedCycleIds,
    );

    await this.config.escalationRepository.recordNotified({
      contractId,
      lastMissedCycleId: gap.lastMissedCycleId as string,
      consecutiveMissed: gap.consecutiveMissed,
      now,
    });

    logger.info('Pilot escalation notification enqueued', {
      operation: 'PILOT_ESCALATION_NOTIFIED',
      contractId,
      consecutiveMissed: gap.consecutiveMissed,
      missedCycleIds: gap.missedCycleIds,
      reNotification: Boolean(existing) && isSameBreach,
    });

    return true;
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.config.pollIntervalMs);
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }
}

function parsePositiveNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Factory that respects the PILOT_ESCALATION_JOB_ENABLED env flag (default:
 * enabled). Cadence, threshold, agreement start, operator, and dedup
 * re-notification cadence are all configurable via environment variables
 * since they are properties of a specific ally's agreement that does not
 * exist yet:
 *
 *  - PILOT_ESCALATION_CADENCE_DAYS (default 30)
 *  - PILOT_ESCALATION_THRESHOLD_CYCLES (default 2)
 *  - PILOT_ESCALATION_AGREEMENT_START (ISO date, required to run)
 *  - PILOT_ESCALATION_OPERATOR_USER_ID (required to run)
 *  - PILOT_ESCALATION_POLL_INTERVAL_MS (default 6 hours)
 *  - PILOT_ESCALATION_RENOTIFY_INTERVAL_MS (default 7 days)
 *  - PILOT_PAYOUT_SPLIT_CONTRACT_ID (env override → shared deployment artifact)
 */
export function createPilotEscalationJobFromEnv(): PilotEscalationJob | null {
  const enabled = (process.env.PILOT_ESCALATION_JOB_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('Pilot escalation job disabled via PILOT_ESCALATION_JOB_ENABLED=false', {
      operation: 'PILOT_ESCALATION_JOB_DISABLED',
    });
    return null;
  }

  return new PilotEscalationJob({
    pollIntervalMs: parsePositiveNumber(process.env.PILOT_ESCALATION_POLL_INTERVAL_MS),
    cadenceDays: parsePositiveNumber(process.env.PILOT_ESCALATION_CADENCE_DAYS),
    thresholdCycles: parsePositiveNumber(process.env.PILOT_ESCALATION_THRESHOLD_CYCLES),
    agreementStartAt: parseIsoDate(process.env.PILOT_ESCALATION_AGREEMENT_START),
    renotifyIntervalMs: parsePositiveNumber(process.env.PILOT_ESCALATION_RENOTIFY_INTERVAL_MS),
    operatorUserId: process.env.PILOT_ESCALATION_OPERATOR_USER_ID?.trim() || undefined,
  });
}
