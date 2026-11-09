import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { ValidationService, type RealEstateValuationPayload } from '@akkuea/shared';
import { ValuationController } from '../controllers/ValuationController';
import { validate } from '../middleware/validation';
import {
  DEFAULT_VALUATION_HISTORY_LIMIT,
  sanitizeValuationHistoryLimit,
} from '../repositories/ValuationRepository';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

const methodologySchema = z.enum([
  'automated',
  'manual',
  'comparable_sales',
  'income_approach',
  'cost_approach',
]);

const propertyTypeSchema = z.enum(['residential', 'commercial', 'industrial', 'land']);

const baseValuationPayloadSchema = z.object({
  propertyId: z.string().trim().min(1, 'Property ID is required'),
  price: z.number().finite().positive('Price must be greater than 0'),
  currency: z.string().trim().min(1, 'Currency is required'),
  sourceId: z.string().trim().min(1, 'Source ID is required'),
  sourceName: z.string().trim().min(1, 'Source name is required'),
  timestamp: z.coerce.date(),
  confidence: z.number().finite().min(0).max(100),
  methodology: methodologySchema,
  provenance: z.object({
    dataProvider: z.string().trim().min(1, 'Provenance dataProvider is required'),
    reportUrl: z.string().optional(),
    licenseNumber: z.string().optional(),
    assessorName: z.string().optional(),
  }),
  metadata: z
    .object({
      squareFootage: z.number().finite().positive().optional(),
      bedrooms: z.number().int().nonnegative().optional(),
      bathrooms: z.number().nonnegative().optional(),
      yearBuilt: z.number().int().optional(),
      neighborhood: z.string().optional(),
      propertyType: propertyTypeSchema.optional(),
    })
    .default({}),
});

const valuationPayloadSchema = baseValuationPayloadSchema.superRefine((payload, ctx) => {
  const { isValid, errors } = ValidationService.validateValuationPayload(payload);
  if (!isValid) {
    for (const error of errors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error,
      });
    }
  }
});

const manualReviewParamsSchema = z.object({
  propertyId: z.string().trim().min(1, 'Property ID is required'),
});

const manualReviewBodySchema = z.object({
  id: z.string().trim().min(1, 'Valuation ID is required'),
  reason: z.string().trim().min(1, 'Manual review reason is required'),
});

const manualOverrideBodySchema = baseValuationPayloadSchema
  .extend({
    overrideReason: z.string().trim().min(1, 'Override reason is required'),
  })
  .superRefine((payload, ctx) => {
    const { isValid, errors } = ValidationService.validateValuationPayload(payload);
    if (!isValid) {
      for (const error of errors) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        });
      }
    }
  });

const internalOracleAuth = new Elysia({ name: 'internal-oracle-auth' }).onBeforeHandle(
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

function parseHistoryLimit(raw?: string): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_VALUATION_HISTORY_LIMIT;
  }
  return sanitizeValuationHistoryLimit(Number(raw));
}

export const oracleRoutes = new Elysia({ prefix: '/oracle' })
  // GET /oracle/valuations/:propertyId - Latest valuation for a property (public read)
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
  // GET /oracle/valuations/:propertyId/history - Valuation history (public read, bounded limit)
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
        description: 'Retrieve the valuation history for a property (limit bounded to 1-500)',
        tags: ['Oracle'],
      },
    },
  )
  // GET /oracle/valuations/:propertyId/contract-payload - Contract-ready payload (public read)
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
  // POST /oracle/valuations - Ingest a new real estate valuation (internal auth required)
  .group('', (app) =>
    app
      .use(internalOracleAuth)
      .use(validate({ body: valuationPayloadSchema }))
      .post(
        '/valuations',
        ({ validatedBody }) =>
          ValuationController.ingestValuation(validatedBody as RealEstateValuationPayload),
        {
          detail: {
            summary: 'Ingest valuation',
            description: 'Ingest a new real estate property valuation from the oracle',
            tags: ['Oracle'],
          },
        },
      ),
  )
  // POST /oracle/valuations/:propertyId/manual-review - Flag for manual review (internal auth required)
  .group('', (app) =>
    app
      .use(internalOracleAuth)
      .use(validate({ params: manualReviewParamsSchema, body: manualReviewBodySchema }))
      .post(
        '/valuations/:propertyId/manual-review',
        ({ validatedParams, validatedBody }) => {
          const { id, reason } = validatedBody!;
          return ValuationController.flagForManualReview(id, validatedParams!.propertyId, reason);
        },
        {
          detail: {
            summary: 'Flag for manual review',
            description: 'Flag a valuation for manual review',
            tags: ['Oracle'],
          },
        },
      ),
  )
  // POST /oracle/valuations/manual-override - Submit a manual valuation override (internal auth required)
  .group('', (app) =>
    app
      .use(internalOracleAuth)
      .use(validate({ body: manualOverrideBodySchema }))
      .post(
        '/valuations/manual-override',
        ({ validatedBody }) =>
          ValuationController.submitManualOverride(
            validatedBody as RealEstateValuationPayload & { overrideReason: string },
          ),
        {
          detail: {
            summary: 'Manual valuation override',
            description: 'Submit a manual override for a property valuation',
            tags: ['Oracle'],
          },
        },
      ),
  );
