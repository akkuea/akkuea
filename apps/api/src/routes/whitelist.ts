import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { WhitelistController } from '../controllers/WhitelistController';
import { handleError } from '../utils/errors';
import { validateQuery } from '../middleware/validation';
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
    body: requestSchema,
    detail: {
      summary: 'Submit whitelist request',
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
  .use(whitelistMetricsRoute);
