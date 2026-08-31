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

export const whitelistRoutes = new Elysia({ prefix: '/pilot/whitelist' })
  .post('/request', (ctx) => WhitelistController.request(ctx), {
    beforeHandle: [rateLimit()],
    body: requestSchema,
    detail: {
      summary: 'Submit whitelist request',
      description:
        'Public, unauthenticated KYC intake endpoint. Rate-limited to 10 requests per minute per IP (same default as other public endpoints in this API). This endpoint accepts PII (full name, ID type, ID reference), so abuse protection is critical.',
      tags: ['Pilot Whitelist'],
    },
  })
  // GET /status is intentionally not rate-limited: the response contains only
  // coarse application state (pending/approved/rejected/none), no PII is
  // returned, and the endpoint is read-only. Rate limiting is not required for
  // the current pilot threat model. Revisit if response data expands or
  // enumeration becomes operationally relevant.
  .get('/status/:walletAddress', (ctx) => WhitelistController.status(ctx), {
    params: t.Object({ walletAddress: t.String() }),
    detail: {
      summary: 'Get status of whitelist request',
      tags: ['Pilot Whitelist'],
    },
  })
  .use(whitelistMetricsRoute);
