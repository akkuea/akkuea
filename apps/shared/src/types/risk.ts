export type RiskLevel = "safe" | "warning" | "critical";

export interface PositionHealth {
  positionId: string;
  borrower: string;
  poolId: string;
  healthFactor: number;
  riskLevel: RiskLevel;
  collateralValue: number;
  borrowValue: number;
  liquidationThreshold: number;
}

export interface RiskStateTransition {
  id: string;
  positionId: string;
  fromRiskLevel: RiskLevel;
  toRiskLevel: RiskLevel;
  healthFactor: number;
  timestamp: Date;
  reason: string;
}

export interface LiquidationReadiness {
  positionId: string;
  isLiquidatable: boolean;
  collateralToSeize: number;
  debtToCover: number;
  estimatedProceeds: number;
}
