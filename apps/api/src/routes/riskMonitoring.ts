import { Elysia } from 'elysia';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';

export const riskMonitoringRoutes = new Elysia({ prefix: '/internal/risk' })
  .get('/positions', () => RiskMonitoringController.assessAllPositions())
  .get('/positions/risk/:level', ({ params: { level } }) =>
    RiskMonitoringController.getPositionsByRisk(level),
  )
  .get('/liquidation/:positionId', ({ params: { positionId } }) =>
    RiskMonitoringController.getLiquidationReadiness(positionId),
  )
  .get('/transitions', ({ query }) =>
    RiskMonitoringController.getRiskTransitions(query.positionId as string | undefined),
  );
