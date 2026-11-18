import { Elysia, t } from 'elysia';
import type { RealEstateValuationPayload } from '@akkuea/shared';
import { ValuationController } from '../controllers/ValuationController';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

export const valuationMethodologySchema = t.Union([
  t.Literal('automated'),
  t.Literal('manual'),
  t.Literal('comparable_sales'),
  t.Literal('income_approach'),
  t.Literal('cost_approach'),
]);

export const propertyTypeSchema = t.Union([
  t.Literal('residential'),
  t.Literal('commercial'),
  t.Literal('industrial'),
  t.Literal('land'),
]);

export const valuationProvenanceSchema = t.Object({
  dataProvider: t.String({ minLength: 1 }),
  reportUrl: t.Optional(t.String()),
  licenseNumber: t.Optional(t.String()),
  assessorName: t.Optional(t.String()),
});

export const valuationMetadataSchema = t.Object({
  squareFootage: t.Optional(t.Number()),
  bedrooms: t.Optional(t.Number()),
  bathrooms: t.Optional(t.Number()),
  yearBuilt: t.Optional(t.Number()),
  neighborhood: t.Optional(t.String()),
  propertyType: t.Optional(propertyTypeSchema),
});

export const realEstateValuationPayloadSchema = t.Object({
  propertyId: t.String({ minLength: 1 }),
  price: t.Number({ minimum: 1, maximum: 1_000_000_000 }),
  currency: t.String({ minLength: 1 }),
  sourceId: t.String({ minLength: 1 }),
  sourceName: t.String({ minLength: 1 }),
  timestamp: t.Union([t.Date(), t.String(), t.Number()]),
  confidence: t.Number({ minimum: 0, maximum: 100 }),
  methodology: valuationMethodologySchema,
  provenance: valuationProvenanceSchema,
  metadata: t.Optional(valuationMetadataSchema),
});

export const manualReviewPayloadSchema = t.Object({
  id: t.String({ minLength: 1 }),
  reason: t.String({ minLength: 1 }),
});

export const manualOverridePayloadSchema = t.Object({
  propertyId: t.String({ minLength: 1 }),
  price: t.Number({ minimum: 1, maximum: 1_000_000_000 }),
  currency: t.String({ minLength: 1 }),
  sourceId: t.String({ minLength: 1 }),
  sourceName: t.String({ minLength: 1 }),
  timestamp: t.Union([t.Date(), t.String(), t.Number()]),
  confidence: t.Number({ minimum: 0, maximum: 100 }),
  methodology: valuationMethodologySchema,
  provenance: valuationProvenanceSchema,
  metadata: t.Optional(valuationMetadataSchema),
  overrideReason: t.String({ minLength: 1 }),
});

const requireInternalAuth = ({
  headers,
  set,
}: {
  headers: Record<string, string | undefined>;
  set: { status?: number | string };
}) => {
  if (!isInternalOperationsAuthorized(headers)) {
    set.status = 401;
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Operations access denied',
      timestamp: new Date().toISOString(),
    };
  }
};

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  // POST /oracle/valuations - Ingest a new real estate valuation
  .post(
    '/valuations',
    ({ body }) => {
      const payload: RealEstateValuationPayload = {
        ...body,
        timestamp: body.timestamp instanceof Date ? body.timestamp : new Date(body.timestamp),
        metadata: body.metadata ?? {},
      };
      return ValuationController.ingestValuation(payload);
    },
    {
      beforeHandle: requireInternalAuth,
      body: realEstateValuationPayloadSchema,
      detail: {
        summary: 'Ingest valuation',
        description: 'Ingest a new real estate property valuation from the oracle',
        tags: ['Oracle'],
      },
    },
  )
  // GET /oracle/valuations/:propertyId - Latest valuation for a property (PUBLIC)
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
  // GET /oracle/valuations/:propertyId/history - Valuation history (PUBLIC)
  .get(
    '/valuations/:propertyId/history',
    ({ params: { propertyId }, query }) => {
      const rawLimit = query.limit !== undefined ? Number(query.limit) : 50;
      const safeLimit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(Math.max(Math.floor(rawLimit), 1), 500)
          : 50;
      return ValuationController.getValuationHistory(propertyId, safeLimit);
    },
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
  // GET /oracle/valuations/:propertyId/contract-payload - Contract-ready payload (PUBLIC)
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
    ({ params: { propertyId }, body }) => {
      const { id, reason } = body;
      return ValuationController.flagForManualReview(id, propertyId, reason);
    },
    {
      beforeHandle: requireInternalAuth,
      params: t.Object({
        propertyId: t.String({ minLength: 1 }),
      }),
      body: manualReviewPayloadSchema,
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
    ({ body }) => {
      const payload: RealEstateValuationPayload & { overrideReason: string } = {
        ...body,
        timestamp: body.timestamp instanceof Date ? body.timestamp : new Date(body.timestamp),
        metadata: body.metadata ?? {},
      };
      return ValuationController.submitManualOverride(payload);
    },
    {
      beforeHandle: requireInternalAuth,
      body: manualOverridePayloadSchema,
      detail: {
        summary: 'Manual valuation override',
        description: 'Submit a manual override for a property valuation',
        tags: ['Oracle'],
      },
    },
  );
