import type { PositionHealth, LiquidationReadiness } from '@akkuea/shared';
import type { BorrowPosition } from '../db/schema';
import { RiskMonitoringService } from '../services/RiskMonitoringService';
import { lendingRepository } from '../repositories/LendingRepository';
import { NotificationService } from '../services/NotificationService';
import { OracleService } from '../services/OracleService';
import { ApiError } from '../errors/ApiError';

export class RiskMonitoringController {
  private static service = new RiskMonitoringService();
  private static notificationService = new NotificationService();
  // Last risk level we notified about, per position. Used to notify only on transitions.
  private static lastNotifiedLevel = new Map<string, string>();

  /** Read-only: assesses positions. Sends NO notifications. */
  static async assessAllPositions(): Promise<PositionHealth[]> {
    let positions: BorrowPosition[];
    try {
      positions = await this.getAllBorrowPositions();
    } catch {
      // DB unavailable - return empty array so monitoring degrades gracefully
      return [];
    }

    const collateralPrices = await this.getCollateralPrices(positions);
    return await this.service.assessPositions(positions, collateralPrices);
  }

  /** Used by the monitoring job / POST route. Notifies borrowers only on risk-level transitions. */
  static async notifyRiskTransitions(): Promise<PositionHealth[]> {
    const healthResults = await this.assessAllPositions();

    for (const health of healthResults) {
      const previous = this.lastNotifiedLevel.get(health.positionId);
      if (previous === health.riskLevel) continue;

      if (health.riskLevel === 'critical') {
        await this.notificationService.notifyLiquidationRisk(
          health.borrower,
          health.positionId,
          'IN_APP',
        );
      } else if (health.riskLevel === 'warning') {
        await this.notificationService.notifyRiskWarning(
          health.borrower,
          health.positionId,
          'warning',
          'IN_APP',
        );
      }

      this.lastNotifiedLevel.set(health.positionId, health.riskLevel);
    }

    return healthResults;
  }

  static async getPositionsByRisk(riskLevel?: string): Promise<PositionHealth[]> {
    const allHealth = await this.assessAllPositions();
    if (!riskLevel) return allHealth;
    return allHealth.filter((h) => h.riskLevel === riskLevel);
  }

  static async getLiquidationReadiness(positionId: string): Promise<LiquidationReadiness> {
    const allHealth = await this.assessAllPositions();
    const health = allHealth.find((h) => h.positionId === positionId);

    if (!health) {
      throw ApiError.notFound(`Position ${positionId} not found`);
    }

    return this.service.prepareLiquidation(health);
  }

  static async getRiskTransitions(positionId?: string) {
    return this.service.getTransitions(positionId);
  }

  static async getCollateralRatioHistory(
    positionId: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    return this.service.getCollateralRatioHistory(positionId, startDate, endDate);
  }

  private static async getAllBorrowPositions(): Promise<BorrowPosition[]> {
    return await lendingRepository.getAllBorrowPositions();
  }

  private static async getCollateralPrices(
    positions: BorrowPosition[],
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    const assetAddresses = [...new Set(positions.map((p) => p.collateralAsset))];

    for (const assetAddress of assetAddresses) {
      try {
        const valuation = await OracleService.getLatestValuation(assetAddress);
        prices.set(assetAddress, valuation.price);
      } catch {
        prices.set(assetAddress, 1.0); // fallback when no oracle data exists for this asset
      }
    }

    return prices;
  }
}
