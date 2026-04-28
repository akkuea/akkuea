import { Elysia } from 'elysia';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';

export const riskMonitoringRoutes = new Elysia({ prefix: '/internal/risk' })
  .get('/positions', () => RiskMonitoringController.assessAllPositions())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/positions/risk/:level', ({ params: { level } }: any) =>
    RiskMonitoringController.getPositionsByRisk(level),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/liquidation/:positionId', ({ params: { positionId } }: any) =>
    RiskMonitoringController.getLiquidationReadiness(positionId),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/transitions', ({ query }: any) =>
    RiskMonitoringController.getRiskTransitions(query.positionId as string | undefined),
  );
