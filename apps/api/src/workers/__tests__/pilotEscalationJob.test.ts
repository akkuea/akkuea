import { describe, expect, it, mock } from 'bun:test';
import { PilotEscalationJob } from '../pilotEscalationJob';

describe('PilotEscalationJob', () => {
  it('returns skipped when no agreement start', async () => {
    const job = new PilotEscalationJob({
      agreementStartAt: undefined,
    });
    const result = await job.tick();
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no_agreement_start');
  });

  it('returns skipped when no operator user ID', async () => {
    const job = new PilotEscalationJob({
      agreementStartAt: new Date('2026-01-01'),
      operatorUserId: undefined,
    });
    const result = await job.tick();
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no_operator_user');
  });

  it('returns ok with unknownCount when RPC is unavailable', async () => {
    const mockReader = {
      hasEvidence: mock(async () => {
        throw new Error('RPC timeout');
      }),
    };
    const job = new PilotEscalationJob({
      agreementStartAt: new Date('2026-01-01'),
      operatorUserId: 'test-operator',
      evidenceReader: mockReader,
      onUnknown: mock(),
    });
    const result = await job.tick();
    expect(result.status).toBe('ok');
    expect(result.unknownCount).toBeGreaterThanOrEqual(0);
  });

  it('does not escalate when RPC is unavailable (unknown state)', async () => {
    const mockReader = {
      hasEvidence: mock(async () => {
        throw new Error('RPC unavailable');
      }),
    };
    const notified = mock();
    const job = new PilotEscalationJob({
      agreementStartAt: new Date('2026-01-01'),
      operatorUserId: 'test-operator',
      evidenceReader: mockReader,
      notificationService: {
        notifyPilotReportingEscalation: notified,
      } as any,
    });
    const result = await job.tick();
    // Unknown cycles are never escalated
    expect(notified).not.toHaveBeenCalled();
  });

  it('notifies on breach when evidence is missing', async () => {
    const mockReader = {
      hasEvidence: mock(async () => ({ present: false })),
    };
    const notify = mock();
    const job = new PilotEscalationJob({
      agreementStartAt: new Date('2025-01-01'),
      cadenceDays: 1,
      operatorUserId: 'test-operator',
      thresholdCycles: 2,
      evidenceReader: mockReader,
      notificationService: {
        notifyPilotReportingEscalation: notify,
      } as any,
      escalationRepository: {
        findByContractId: mock(async () => null),
        clear: mock(async () => {}),
        recordNotified: mock(async () => {}),
      } as any,
    });
    const result = await job.tick();
    expect(result.status).toBe('ok');
    expect(result.breached).toBe(true);
  });
});
