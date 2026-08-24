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

const listQuerySchema = paginationQuerySchema.extend({
  queue: z.enum(['pending', 'approved', 'rejected', 'hold', 'changes', 'all']).optional(),
});

const reviewBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes', 'hold']),
  note: z.string().max(2000).optional(),
  actorWallet: z.string().min(50).max(64),
});

export const internalKeyAuth = new Elysia({ name: 'internal-operations-auth' }).onBeforeHandle(
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
    async ({ validatedParams, validatedBody, set }) => {
      try {
        const data = await OperationalPropertyController.applyReviewAction(
          validatedParams!.id,
          validatedBody!,
        );
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

export const internalOperationsRoutes = new Elysia({ prefix: '/internal/operations' })
  .use(listPropertiesRoute)
  .use(getPropertyOperationsRoute)
  .use(reviewPropertyRoute)
  .use(whitelistOperationsRoute);
