import type {
  PositionHealth,
  RiskLevel,
  RiskStateTransition,
  LiquidationReadiness,
} from '@real-estate-defi/shared';
import type { BorrowPosition } from '../db/schema';
import { RiskMonitoringRepository } from '../repositories/RiskMonitoringRepository';

export class RiskMonitoringService {
  private repository: RiskMonitoringRepository;
  private readonly WARNING_THRESHOLD = 1.25;
  private readonly CRITICAL_THRESHOLD = 1.1;
  private readonly LIQUIDATION_THRESHOLD = 1.0;
  private previousStates = new Map<string, RiskLevel>();

  constructor(repository?: RiskMonitoringRepository) {
    this.repository = repository || new RiskMonitoringRepository();
  }

  async assessPositions(
    positions: BorrowPosition[],
    collateralPrices: Map<string, number>,
  ): Promise<PositionHealth[]> {
    const healthResults: PositionHealth[] = [];

    for (const position of positions) {
      const health = this.calculateHealth(position, collateralPrices);
      healthResults.push(health);

      await this.checkAndRecordTransition(health);
    }

    return healthResults;
  }

  private calculateHealth(
    position: BorrowPosition,
    collateralPrices: Map<string, number>,
  ): PositionHealth {
    const collateralPrice = collateralPrices.get(position.collateralAsset) || 0;
    const collateralValue = parseFloat(position.collateralAmount) * collateralPrice;
    const borrowValue = parseFloat(position.principal) + parseFloat(position.accruedInterest);
    const healthFactor = borrowValue > 0 ? collateralValue / borrowValue : Infinity;

    return {
      positionId: `${position.poolId}-${position.borrowerId}`,
      borrower: position.borrowerId,
      poolId: position.poolId,
      healthFactor,
      riskLevel: this.determineRiskLevel(healthFactor),
      collateralValue,
      borrowValue,
      liquidationThreshold: this.LIQUIDATION_THRESHOLD,
    };
  }

  private determineRiskLevel(healthFactor: number): RiskLevel {
    if (healthFactor <= this.CRITICAL_THRESHOLD) return 'critical';
    if (healthFactor <= this.WARNING_THRESHOLD) return 'warning';
    return 'safe';
  }

  private async checkAndRecordTransition(health: PositionHealth): Promise<void> {
    const previousRisk = this.previousStates.get(health.positionId);

    if (previousRisk && previousRisk !== health.riskLevel) {
      const transition: RiskStateTransition = {
        id: `${health.positionId}-${Date.now()}`,
        positionId: health.positionId,
        fromRiskLevel: previousRisk,
        toRiskLevel: health.riskLevel,
        healthFactor: health.healthFactor,
        timestamp: new Date(),
        reason: `Health factor: ${health.healthFactor.toFixed(4)}`,
      };

      await this.repository.saveTransition(transition);
    }

    this.previousStates.set(health.positionId, health.riskLevel);
  }

  prepareLiquidation(health: PositionHealth): LiquidationReadiness {
    const isLiquidatable = health.healthFactor <= this.LIQUIDATION_THRESHOLD;
    const collateralToSeize = isLiquidatable ? health.collateralValue : 0;
    const debtToCover = isLiquidatable ? health.borrowValue : 0;
    const estimatedProceeds = collateralToSeize * 0.95; // 5% liquidation penalty

    return {
      positionId: health.positionId,
      isLiquidatable,
      collateralToSeize,
      debtToCover,
      estimatedProceeds,
    };
  }

  async getTransitions(positionId?: string): Promise<RiskStateTransition[]> {
    if (positionId) {
      return this.repository.getTransitionsByPosition(positionId);
    }
    return this.repository.getRecentTransitions();
  }
}
