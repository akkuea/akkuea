import { describe, test, expect, beforeEach } from 'bun:test';
import { RiskMonitoringService } from '../services/RiskMonitoringService';
import type { BorrowPosition } from '../db/schema';

describe('RiskMonitoringService', () => {
  let service: RiskMonitoringService;

  beforeEach(() => {
    service = new RiskMonitoringService();
  });

  test('Healthy positions are assessed as safe', async () => {
    const positions: BorrowPosition[] = [
      {
        id: 'pos-1',
        poolId: 'pool-1',
        borrowerId: 'borrower-1',
        principal: '50000',
        accruedInterest: '2500',
        collateralAmount: '100',
        collateralAsset: 'GDEF456',
        healthFactor: '1.9',
        borrowedAt: new Date(),
        lastAccrualAt: new Date(),
      },
    ];

    const collateralPrices = new Map([['GDEF456', 1000]]);
    const results = await service.assessPositions(positions, collateralPrices);

    expect(results).toHaveLength(1);
    expect(results[0]?.riskLevel).toBe('safe');
    expect(results[0]?.healthFactor).toBeGreaterThan(1.25);
  });

  test('Warning threshold breached', async () => {
    const positions: BorrowPosition[] = [
      {
        id: 'pos-2',
        poolId: 'pool-1',
        borrowerId: 'borrower-1',
        principal: '80000',
        accruedInterest: '4000',
        collateralAmount: '100',
        collateralAsset: 'GDEF456',
        healthFactor: '1.19',
        borrowedAt: new Date(),
        lastAccrualAt: new Date(),
      },
    ];

    const collateralPrices = new Map([['GDEF456', 1000]]);
    const results = await service.assessPositions(positions, collateralPrices);

    expect(results[0]?.riskLevel).toBe('warning');
    expect(results[0]?.healthFactor).toBeLessThanOrEqual(1.25);
    expect(results[0]?.healthFactor).toBeGreaterThan(1.1);
  });

  test('Critical threshold breached', async () => {
    const positions: BorrowPosition[] = [
      {
        id: 'pos-3',
        poolId: 'pool-1',
        borrowerId: 'borrower-1',
        principal: '90000',
        accruedInterest: '5000',
        collateralAmount: '100',
        collateralAsset: 'GDEF456',
        healthFactor: '1.05',
        borrowedAt: new Date(),
        lastAccrualAt: new Date(),
      },
    ];

    const collateralPrices = new Map([['GDEF456', 1000]]);
    const results = await service.assessPositions(positions, collateralPrices);

    expect(results[0]?.riskLevel).toBe('critical');
    expect(results[0]?.healthFactor).toBeLessThanOrEqual(1.1);
  });

  test('No positions exist - empty result returned safely', async () => {
    const positions: BorrowPosition[] = [];
    const collateralPrices = new Map();
    const results = await service.assessPositions(positions, collateralPrices);

    expect(results).toHaveLength(0);
  });

  test('Liquidation readiness for critical position', () => {
    const health = {
      positionId: 'pos-1',
      borrower: 'borrower-1',
      poolId: 'pool-1',
      healthFactor: 0.95,
      riskLevel: 'critical' as const,
      collateralValue: 100000,
      borrowValue: 105000,
      liquidationThreshold: 1.0,
    };

    const readiness = service.prepareLiquidation(health);

    expect(readiness.isLiquidatable).toBe(true);
    expect(readiness.collateralToSeize).toBe(100000);
    expect(readiness.debtToCover).toBe(105000);
    expect(readiness.estimatedProceeds).toBe(95000);
  });

  test('Liquidation readiness for safe position', () => {
    const health = {
      positionId: 'pos-1',
      borrower: 'borrower-1',
      poolId: 'pool-1',
      healthFactor: 2.0,
      riskLevel: 'safe' as const,
      collateralValue: 100000,
      borrowValue: 50000,
      liquidationThreshold: 1.0,
    };

    const readiness = service.prepareLiquidation(health);

    expect(readiness.isLiquidatable).toBe(false);
    expect(readiness.collateralToSeize).toBe(0);
    expect(readiness.debtToCover).toBe(0);
  });
});
