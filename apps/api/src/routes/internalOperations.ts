import { Elysia, t } from 'elysia';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  uuidParamSchema,
  paginationQuerySchema,
} from '../middleware/validation';
import {
  OperationalPropertyController,
  type OperationsQueue,
} from '../controllers/OperationalPropertyController';
import { WhitelistController } from '../controllers/WhitelistController';
import { handleError } from '../utils/errors';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import { auditService } from '../services/AuditService';

const listQuerySchema = paginationQuerySchema.extend({
  queue: z.enum(['pending', 'approved', 'rejected', 'hold', 'changes', 'all']).optional(),
});

const reviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes', 'hold']),
  note: z.string().max(2000).optional(),
});

const auditQuerySchema = z.object({
  actor: z.string().min(1).max(56).optional(),
  actionType: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// `as: 'scoped'` is required: a default-scope (`'local'`) hook only applies
// to routes defined directly on this instance, not to the routes of whoever
// calls `.use(internalKeyAuth)`, so without it every route below runs with
// no authentication at all.
export const internalKeyAuth = new Elysia({ name: 'internal-operations-auth' }).onBeforeHandle(
  { as: 'scoped' },
  ({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return {
        success: false,
        error: 'FORBIDDEN',
        message: 'Operations access denied',
        timestamp: new Date().toISOString(),
      };
    }
  },
);

const listPropertiesRoute = new Elysia()
  .use(internalKeyAuth)
  .use(validateQuery(listQuerySchema))
  .get(
    '/properties',
    async ({ validatedQuery, set }) => {
      try {
        const result = await OperationalPropertyController.listProperties({
          queue: validatedQuery!.queue as OperationsQueue | undefined,
          page: validatedQuery!.page,
          limit: validatedQuery!.limit,
        });
        return { success: true, ...result };
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      detail: {
        summary: 'List operational properties',
        description: 'List properties in the operations queue with status filters',
        tags: ['Internal Operations'],
      },
    },
  );

const getPropertyOperationsRoute = new Elysia()
  .use(internalKeyAuth)
  .use(validateParams(uuidParamSchema))
  .get(
    '/properties/:id',
    async ({ validatedParams, set }) => {
      try {
        const data = await OperationalPropertyController.getPropertyDetail(validatedParams!.id);
        return { success: true, data };
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      detail: {
        summary: 'Get property operations detail',
        description: 'Retrieve detailed information about a property in the operations queue',
        tags: ['Internal Operations'],
      },
    },
  );

const reviewPropertyRoute = new Elysia()
  .use(internalKeyAuth)
  .use(validateParams(uuidParamSchema))
  .use(validateBody(reviewBodySchema))
  .post(
    '/properties/:id/review',
    async ({ validatedParams, validatedBody, headers, set }) => {
      try {
        const actorWallet = headers['x-operator-wallet'];
        if (!actorWallet || !/^G[A-Z2-7]{55}$/.test(actorWallet)) {
          set.status = 401;
          return {
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Verified operator identity is required',
          };
        }
        const data = await OperationalPropertyController.applyReviewAction(validatedParams!.id, {
          ...validatedBody!,
          actorWallet,
        });
        return { success: true, data };
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      detail: {
        summary: 'Review a property',
        description: 'Approve, reject, or request changes for a property in the operations queue',
        tags: ['Internal Operations'],
      },
    },
  );

const reviewWhitelistSchema = t.Object({
  action: t.Union([t.Literal('approve'), t.Literal('reject')]),
  reason: t.Optional(t.String()),
});

const whitelistOperationsRoute = new Elysia({ prefix: '/pilot/whitelist' })
  .use(internalKeyAuth)
  .get('/pending', () => WhitelistController.pending(), {
    detail: {
      summary: 'Get pending whitelist requests (Admin)',
      tags: ['Internal Operations'],
    },
  })
  .post('/:id/review', (ctx) => WhitelistController.review(ctx), {
    body: reviewWhitelistSchema,
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      summary: 'Review whitelist request (Admin)',
      tags: ['Internal Operations'],
    },
  });

const auditOperationsRoute = new Elysia()
  .use(internalKeyAuth)
  .use(validateQuery(auditQuerySchema))
  .get('/audit-log', async ({ validatedQuery, set }) => {
    try {
      const result = await auditService.getAuditLogs({
        actor: validatedQuery!.actor,
        action: validatedQuery!.actionType,
        startDate: validatedQuery!.startDate,
        endDate: validatedQuery!.endDate,
        page: validatedQuery!.page,
        limit: validatedQuery!.limit,
      });
      return { success: true, ...result };
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

export const internalOperationsRoutes = new Elysia({ prefix: '/internal/operations' })
  .use(listPropertiesRoute)
  .use(getPropertyOperationsRoute)
  .use(reviewPropertyRoute)
  .use(auditOperationsRoute)
  .use(whitelistOperationsRoute);
