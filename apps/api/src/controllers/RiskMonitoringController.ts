import type { PositionHealth, LiquidationReadiness } from '@real-estate-defi/shared';
import type { BorrowPosition } from '../db/schema';
import { RiskMonitoringService } from '../services/RiskMonitoringService';
import { lendingRepository } from '../repositories/LendingRepository';
import { NotificationService } from '../services/NotificationService';
import { OracleService } from '../services/OracleService';
import { ApiError } from '../errors/ApiError';

export class RiskMonitoringController {
  private static service = new RiskMonitoringService();
  private static notificationService = new NotificationService();

  static async assessAllPositions(): Promise<PositionHealth[]> {
    let positions: BorrowPosition[];
    try {
      positions = await this.getAllBorrowPositions();
    } catch {
      // DB unavailable — return empty array so monitoring degrades gracefully
      return [];
    }

    const collateralPrices = await this.getCollateralPrices(positions);
    const healthResults = await this.service.assessPositions(positions, collateralPrices);

    for (const health of healthResults) {
      const userId = this.extractUserIdFromPositionId(health.positionId);
      if (userId) {
        if (health.riskLevel === 'critical') {
          await this.notificationService.notifyLiquidationRisk(userId, health.positionId, 'IN_APP');
        } else if (health.riskLevel === 'warning') {
          await this.notificationService.notifyRiskWarning(
            userId,
            health.positionId,
            'warning',
            'IN_APP',
          );
        }
      }
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
        const valuation = OracleService.getLatestValuation(assetAddress);
        prices.set(assetAddress, valuation.price);
      } catch {
        prices.set(assetAddress, 1.0); // fallback when no oracle data exists for this asset
      }
    }

    return prices;
  }

  private static extractUserIdFromPositionId(positionId: string): string | null {
    const parts = positionId.split('-');
    return parts.length > 1 ? (parts[1] ?? null) : null;
  }
}
