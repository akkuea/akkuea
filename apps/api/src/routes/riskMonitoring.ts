import { Elysia } from 'elysia';
import { z } from 'zod';
import { RiskMonitoringController } from '../controllers/RiskMonitoringController';
import { validate } from '../middleware';

/**
 * Schemas
 */
const riskLevelParamSchema = z.object({
  level: z.enum(['low', 'warning', 'critical']).optional(),
});

const liquidationParamSchema = z.object({
  positionId: z.string().min(1),
});

const transitionsQuerySchema = z.object({
  positionId: z.string().optional(),
});

export const riskMonitoringRoutes = new Elysia({
  prefix: '/internal/risk',
  tags: ['Risk Monitoring'],
})

  /**
   * GET /internal/risk/positions
   */
  .get('/positions', () => RiskMonitoringController.assessAllPositions(), {
    detail: {
      summary: 'Assess all borrow positions',
      description: 'Evaluates risk levels for all borrow positions',
    },
  })

  /**
   * GET /internal/risk/positions/risk/:level
   */
  .use(validate({ params: riskLevelParamSchema }))
  .get(
    '/positions/risk/:level',
    ({ params }) => RiskMonitoringController.getPositionsByRisk(params.level),
    {
      params: riskLevelParamSchema,
      detail: {
        summary: 'Get positions by risk level',
        description: 'Filter positions by risk level (low, warning, critical)',
      },
    },
  )

  /**
   * GET /internal/risk/liquidation/:positionId
   */
  .use(validate({ params: liquidationParamSchema }))
  .get(
    '/liquidation/:positionId',
    ({ params }) => RiskMonitoringController.getLiquidationReadiness(params.positionId),
    {
      params: liquidationParamSchema,
      detail: {
        summary: 'Get liquidation readiness',
        description: 'Check liquidation readiness for a given position',
      },
    },
  )

  /**
   * GET /internal/risk/transitions
   */
  .use(validate({ query: transitionsQuerySchema }))
  .get(
    '/transitions',
    ({ query }: { query: { positionId: string } }) =>
      RiskMonitoringController.getRiskTransitions(query.positionId),
    {
      detail: {
        summary: 'Get risk transitions',
        description: 'Retrieve risk transitions for all positions or a specific position',
      },
    },
  );
