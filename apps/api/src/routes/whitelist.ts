import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { WhitelistController } from '../controllers/WhitelistController';
import { handleError } from '../utils/errors';
import { validateQuery } from '../middleware/validation';
import { rateLimit } from '../middleware';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

const requestSchema = t.Object({
  walletAddress: t.String({ maxLength: 56 }),
  fullName: t.String({ maxLength: 255 }),
  idType: t.Union([t.Literal('passport'), t.Literal('national_id'), t.Literal('drivers_license')]),
  idReference: t.String({ maxLength: 255 }),
});

const requestMultipartSchema = t.Object({
  walletAddress: t.String({ maxLength: 56 }),
  fullName: t.String({ maxLength: 255 }),
  idType: t.Union([t.Literal('passport'), t.Literal('national_id'), t.Literal('drivers_license')]),
  idReference: t.String({ maxLength: 255 }),
  document: t.File(),
});

const metricsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  windowDays: z.coerce.number().int().positive().max(365).optional(),
});

function operationsDenied() {
  return {
    success: false as const,
    error: 'FORBIDDEN',
    message: 'Operations access denied',
    timestamp: new Date().toISOString(),
  };
}

const whitelistMetricsRoute = new Elysia().use(validateQuery(metricsQuerySchema)).get(
  '/metrics',
  async ({ headers, validatedQuery, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return operationsDenied();
    }
    try {
      return await WhitelistController.metrics(validatedQuery ?? {});
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'Whitelist and evidence review turnaround metrics (operator)',
      description:
        'Count, mean, median, p95, and SLA-breach stats for whitelist review (database) and evidence review (on-chain). Requires x-internal-api-key.',
      tags: ['Pilot Whitelist'],
      security: [{ internalApiKey: [] }],
    },
  },
);

// Operator-only document preview route (requires internal API key)
const whitelistDocumentRoute = new Elysia().get(
  '/document/:requestId',
  async ({ params: { requestId }, headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return operationsDenied();
    }
    try {
      return await WhitelistController.getDocumentUrl(requestId);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    params: t.Object({ requestId: t.String() }),
    detail: {
      summary: 'Get signed document URL for whitelist request (operator only)',
      description:
        'Returns a time-limited signed URL to view the uploaded ID document. Requires x-internal-api-key.',
      tags: ['Pilot Whitelist'],
      security: [{ internalApiKey: [] }],
    },
  },
);

// Operator-only pending requests route (requires internal API key)
const whitelistPendingRoute = new Elysia().get(
  '/pending',
  async ({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return operationsDenied();
    }
    try {
      return await WhitelistController.pending();
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'Get all pending whitelist requests (operator only)',
      description:
        'Returns all pending whitelist requests for operator review. Requires x-internal-api-key.',
      tags: ['Pilot Whitelist'],
      security: [{ internalApiKey: [] }],
    },
  },
);

// Operator-only delete/anonymize request (data subject request) - requires internal API key
const whitelistDeleteRoute = new Elysia().delete(
  '/:requestId',
  async ({ params: { requestId }, headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return operationsDenied();
    }
    try {
      return await WhitelistController.deleteRequest(requestId);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    params: t.Object({ requestId: t.String() }),
    detail: {
      summary: 'Delete/anonymize whitelist request (operator only, rejected only)',
      description:
        'Deletes the associated document and anonymizes PII fields. Only allowed for rejected requests. Approved requests cannot be deleted (audit trail required). Requires x-internal-api-key.',
      tags: ['Pilot Whitelist'],
      security: [{ internalApiKey: [] }],
    },
  },
);

export const whitelistRoutes = new Elysia({ prefix: '/pilot/whitelist' })
  .post('/request', (ctx) => WhitelistController.request(ctx), {
    beforeHandle: [rateLimit()],
    body: requestMultipartSchema,
    detail: {
      summary: 'Submit whitelist request with ID document',
      description:
        'Public, unauthenticated KYC intake endpoint. Rate-limited to 10 requests per minute per IP. Accepts multipart/form-data with document file (PDF, JPG, PNG, max 10MB). This endpoint accepts PII (full name, ID type, ID reference) and government ID document, so abuse protection is critical.',
      tags: ['Pilot Whitelist'],
    },
  })
  .get('/status/:walletAddress', (ctx) => WhitelistController.status(ctx), {
    params: t.Object({ walletAddress: t.String() }),
    detail: {
      summary: 'Get status of whitelist request',
      tags: ['Pilot Whitelist'],
    },
  })
  .use(whitelistPendingRoute)
  .use(whitelistDocumentRoute)
  .use(whitelistDeleteRoute)
  .use(whitelistMetricsRoute);
