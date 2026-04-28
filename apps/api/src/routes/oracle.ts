import { Elysia } from 'elysia';
import { z } from 'zod';
import type { RealEstateValuationPayload } from '@real-estate-defi/shared';
import { ValuationController } from '../controllers/ValuationController';
import { validate } from '../middleware';

const propertyParamSchema = z.object({
  propertyId: z.string().min(1),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().optional(),
});

const manualReviewBodySchema = z.object({
  id: z.string(),
  reason: z.string().min(1),
});

export const oracleRoutes = new Elysia({
  prefix: '/oracle',
  tags: ['Oracle'],
})

  /**
   * POST /oracle/valuations
   */
  .post(
    '/valuations',
    ({ body }) => ValuationController.ingestValuation(body as RealEstateValuationPayload),
    {
      detail: {
        summary: 'Ingest valuation',
        description: 'Submit a new real estate valuation',
      },
    },
  )

  /**
   * GET /oracle/valuations/:propertyId
   */
  .use(validate({ params: propertyParamSchema }))
  .get(
    '/valuations/:propertyId',
    ({ params }) => ValuationController.getLatestValuation(params.propertyId),
    {
      params: propertyParamSchema,
      detail: {
        summary: 'Get latest valuation',
      },
    },
  )

  /**
   * GET /oracle/valuations/:propertyId/history
   */
  .use(validate({ params: propertyParamSchema, query: historyQuerySchema }))
  .get(
    '/valuations/:propertyId/history',
    ({
      params,
      query,
    }: {
      params: z.infer<typeof propertyParamSchema>;
      query: z.infer<typeof historyQuerySchema>;
    }) => ValuationController.getValuationHistory(params.propertyId, query.limit),
    {
      params: propertyParamSchema,
      query: historyQuerySchema,
      detail: {
        summary: 'Get valuation history',
      },
    },
  )

  /**
   * GET /oracle/valuations/:propertyId/contract-payload
   */
  .use(validate({ params: propertyParamSchema }))
  .get(
    '/valuations/:propertyId/contract-payload',
    ({ params }: { params: { propertyId: string } }) =>
      ValuationController.getContractPayload(params.propertyId),
    {
      params: propertyParamSchema,
      detail: {
        summary: 'Get contract payload',
      },
    },
  )

  /**
   * POST /oracle/valuations/:propertyId/manual-review
   */
  .use(validate({ params: propertyParamSchema, body: manualReviewBodySchema }))
  .post(
    '/valuations/:propertyId/manual-review',
    ({
      params,
      body,
    }: {
      params: z.infer<typeof propertyParamSchema>;
      body: z.infer<typeof manualReviewBodySchema>;
    }) => ValuationController.flagForManualReview(body.id, params.propertyId, body.reason),
    {
      params: propertyParamSchema,
      body: manualReviewBodySchema,
      detail: {
        summary: 'Flag valuation for manual review',
      },
    },
  )

  /**
   * POST /oracle/valuations/manual-override
   */
  .post(
    '/valuations/manual-override',
    ({ body }) =>
      ValuationController.submitManualOverride(
        body as RealEstateValuationPayload & { overrideReason: string },
      ),
    {
      detail: {
        summary: 'Submit manual override',
      },
    },
  );
