import { Elysia } from 'elysia';
import type { RealEstateValuationPayload } from '@real-estate-defi/shared';
import { ValuationController } from '../controllers/ValuationController';

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  // POST /oracle/valuations — Ingest a new real estate valuation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/valuations', ({ body }: any) =>
    ValuationController.ingestValuation(body as RealEstateValuationPayload),
  )
  // GET /oracle/valuations/:propertyId — Latest valuation for a property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/valuations/:propertyId', ({ params: { propertyId } }: any) =>
    ValuationController.getLatestValuation(propertyId),
  )
  // GET /oracle/valuations/:propertyId/history — Valuation history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/valuations/:propertyId/history', ({ params: { propertyId }, query }: any) =>
    ValuationController.getValuationHistory(
      propertyId,
      query.limit ? Number(query.limit) : undefined,
    ),
  )
  // GET /oracle/valuations/:propertyId/contract-payload — Contract-ready payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/valuations/:propertyId/contract-payload', ({ params: { propertyId } }: any) =>
    ValuationController.getContractPayload(propertyId),
  )
  // POST /oracle/valuations/:propertyId/manual-review — Flag for manual review
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/valuations/:propertyId/manual-review', ({ params: { propertyId }, body }: any) => {
    const { id, reason } = body as { id: string; reason: string };
    return ValuationController.flagForManualReview(id, propertyId, reason);
  })
  // POST /oracle/valuations/manual-override — Submit a manual valuation override
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/valuations/manual-override', ({ body }: any) =>
    ValuationController.submitManualOverride(
      body as RealEstateValuationPayload & { overrideReason: string },
    ),
  );
