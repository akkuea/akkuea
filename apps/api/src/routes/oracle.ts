import { Elysia } from 'elysia';
import type { RealEstateValuationPayload } from '@real-estate-defi/shared';
import { ValuationController } from '../controllers/ValuationController';

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  // POST /oracle/valuations - Ingest a new real estate valuation
  .post('/valuations', ({ body }) =>
    ValuationController.ingestValuation(body as RealEstateValuationPayload),
  )
  // GET /oracle/valuations/:propertyId - Latest valuation for a property
  .get('/valuations/:propertyId', ({ params: { propertyId } }) =>
    ValuationController.getLatestValuation(propertyId),
  )
  // GET /oracle/valuations/:propertyId/history - Valuation history
  .get('/valuations/:propertyId/history', ({ params: { propertyId }, query }) =>
    ValuationController.getValuationHistory(
      propertyId,
      query.limit ? Number(query.limit) : undefined,
    ),
  )
  // GET /oracle/valuations/:propertyId/contract-payload - Contract-ready payload
  .get('/valuations/:propertyId/contract-payload', ({ params: { propertyId } }) =>
    ValuationController.getContractPayload(propertyId),
  )
  // POST /oracle/valuations/:propertyId/manual-review - Flag for manual review
  .post('/valuations/:propertyId/manual-review', ({ params: { propertyId }, body }) => {
    const { id, reason } = body as { id: string; reason: string };
    return ValuationController.flagForManualReview(id, propertyId, reason);
  })
  // POST /oracle/valuations/manual-override - Submit a manual valuation override
  .post('/valuations/manual-override', ({ body }) =>
    ValuationController.submitManualOverride(
      body as RealEstateValuationPayload & { overrideReason: string },
    ),
  );
