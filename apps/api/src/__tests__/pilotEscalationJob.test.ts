import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { PilotEscalationJob } from '../workers/pilotEscalationJob';
import type { NotificationService } from '../services/NotificationService';
import type { PilotEscalationRepository } from '../repositories/PilotEscalationRepository';
import type { EvidenceLookupResult } from '../services/PilotPayoutEvidenceReader';
import type { PilotEscalationState } from '../db/schema';

const OPERATOR_USER_ID = 'operator-1';
const CONTRACT_ID = 'CTESTPAYOUTSPLITCONTRACTID0000000000000000000000000000';
const ONE_CYCLE_START = new Date('2026-02-01T00:00:00.000Z');
const TWO_CYCLE_START = new Date('2026-01-01T00:00:00.000Z');
const NOW = new Date('2026-03-05T00:00:00.000Z');

function makeReader(evidenceByCycle: Record<string, boolean>) {
  return {
    hasEvidence: mock(async (cycleId: string): Promise<EvidenceLookupResult> => ({
      present: evidenceByCycle[cycleId] ?? false,
    })),
  };
}

function makeAlwaysFailingReader() {
  return {
    hasEvidence: mock(async (): Promise<EvidenceLookupResult> => {
      throw new Error('simulated transient RPC failure');
    }),
  };
}

function makeFlakyReader(failFirstNCalls: number) {
  let calls = 0;
  return {
    hasEvidence: mock(async (): Promise<EvidenceLookupResult> => {
      calls += 1;
      if (calls <= failFirstNCalls) {
        throw new Error('simulated transient RPC failure');
      }
      return { present: false };
    }),
  };
}

function makeNotificationService() {
  return {
    notifyPilotReportingEscalation: mock(async () => ({}) as never),
  };
}

function makeInMemoryRepository() {
  const store = new Map<string, PilotEscalationState>();
  return {
    findByContractId: mock(async (contractId: string) => store.get(contractId)),
    recordNotified: mock(
      async (input: {
        contractId: string;
        lastMissedCycleId: string;
        consecutiveMissed: number;
        now?: Date;
      }) => {
        const now = input.now ?? new Date();
        const existing = store.get(input.contractId);
        const isSameBreach = existing?.lastMissedCycleId === input.lastMissedCycleId;
        const record: PilotEscalationState = {
          id: existing?.id ?? 'state-1',
          contractId: input.contractId,
          lastMissedCycleId: input.lastMissedCycleId,
          consecutiveMissed: input.consecutiveMissed,
          firstNotifiedAt: isSameBreach && existing ? existing.firstNotifiedAt : now,
          lastNotifiedAt: now,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        store.set(input.contractId, record);
        return record;
      },
    ),
    clear: mock(async (contractId: string) => {
      store.delete(contractId);
    }),
    _store: store,
  };
}

describe('PilotEscalationJob', () => {
  let notificationService: ReturnType<typeof makeNotificationService>;
  let repository: ReturnType<typeof makeInMemoryRepository>;

  beforeEach(() => {
    notificationService = makeNotificationService();
    repository = makeInMemoryRepository();
  });

  it('skips the tick without crashing when required config is missing', async () => {
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      evidenceReader: makeReader({}),
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
      // agreementStartAt and operatorUserId intentionally omitted
    });

    const result = await job.tick();
    expect(result.status).toBe('skipped');
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('does not breach when fewer than the threshold of cycles are missed', async () => {
    // Exactly 1 cycle due; it has evidence recorded.
    const reader = makeReader({ '2026-02': true });
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: ONE_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick(NOW);
    expect(result).toEqual({
      status: 'ok',
      breached: false,
      consecutiveMissed: 0,
      notified: false,
    });
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('matches evidence recorded for calendar months', async () => {
    const reader = makeReader({ '2026-01': true, '2026-02': true });
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: TWO_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick(NOW);
    expect(result).toEqual({
      status: 'ok',
      breached: false,
      consecutiveMissed: 0,
      notified: false,
    });
    expect(reader.hasEvidence).toHaveBeenNthCalledWith(1, '2026-01');
    expect(reader.hasEvidence).toHaveBeenNthCalledWith(2, '2026-02');
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('does not breach on exactly one missed cycle out of two due (threshold 2)', async () => {
    const reader = makeReader({ '2026-01': true, '2026-02': false });
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: TWO_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick(NOW);
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(1);
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('enqueues exactly one notification when the two-cycle threshold is first crossed', async () => {
    const reader = makeReader({});
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: TWO_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick(NOW);
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(2);
    expect(result.notified).toBe(true);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);

    // A second poll with the same unresolved gap must not re-notify.
    const second = await job.tick(NOW);
    if (second.status !== 'ok') throw new Error('unreachable');
    expect(second.notified).toBe(false);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
  });

  it('re-notifies once the configured re-notification cadence has elapsed for a persisting gap', async () => {
    const reader = makeReader({});
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: TWO_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      renotifyIntervalMs: 1, // effectively "always due" for this test
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    await job.tick(NOW);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await job.tick(NOW);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(2);
  });

  it('clears dedup state and stops notifying once the ally resumes reporting', async () => {
    const agreementStartAt = TWO_CYCLE_START;

    const missingReader = makeReader({});
    const jobA = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      evidenceReader: missingReader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });
    await jobA.tick(NOW);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
    expect(repository._store.size).toBe(1);

    // The ally caught up: evidence now exists for every expected cycle.
    const allPresentReader = {
      hasEvidence: mock(async (): Promise<EvidenceLookupResult> => ({ present: true })),
    };
    const jobB = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      evidenceReader: allPresentReader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });
    const result = await jobB.tick(NOW);
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(false);
    expect(repository._store.size).toBe(0);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully and does not crash on a persistent simulated RPC failure', async () => {
    const alwaysFailingReader = makeAlwaysFailingReader();
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: TWO_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      rpcMaxRetries: 2,
      rpcRetryBaseDelayMs: 1,
      evidenceReader: alwaysFailingReader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick(NOW);
    expect(result.status).toBe('rpc_error');
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
    // Retried up to rpcMaxRetries before giving up on the first cycle lookup.
    expect(alwaysFailingReader.hasEvidence).toHaveBeenCalledTimes(2);
    expect(job.isRunning()).toBe(false);
  });

  it('recovers on the next lookup after a transient RPC failure resolves within retry budget', async () => {
    const reader = makeFlakyReader(1); // first call fails, subsequent calls succeed
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: TWO_CYCLE_START,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      rpcMaxRetries: 3,
      rpcRetryBaseDelayMs: 1,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick(NOW);
    expect(result.status).toBe('ok');
  });
});
