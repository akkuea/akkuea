import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  validateBody,
  validateParams,
  validateQuery,
  uuidParamSchema,
} from '../middleware/validation';
import { NotificationService } from '../services/NotificationService';
import { handleError } from '../utils/errors';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

const dlqPaginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(parseInt(v, 10) || 100, 500) : 100)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) || 0 : 0)),
});

const reprocessBodySchema = z.object({
  requeuedBy: z.string().min(1).max(255),
});

let _service: NotificationService | null = null;
function getService(): NotificationService {
  if (!_service) _service = new NotificationService();
  return _service;
}

const listDlqRoute = new Elysia()
  .use(validateQuery(dlqPaginationSchema))
  .get('/notifications/dlq', async ({ validatedQuery, set }) => {
    try {
      const { limit, offset } = validatedQuery!;
      const entries = await getService().getDlqEntries(limit, offset);
      return { success: true, data: entries, meta: { limit, offset, count: entries.length } };
    } catch (error) {
      const err = handleError(error);
      set.status = err.statusCode;
      return err;
    }
  });

const getDlqEntryRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .get('/notifications/dlq/:id', async ({ validatedParams, set }) => {
    try {
      const entry = await getService().getDlqEntryById(validatedParams!.id);
      if (!entry) {
        set.status = 404;
        return {
          success: false,
          error: 'NOT_FOUND',
          message: `DLQ entry ${validatedParams!.id} not found`,
          timestamp: new Date().toISOString(),
        };
      }
      return { success: true, data: entry };
    } catch (error) {
      const err = handleError(error);
      set.status = err.statusCode;
      return err;
    }
  });

const reprocessDlqRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .use(validateBody(reprocessBodySchema))
  .post('/notifications/dlq/:id/reprocess', async ({ validatedParams, validatedBody, set }) => {
    try {
      const result = await getService().reprocessDlqEntry(
        validatedParams!.id,
        validatedBody!.requeuedBy,
      );
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already been')) {
        set.status = 409;
        return {
          success: false,
          error: 'CONFLICT',
          message: error.message,
          timestamp: new Date().toISOString(),
        };
      }
      if (error instanceof Error && error.message.includes('not found')) {
        set.status = 404;
        return {
          success: false,
          error: 'NOT_FOUND',
          message: error.message,
          timestamp: new Date().toISOString(),
        };
      }
      const err = handleError(error);
      set.status = err.statusCode;
      return err;
    }
  });

export const notificationDlqRoutes = new Elysia({ prefix: '/internal' })
  .onBeforeHandle(({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return {
        success: false,
        error: 'FORBIDDEN',
        message: 'Operations access denied',
        timestamp: new Date().toISOString(),
      };
    }
  })
  .use(listDlqRoute)
  .use(getDlqEntryRoute)
  .use(reprocessDlqRoute);
