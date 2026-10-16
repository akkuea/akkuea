import { Elysia, t } from 'elysia';
import type { RealEstateValuationPayload } from '@akkuea/shared';
import { ValuationController } from '../controllers/ValuationController';
import { isInternalOperationsAuthorized } from '../middleware/internalAuth';

const MIN_HISTORY_LIMIT = 1;
const MAX_HISTORY_LIMIT = 500;
const DEFAULT_HISTORY_LIMIT = 50;

function parseHistoryLimit(rawLimit: unknown): number {
  const parsed = typeof rawLimit === 'string' ? Number(rawLimit) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_HISTORY_LIMIT;
  const integer = Math.trunc(parsed);
  if (integer < MIN_HISTORY_LIMIT) return MIN_HISTORY_LIMIT;
  if (integer > MAX_HISTORY_LIMIT) return MAX_HISTORY_LIMIT;
  return integer;
}

const valuationPayloadSchema = t.Object({
  propertyId: t.String({ minLength: 1 }),
  price: t.Number({ exclusiveMinimum: 0 }),
  currency: t.String({ minLength: 1 }),
  sourceId: t.String({ minLength: 1 }),
  sourceName: t.String({ minLength: 1 }),
  timestamp: t.Union([t.String(), t.Date()]),
  confidence: t.Number({ minimum: 0, maximum: 100 }),
  methodology: t.String(),
  provenance: t.Record(t.String(), t.Unknown()),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
});

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  .on('beforeHandle', ({ request, set, path }) => {
    const isWrite = request.method === 'POST';
    if (!isWrite) return;
    if (path === '/oracle/valuations' || path.startsWith('/oracle/valuations/')) {
      if (!isInternalOperationsAuthorized(request)) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
    }
  })
  // POST /oracle/valuations - Ingest a new real estate valuation
  .post(
    '/valuations',
    ({ body }) => ValuationController.ingestValuation(body as RealEstateValuationPayload),
    {
      body: valuationPayloadSchema,
      detail: {
        summary: 'Ingest valuation',
        description: 'Ingest a new real estate property valuation from the oracle',
        tags: ['Oracle'],
      },
    },
  )
  // GET /oracle/valuations/:propertyId - Latest valuation for a property
  .get(
    '/valuations/:propertyId',
    ({ params: { propertyId } }) => ValuationController.getLatestValuation(propertyId),
    {
      params: t.Object({
        propertyId: t.String(),
      }),
      detail: {}
    },
  )
  // GET /oracle/valuations/:propertyId/history - Valuation history
  .get(
    '/valuations/:propertyId/history',
    ({ params: { propertyId }, query }) =>
      ValuationController.getValuationHistory(propertyId, parseHistoryLimit(query.limit)),
    {
      params: t.Object({
        propertyId: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
      detail: {}
    },
  )
  // GET /oracle/valuations/:propertyId/contract-payload - Contract-ready payload
  .get(
    '/valuations/:propertyId/contract-payload',
    ({ params: { propertyId } }) => ValuationController.getContractPayload(propertyId),
    {
      params: t.Object({
        propertyId: t.String(),
      }),
      detail: {}
    },
  )
  // POST /oracle/valuations/:propertyId/manual-review - Flag for manual review
  .post(
    '/valuations/:propertyId/manual-review',
    ({ params: { propertyId }, body }) => {
      const { id, reason } = body as { id: string; reason: string };
      return ValuationController.flagForManualReview(id, propertyId, reason);
    },
    {
      body: t.Object({
        id: t.String(),
        reason: t.String(),
      }),
      detail: {}
    },
  )
  // POST /oracle/valuations/manual-override - Submit a manual valuation override
  .post(
    '/valuations/manual-override',
    ({ body }) =>
      ValuationController.submitManualOverride(
        body as RealEstateValuationPayload & { overrideReason: string },
      ),
    {
      body: t.Compose([valuationPayloadSchema, t.Object({ overrideReason: t.String({ minLength: 1 }) })]),
      detail: {}
    },
  );
