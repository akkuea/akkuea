import { Elysia, t } from 'elysia';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';

export const riskMonitoringRoutes = new Elysia({ prefix: '/internal/risk' })
  .get('/positions', () => RiskMonitoringController.assessAllPositions(), {
    detail: {
      summary: 'Assess all positions',
      description: 'Assess all lending positions for risk levels',
      tags: ['Risk Monitoring'],
    },
  })
  .get(
    '/positions/risk/:level',
    ({ params: { level } }) => RiskMonitoringController.getPositionsByRisk(level),
    {
      params: t.Object({
        level: t.String(),
      }),
      detail: {
        summary: 'Get positions by risk level',
        description: 'Retrieve positions filtered by risk severity level',
        tags: ['Risk Monitoring'],
      },
    },
  )
  .get(
    '/liquidation/:positionId',
    ({ params: { positionId } }) => RiskMonitoringController.getLiquidationReadiness(positionId),
    {
      params: t.Object({
        positionId: t.String(),
      }),
      detail: {
        summary: 'Get liquidation readiness',
        description: 'Check if a position is ready for liquidation',
        tags: ['Risk Monitoring'],
      },
    },
  )
  .get(
    '/transitions',
    ({ query }) =>
      RiskMonitoringController.getRiskTransitions(query.positionId as string | undefined),
    {
      query: t.Object({
        positionId: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get risk transitions',
        description: 'Retrieve risk transition history, optionally filtered by position ID',
        tags: ['Risk Monitoring'],
      },
    },
  )
  .get(
    '/positions/:positionId/history',
    ({ params: { positionId }, query }) =>
      RiskMonitoringController.getCollateralRatioHistory(
        positionId,
        query.startDate as string | undefined,
        query.endDate as string | undefined,
      ),
    {
      params: t.Object({
        positionId: t.String(),
      }),
      detail: {
        summary: 'Get collateral ratio history',
        description:
          'Retrieve collateral ratio history for a position, optionally filtered by date range',
        tags: ['Risk Monitoring'],
      },
    },
  );
