import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import Elysia from 'elysia';
import { db } from '../db';
import { whitelistRoutes } from './whitelist';

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

const testApp = new Elysia().use(whitelistRoutes);

interface MetricsResponse {
  success: boolean;
  error?: string;
  data?: {
    whitelist: {
      count: number;
      meanMs: number | null;
      medianMs: number | null;
      p95Ms: number | null;
      breachCount: number;
    };
    evidence: unknown;
    report: string;
  };
}

describe('GET /pilot/whitelist/metrics', () => {
  const previousAgreementStart = process.env.PILOT_ESCALATION_AGREEMENT_START;

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';
    delete process.env.PILOT_ESCALATION_AGREEMENT_START;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).select = () => ({
      from: () => ({
        where: async () => [],
      }),
    });
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (db as any).select;
    if (previousAgreementStart === undefined) {
      delete process.env.PILOT_ESCALATION_AGREEMENT_START;
    } else {
      process.env.PILOT_ESCALATION_AGREEMENT_START = previousAgreementStart;
    }
  });

  it('returns 403 without the operator credential', async () => {
    const response = await testApp.handle(new Request('http://localhost/pilot/whitelist/metrics'));
    expect(response.status).toBe(403);
    const body = (await response.json()) as MetricsResponse;
    expect(body.success).toBe(false);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('returns 403 with a wrong operator credential', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/metrics', {
        headers: { 'x-internal-api-key': 'wrong' },
      }),
    );
    expect(response.status).toBe(403);
  });

  it('returns 200 with turnaround stats when authorized', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/metrics', {
        headers: { 'x-internal-api-key': 'test-secret' },
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as MetricsResponse;
    expect(body.success).toBe(true);
    expect(typeof body.data?.whitelist.count).toBe('number');
    expect(body.data?.whitelist).toHaveProperty('meanMs');
    expect(body.data?.whitelist).toHaveProperty('medianMs');
    expect(body.data?.whitelist).toHaveProperty('p95Ms');
    expect(body.data?.whitelist).toHaveProperty('breachCount');
    expect(body.data?.evidence).toBeDefined();
    expect(typeof body.data?.report).toBe('string');
  });
});
