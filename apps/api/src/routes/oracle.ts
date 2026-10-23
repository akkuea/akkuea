import { Elysia, t } from 'elysia';
import { ValuationController } from '../controllers/ValuationController';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

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

/**
 * The oracle write routes and the internal risk group share the operations
 * credential (`OPERATIONS_BACKEND_CREDENTIAL`) sent as `x-internal-api-key`,
 * the same credential the internal operations routes already use.
 */
function requireInternalCredential({
  headers,
  set,
}: {
  headers: Record<string, string | undefined>;
  set: { status?: number | string };
}) {
  if (isInternalOperationsAuthorized(headers)) return;
  set.status = 401;
  return { error: 'Unauthorized' };
}

const provenanceSchema = t.Object({
  dataProvider: t.String({ minLength: 1 }),
  reportUrl: t.Optional(t.String()),
  licenseNumber: t.Optional(t.String()),
  assessorName: t.Optional(t.String()),
});

const metadataSchema = t.Object({
  squareFootage: t.Optional(t.Number()),
  bedrooms: t.Optional(t.Number()),
  bathrooms: t.Optional(t.Number()),
  yearBuilt: t.Optional(t.Number()),
  neighborhood: t.Optional(t.String()),
  propertyType: t.Optional(
    t.Union([
      t.Literal('residential'),
      t.Literal('commercial'),
      t.Literal('industrial'),
      t.Literal('land'),
    ]),
  ),
});

// Mirrors RealEstateValuationPayload from @akkuea/shared, so the handler body
// needs no cast and the route rejects payloads the service would reject.
const valuationPayloadSchema = t.Object({
  propertyId: t.String({ minLength: 1 }),
  price: t.Number({ exclusiveMinimum: 0 }),
  currency: t.String({ minLength: 1 }),
  sourceId: t.String({ minLength: 1 }),
  sourceName: t.String({ minLength: 1 }),
  timestamp: t.Date(),
  confidence: t.Number({ minimum: 0, maximum: 100 }),
  methodology: t.Union([
    t.Literal('automated'),
    t.Literal('manual'),
    t.Literal('comparable_sales'),
    t.Literal('income_approach'),
    t.Literal('cost_approach'),
  ]),
  provenance: provenanceSchema,
  metadata: metadataSchema,
});

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  // POST /oracle/valuations - Ingest a new real estate valuation
  .post('/valuations', ({ body }) => ValuationController.ingestValuation(body), {
    beforeHandle: requireInternalCredential,
    body: valuationPayloadSchema,
    detail: {
      summary: 'Ingest valuation',
      description: 'Ingest a new real estate property valuation from the oracle',
      tags: ['Oracle'],
    },
  })
  // GET /oracle/valuations/:propertyId - Latest valuation for a property
  .get(
    '/valuations/:propertyId',
    ({ params: { propertyId } }) => ValuationController.getLatestValuation(propertyId),
    {
      params: t.Object({
        propertyId: t.String(),
      }),
      detail: {
        summary: 'Get latest valuation',
        description: 'Retrieve the latest valuation for a property',
        tags: ['Oracle'],
      },
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
      detail: {
        summary: 'Get valuation history',
        description: 'Retrieve the valuation history for a property',
        tags: ['Oracle'],
      },
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
      detail: {
        summary: 'Get contract payload',
        description: 'Retrieve the contract-ready valuation payload for a property',
        tags: ['Oracle'],
      },
    },
  )
  // POST /oracle/valuations/:propertyId/manual-review - Flag for manual review
  .post(
    '/valuations/:propertyId/manual-review',
    ({ params: { propertyId }, body }) =>
      ValuationController.flagForManualReview(body.id, propertyId, body.reason),
    {
      beforeHandle: requireInternalCredential,
      body: t.Object({
        id: t.String({ minLength: 1 }),
        reason: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Flag for manual review',
        description: 'Flag a valuation for manual review',
        tags: ['Oracle'],
      },
    },
  )
  // POST /oracle/valuations/manual-override - Submit a manual valuation override
  .post(
    '/valuations/manual-override',
    ({ body }) => ValuationController.submitManualOverride(body),
    {
      beforeHandle: requireInternalCredential,
      body: t.Composite([
        valuationPayloadSchema,
        t.Object({ overrideReason: t.String({ minLength: 1 }) }),
      ]),
      detail: {
        summary: 'Manual valuation override',
        description: 'Submit a manual override for a property valuation',
        tags: ['Oracle'],
      },
    },
  );
