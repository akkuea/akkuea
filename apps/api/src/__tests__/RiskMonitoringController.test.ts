/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';
import { lendingRepository } from '../repositories/LendingRepository';
import { OracleService } from '../services/OracleService';

const Ctl = RiskMonitoringController as any;
const repo = lendingRepository as any;
const oracle = OracleService as any;

const POOL_ID = '11111111-2222-3333-4444-555555555555';
const BORROWER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const POSITION_ID = `${POOL_ID}-${BORROWER_ID}`;

function health(riskLevel: string, positionId = POSITION_ID) {
  return { positionId, poolId: POOL_ID, borrower: BORROWER_ID, riskLevel };
}

describe('RiskMonitoringController', () => {
  const original = {
    getAllBorrowPositions: repo.getAllBorrowPositions,
    getLatestValuation: oracle.getLatestValuation,
    notifyLiquidationRisk: Ctl.notificationService.notifyLiquidationRisk,
    notifyRiskWarning: Ctl.notificationService.notifyRiskWarning,
    assessPositions: Ctl.service.assessPositions,
  };

  let sent: { kind: string; userId: string }[];
  let healthToReturn: unknown[];
  let pricesSeen: Map<string, number> | undefined;

  beforeEach(() => {
    sent = [];
    healthToReturn = [];
    pricesSeen = undefined;
    Ctl.lastNotifiedLevel?.clear();

    repo.getAllBorrowPositions = async () => [{ collateralAsset: 'ASSET_A' }];
    oracle.getLatestValuation = async () => ({ price: 2.5 });
    Ctl.notificationService.notifyLiquidationRisk = async (userId: string) => {
      sent.push({ kind: 'liquidation', userId });
    };
    Ctl.notificationService.notifyRiskWarning = async (userId: string) => {
      sent.push({ kind: 'warning', userId });
    };
    Ctl.service.assessPositions = async (_p: unknown, prices: Map<string, number>) => {
      pricesSeen = prices;
      return healthToReturn;
    };
  });

  afterEach(() => {
    repo.getAllBorrowPositions = original.getAllBorrowPositions;
    oracle.getLatestValuation = original.getLatestValuation;
    Ctl.notificationService.notifyLiquidationRisk = original.notifyLiquidationRisk;
    Ctl.notificationService.notifyRiskWarning = original.notifyRiskWarning;
    Ctl.service.assessPositions = original.assessPositions;
  });

  it('notifies the borrower id via notifyLiquidationRisk for a critical position', async () => {
    healthToReturn = [health('critical')];
    await RiskMonitoringController.notifyRiskTransitions();
    expect(sent).toEqual([{ kind: 'liquidation', userId: BORROWER_ID }]);
  });

  it('notifies the borrower id via notifyRiskWarning for a warning position', async () => {
    healthToReturn = [health('warning')];
    await RiskMonitoringController.notifyRiskTransitions();
    expect(sent).toEqual([{ kind: 'warning', userId: BORROWER_ID }]);
  });

  it('sends nothing for a healthy position', async () => {
    healthToReturn = [health('healthy')];
    await RiskMonitoringController.notifyRiskTransitions();
    expect(sent).toHaveLength(0);
  });

  it('does not re-notify when the risk level has not changed', async () => {
    healthToReturn = [health('critical')];
    await RiskMonitoringController.notifyRiskTransitions();
    await RiskMonitoringController.notifyRiskTransitions();
    expect(sent).toHaveLength(1);
  });

  it('sends no notifications when GET positions is called twice', async () => {
    healthToReturn = [health('critical')];
    await RiskMonitoringController.getPositionsByRisk();
    await RiskMonitoringController.getPositionsByRisk();
    expect(sent).toHaveLength(0);
  });

  it('returns [] instead of throwing when the database fails', async () => {
    repo.getAllBorrowPositions = async () => {
      throw new Error('db down');
    };
    const result = await RiskMonitoringController.assessAllPositions();
    expect(result).toEqual([]);
  });

  it('falls back to price 1.0 when the oracle fails', async () => {
    oracle.getLatestValuation = async () => {
      throw new Error('no oracle data');
    };
    await RiskMonitoringController.assessAllPositions();
    expect(pricesSeen?.get('ASSET_A')).toBe(1.0);
  });

  it('uses the oracle price when it is available', async () => {
    await RiskMonitoringController.assessAllPositions();
    expect(pricesSeen?.get('ASSET_A')).toBe(2.5);
  });

  it('filters positions by risk level', async () => {
    healthToReturn = [health('critical', 'p1'), health('warning', 'p2'), health('healthy', 'p3')];
    const result = await RiskMonitoringController.getPositionsByRisk('warning');
    expect(result).toHaveLength(1);
    expect(result[0]?.positionId).toBe('p2');
  });

  it('returns 404 from getLiquidationReadiness for an unknown position id', async () => {
    healthToReturn = [];
    let caught: any;
    try {
      await RiskMonitoringController.getLiquidationReadiness('does-not-exist');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode ?? caught.status).toBe(404);
  });
});
