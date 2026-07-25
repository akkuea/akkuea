import { Elysia } from 'elysia';
import { z } from 'zod';
import { validateQuery } from '../middleware/validation';
import { auditService } from '../services/AuditService';
import { handleError } from '../utils/errors';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

const auditLogQuerySchema = z.object({
  actor: z.string().min(1).max(56).optional(),
  action: z.string().min(1).max(100).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const getAuditLogRoute = new Elysia()
  .use(validateQuery(auditLogQuerySchema))
  .get('/audit-log', async ({ validatedQuery, set }) => {
    try {
      const result = await auditService.getAuditLogs({
        actor: validatedQuery!.actor,
        action: validatedQuery!.action,
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

export const adminRoutes = new Elysia({ prefix: '/api/v1/admin' })
  .onBeforeHandle(({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return {
        success: false,
        error: 'FORBIDDEN',
        message: 'Admin access denied',
        timestamp: new Date().toISOString(),
      };
    }
  })
  .use(getAuditLogRoute);
