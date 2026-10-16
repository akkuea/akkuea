import { Elysia, t } from 'elysia';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';
import { isInternalOperationsAuthorized } from '../middleware/internalAuth';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export const riskMonitoringRoutes = new Elysia({ prefix: '/internal/risk' })
  .on('beforeHandle', ({ request, set }) => {
    if (!isInternalOperationsAuthorized(request)) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
  })
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
        level: t.Union(RISK_LEVELS.map((l) => t.Literal(l))),
      }),
      detail: {}
    },
  )
  .get(
    '/liquidation/:positionId',
    ({ params: { positionId } }) => RiskMonitoringController.getLiquidationReadiness(positionId),
    {
      params: t.Object({
        positionId: t.String(),
      }),
      detail: {}
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
      detail: {}
    },
  )
  .get(
    '/positions/:positionId/history',
    ({ params: { positionId }, query }) =>
      RiskMonitoringController.getCollateralRatioHhistory(
        positionId,
        query.startDate as string | undefined,
        query.endDate as string | undefined,
      ),
    {
      params: t.Object({
        positionId: t.String(),
      }),
      detail: {}
    },
  );
