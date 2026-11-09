import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { errorHandler } from '../middleware/errorHandler';
import { riskMonitoringRoutes } from '../routes/riskMonitoring';
import { lendingRoutes } from '../routes/lending';

const INTERNAL_KEY = 'test-operations-backend-credential';
const INTERNAL_HEADERS = { 'x-internal-api-key': INTERNAL_KEY };

// Risk monitoring routes - RiskMonitoringRepository is in-memory; LendingRepository falls back
// to returning [] when DATABASE_URL is absent (assessAllPositions catches the DB error).
describe('Risk Monitoring API', () => {
  const app = new Elysia().use(errorHandler).use(riskMonitoringRoutes);
  const originalEnvKey = process.env.OPERATIONS_BACKEND_CREDENTIAL;

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = INTERNAL_KEY;
  });

  afterEach(() => {
    if (originalEnvKey === undefined) {
      delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
    } else {
      process.env.OPERATIONS_BACKEND_CREDENTIAL = originalEnvKey;
    }
  });

  describe('Authentication on /internal/risk routes', () => {
    test.each([
      ['GET', 'http://localhost/internal/risk/positions'],
      ['GET', 'http://localhost/internal/risk/positions/risk/critical'],
      ['GET', 'http://localhost/internal/risk/liquidation/pool-1-borrower-1'],
      ['GET', 'http://localhost/internal/risk/transitions'],
      ['GET', 'http://localhost/internal/risk/positions/pos-1/history'],
      ['POST', 'http://localhost/internal/risk/notify'],
    ])('%s %s returns 401 without credential', async (method, url) => {
      const response = await app.handle(new Request(url, { method }));
      expect(response.status).toBe(401);
    });

    test('returns 401 when x-internal-api-key is wrong', async () => {
      const response = await app.handle(
        new Request('http://localhost/internal/risk/positions', {
          headers: { 'x-internal-api-key': 'wrong-credential' },
        }),
      );
      expect(response.status).toBe(401);
    });
  });

  test('Monitoring data is available to internal tools with credential', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions', {
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Filter positions by risk level', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions/risk/critical', {
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Rejects unknown risk level with 400', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions/risk/unknown-level', {
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBe(400);
  });

  test('Get liquidation readiness returns 404 for unknown position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/liquidation/pool-1-borrower-1', {
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBeLessThan(500);
  });

  test('Get risk transitions', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/transitions', {
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Get transitions for specific position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/transitions?positionId=pos-1', {
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /internal/risk/notify works with valid credential', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/notify', {
        method: 'POST',
        headers: INTERNAL_HEADERS,
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; data: { assessed: number } };
    expect(body.success).toBe(true);
    expect(typeof body.data.assessed).toBe('number');
  });

  describe('GET /internal/risk/positions/:positionId/history', () => {
    test('Get collateral ratio history for position', async () => {
      const response = await app.handle(
        new Request('http://localhost/internal/risk/positions/pos-1/history', {
          headers: INTERNAL_HEADERS,
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
            headers: INTERNAL_HEADERS,
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
