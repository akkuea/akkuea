import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';
import { validate } from '../middleware/validation';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

const riskLevelParamsSchema = z.object({
  level: z.enum(['safe', 'warning', 'critical']),
});

const internalRiskAuth = new Elysia({ name: 'internal-risk-auth' }).onBeforeHandle(
  { as: 'scoped' },
  ({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 401;
      return {
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Valid internal operations credential required',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      };
    }
  },
);

export const riskMonitoringRoutes = new Elysia({ prefix: '/internal/risk' })
  .use(internalRiskAuth)
  .get('/positions', () => RiskMonitoringController.assessAllPositions(), {
    detail: {
      summary: 'Assess all positions',
      description: 'Assess all lending positions for risk levels',
      tags: ['Risk Monitoring'],
    },
  })
  .group('', (app) =>
    app
      .use(validate({ params: riskLevelParamsSchema }))
      .get(
        '/positions/risk/:level',
        ({ validatedParams }) =>
          RiskMonitoringController.getPositionsByRisk(validatedParams!.level),
        {
          detail: {
            summary: 'Get positions by risk level',
            description: 'Retrieve positions filtered by risk severity level',
            tags: ['Risk Monitoring'],
          },
        },
      ),
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
  )
  .post(
    '/notify',
    async () => {
      const positions = await RiskMonitoringController.notifyRiskTransitions();
      return { success: true, data: { assessed: positions.length } };
    },
    {
      detail: {
        summary: 'Notify risk transitions',
        description: 'Assess all positions and notify borrowers whose risk level changed',
        tags: ['Risk Monitoring'],
      },
    },
  );
