import { Elysia, t, type Context } from 'elysia';
import type { RealEstateValuationPayload } from '@akkuea/shared';
import { ValuationController } from '../controllers/ValuationController';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

export const DEFAULT_VALUATION_HISTORY_LIMIT = 50;
export const MAX_VALUATION_HISTORY_LIMIT = 500;

export function clampValuationHistoryLimit(rawLimit?: unknown): number {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return DEFAULT_VALUATION_HISTORY_LIMIT;
  }
  const parsed = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_VALUATION_HISTORY_LIMIT;
  }
  return Math.min(Math.floor(parsed), MAX_VALUATION_HISTORY_LIMIT);
}

const requireInternalAuth = ({ headers, set }: Context) => {
  if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
    set.status = 401;
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Unauthorized: internal operations credential required',
    };
  }
};

const valuationProvenanceSchema = t.Object({
  dataProvider: t.String({ minLength: 1 }),
  reportUrl: t.Optional(t.String()),
  licenseNumber: t.Optional(t.String()),
  assessorName: t.Optional(t.String()),
});

const valuationMetadataSchema = t.Optional(
  t.Object({
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
  }),
);

const valuationPayloadSchema = t.Object({
  propertyId: t.String({ minLength: 1 }),
  price: t.Number({ minimum: 1, maximum: 1_000_000_000 }),
  currency: t.String({ minLength: 1 }),
  sourceId: t.String({ minLength: 1 }),
  sourceName: t.String({ minLength: 1 }),
  timestamp: t.Union([t.Date(), t.String()]),
  confidence: t.Number({ minimum: 0, maximum: 100 }),
  methodology: t.Union([
    t.Literal('automated'),
    t.Literal('manual'),
    t.Literal('comparable_sales'),
    t.Literal('income_approach'),
    t.Literal('cost_approach'),
  ]),
  provenance: valuationProvenanceSchema,
  metadata: valuationMetadataSchema,
});

const manualOverrideSchema = t.Composite([
  valuationPayloadSchema,
  t.Object({
    overrideReason: t.String({ minLength: 1 }),
  }),
]);

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  // POST /oracle/valuations - Ingest a new real estate valuation (Protected)
  .post(
    '/valuations',
    ({ body }) => {
      const payload: RealEstateValuationPayload = {
        ...body,
        metadata: body.metadata ?? {},
        timestamp: new Date(body.timestamp),
      };
      return ValuationController.ingestValuation(payload);
    },
    {
      beforeHandle: requireInternalAuth,
      body: valuationPayloadSchema,
      detail: {
        summary: 'Ingest valuation',
        description: 'Ingest a new real estate property valuation from the oracle (Protected)',
        tags: ['Oracle'],
      },
    },
  )
  // GET /oracle/valuations/:propertyId - Latest valuation for a property (Public read-only)
  .get(
    '/valuations/:propertyId',
    ({ params: { propertyId } }) => ValuationController.getLatestValuation(propertyId),
    {
      params: t.Object({
        propertyId: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Get latest valuation',
        description: 'Retrieve the latest valuation for a property',
        tags: ['Oracle'],
      },
    },
  )
  // GET /oracle/valuations/:propertyId/history - Valuation history (Public read-only)
  .get(
    '/valuations/:propertyId/history',
    ({ params: { propertyId }, query }) =>
      ValuationController.getValuationHistory(propertyId, clampValuationHistoryLimit(query.limit)),
    {
      params: t.Object({
        propertyId: t.String({ minLength: 1 }),
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
  // GET /oracle/valuations/:propertyId/contract-payload - Contract-ready payload (Public read-only)
  .get(
    '/valuations/:propertyId/contract-payload',
    ({ params: { propertyId } }) => ValuationController.getContractPayload(propertyId),
    {
      params: t.Object({
        propertyId: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Get contract payload',
        description: 'Retrieve the contract-ready valuation payload for a property',
        tags: ['Oracle'],
      },
    },
  )
  // POST /oracle/valuations/:propertyId/manual-review - Flag for manual review (Protected)
  .post(
    '/valuations/:propertyId/manual-review',
    ({ params: { propertyId }, body }) => {
      const { id, reason } = body;
      return ValuationController.flagForManualReview(id, propertyId, reason);
    },
    {
      beforeHandle: requireInternalAuth,
      params: t.Object({
        propertyId: t.String({ minLength: 1 }),
      }),
      body: t.Object({
        id: t.String({ minLength: 1 }),
        reason: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Flag for manual review',
        description: 'Flag a valuation for manual review (Protected)',
        tags: ['Oracle'],
      },
    },
  )
  // POST /oracle/valuations/manual-override - Submit a manual valuation override (Protected)
  .post(
    '/valuations/manual-override',
    ({ body }) => {
      const payload: RealEstateValuationPayload & { overrideReason: string } = {
        ...body,
        metadata: body.metadata ?? {},
        timestamp: new Date(body.timestamp),
      };
      return ValuationController.submitManualOverride(payload);
    },
    {
      beforeHandle: requireInternalAuth,
      body: manualOverrideSchema,
      detail: {
        summary: 'Manual valuation override',
        description: 'Submit a manual override for a property valuation (Protected)',
        tags: ['Oracle'],
      },
    },
  );
