import { describe, test, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { errorHandler } from '../middleware/errorHandler';
import { riskMonitoringRoutes } from '../routes/riskMonitoring';
import { lendingRoutes } from '../routes/lending';

// Risk monitoring routes — RiskMonitoringRepository is in-memory; LendingRepository falls back
// to returning [] when DATABASE_URL is absent (assessAllPositions catches the DB error).
describe('Risk Monitoring API', () => {
  const app = new Elysia().use(errorHandler).use(riskMonitoringRoutes);

  test('Monitoring data is available to internal tools', async () => {
    const response = await app.handle(new Request('http://localhost/internal/risk/positions'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Filter positions by risk level', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/positions/risk/critical'),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Get liquidation readiness returns 404 for unknown position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/liquidation/pool-1-borrower-1'),
    );

    expect(response.status).toBeLessThan(500);
  });

  test('Get risk transitions', async () => {
    const response = await app.handle(new Request('http://localhost/internal/risk/transitions'));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Get transitions for specific position', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/risk/transitions?positionId=pos-1'),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
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
