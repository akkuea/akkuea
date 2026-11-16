import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { PilotEscalationJob } from '../workers/pilotEscalationJob';
import type { NotificationService } from '../services/NotificationService';
import type { PilotEscalationRepository } from '../repositories/PilotEscalationRepository';
import type { EvidenceLookupResult } from '../services/PilotPayoutEvidenceReader';
import type { PilotEscalationState } from '../db/schema';

const OPERATOR_USER_ID = 'operator-1';
const CONTRACT_ID = 'CTESTPAYOUTSPLITCONTRACTID0000000000000000000000000000';
const JAN_START = new Date('2026-01-15T00:00:00.000Z');
const MARCH_AFTER_PAYMENT_DAY = new Date('2026-03-10T00:00:00.000Z');

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
    });

    const result = await job.tick();
    expect(result.status).toBe('skipped');
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('reports no breach in March when agreement starts in January and 2026-01 and 2026-02 have evidence', async () => {
    const reader = makeReader({ '2026-01': true, '2026-02': true });
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    expect(result).toEqual({
      status: 'ok',
      breached: false,
      consecutiveMissed: 0,
      notified: false,
    });
    expect(reader.hasEvidence.mock.calls.map((c) => c[0])).toEqual(['2026-01', '2026-02']);
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('does not count a month whose payment day has not passed yet as missed', async () => {
    // On 2026-03-04 (paymentDay = 5), 2026-01 is due (due Feb 5), while 2026-02 (due Mar 5) is NOT yet due.
    const marchBeforePaymentDay = new Date('2026-03-04T23:59:59.000Z');
    const reader = makeReader({});
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => marchBeforePaymentDay,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    expect(result).toEqual({
      status: 'ok',
      breached: false,
      consecutiveMissed: 1,
      notified: false,
    });
    expect(reader.hasEvidence.mock.calls.map((c) => c[0])).toEqual(['2026-01']);
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('does not breach on exactly one missed cycle out of two due (threshold 2)', async () => {
    const reader = makeReader({ '2026-01': true, '2026-02': false });
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(1);
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
  });

  it('enqueues exactly one notification when two consecutive months past payment day have no evidence', async () => {
    const reader = makeReader({});
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(2);
    expect(result.notified).toBe(true);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledWith(
      OPERATOR_USER_ID,
      CONTRACT_ID,
      2,
      ['2026-01', '2026-02'],
    );

    // A second poll with the same unresolved gap must not re-notify.
    const second = await job.tick();
    if (second.status !== 'ok') throw new Error('unreachable');
    expect(second.notified).toBe(false);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
  });

  it('handles year boundaries (2026-12 then 2027-01) when checking consecutive missed months', async () => {
    const reader = makeReader({});
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: new Date('2026-12-01T00:00:00.000Z'),
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => new Date('2027-02-06T00:00:00.000Z'),
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(2);
    expect(reader.hasEvidence.mock.calls.map((c) => c[0])).toEqual(['2026-12', '2027-01']);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledWith(
      OPERATOR_USER_ID,
      CONTRACT_ID,
      2,
      ['2026-12', '2027-01'],
    );
  });

  it('re-notifies once the configured re-notification cadence has elapsed for a persisting gap', async () => {
    let currentNow = new Date('2026-03-10T00:00:00.000Z');
    const reader = makeReader({});
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      renotifyIntervalMs: 1_000,
      now: () => currentNow,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    await job.tick();
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);

    currentNow = new Date(currentNow.getTime() + 2_000);
    await job.tick();
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(2);
  });

  it('clears dedup state and stops notifying once the ally resumes reporting', async () => {
    const missingReader = makeReader({});
    const jobA = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: missingReader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });
    await jobA.tick();
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
    expect(repository._store.size).toBe(1);

    const allPresentReader = {
      hasEvidence: mock(async (): Promise<EvidenceLookupResult> => ({ present: true })),
    };
    const jobB = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: allPresentReader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });
    const result = await jobB.tick();
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.breached).toBe(false);
    expect(repository._store.size).toBe(0);
    expect(notificationService.notifyPilotReportingEscalation).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully and does not crash on a persistent simulated RPC failure', async () => {
    const alwaysFailingReader = makeAlwaysFailingReader();
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      rpcMaxRetries: 2,
      rpcRetryBaseDelayMs: 1,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: alwaysFailingReader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    expect(result.status).toBe('rpc_error');
    expect(notificationService.notifyPilotReportingEscalation).not.toHaveBeenCalled();
    expect(alwaysFailingReader.hasEvidence).toHaveBeenCalledTimes(2);
    expect(job.isRunning()).toBe(false);
  });

  it('recovers on the next lookup after a transient RPC failure resolves within retry budget', async () => {
    const reader = makeFlakyReader(1);
    const job = new PilotEscalationJob({
      contractId: CONTRACT_ID,
      agreementStartAt: JAN_START,
      paymentDay: 5,
      operatorUserId: OPERATOR_USER_ID,
      thresholdCycles: 2,
      rpcMaxRetries: 3,
      rpcRetryBaseDelayMs: 1,
      now: () => MARCH_AFTER_PAYMENT_DAY,
      evidenceReader: reader,
      notificationService: notificationService as unknown as NotificationService,
      escalationRepository: repository as unknown as PilotEscalationRepository,
    });

    const result = await job.tick();
    expect(result.status).toBe('ok');
  });
});
