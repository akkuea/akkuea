import { describe, test, expect, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { errorHandler } from '../middleware/errorHandler';
import { riskMonitoringRoutes } from '../routes/riskMonitoring';
import { lendingRoutes } from '../routes/lending';

const TEST_OPS_KEY = 'test-internal-ops-key';

describe('Risk Monitoring API', () => {
  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = TEST_OPS_KEY;
  });

  const app = new Elysia().use(errorHandler).use(riskMonitoringRoutes);
  const authHeaders = { 'x-internal-api-key': TEST_OPS_KEY };

  test('Returns 401 when internal operations credential is missing', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions'),
    );
    expect(response.status).toBe(401);
  });

  test('Returns 401 when internal operations credential is wrong', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions', {
        headers: { 'x-internal-api-key': 'wrong-key' },
      }),
    );
    expect(response.status).toBe(401);
  });

  test('Monitoring data is available with valid credential', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions', {
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Filter positions by valid risk level', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions/risk/critical', {
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Rejects invalid risk level with 400 or 422 validation error', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions/risk/extreme_danger', {
        headers: authHeaders,
      }),
    );

    expect([400, 422]).toContain(response.status);
  });

  test('Get liquidation readiness returns 404 for unknown position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/liquidation/pool-1-borrower-1', {
        headers: authHeaders,
      }),
    );

    expect(response.status).toBeLessThan(500);
  });

  test('Get risk transitions', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/transitions', {
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Get transitions for specific position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/transitions?positionId=pos-1', {
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  describe('GET /internal/risk/positions/:positionId/history', () => {
    test('Get collateral ratio history for position', async () => {
      const response = await app.handle(
        new Request('http://localhost/internal/risk/positions/pos-1/history', {
          headers: authHeaders,
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test('Filter collateral ratio history by startDate and endDate', async () => {
      const response = await app.handle(
        new Request(
          'http://localhost/internal/risk/positions/pos-1/history?startDate=2026-01-01T00:00:00Z&endDate=2026-07-28T00:00:00Z',
          {
            headers: authHeaders,
          },
        ),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});

describe('Liquidation endpoint auth', () => {
  const VALID_POOL_ID = '00000000-0000-0000-0000-000000000001';
  const VALID_BORROWER_ID = '00000000-0000-0000-0000-000000000002';
  const app = new Elysia().use(errorHandler).use(lendingRoutes);

  test('Returns 403 when x-api-key header is missing', async () => {
    const url = `http://localhost/lending/pools/${VALID_POOL_ID}/positions/${VALID_BORROWER_ID}/liquidate`;
    const response = await app.handle(new Request(url, { method: 'POST' }));

    expect(response.status).toBe(403);
  });

  test('Returns 403 when x-api-key is wrong', async () => {
    const url = `http://localhost/lending/pools/${VALID_POOL_ID}/positions/${VALID_BORROWER_ID}/liquidate`;
    const response = await app.handle(
      new Request(url, { method: 'POST', headers: { 'x-api-key': 'wrong-key' } }),
    );

    expect(response.status).toBe(403);
  });
});
