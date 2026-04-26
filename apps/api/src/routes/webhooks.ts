import { Elysia, t } from 'elysia';
import { webhookController } from '../controllers/WebhookController';
import type { WebhookPayload } from '../services/WebhookService';
import { rateLimit } from '../middleware';
import { errorHandler } from '../middleware/errorHandler';

export const webhookRoutes = new Elysia({ prefix: '/webhooks' })
  .use(errorHandler)
  .post(
    '/transactions',
    async ({ body, headers }) => {
      return await webhookController.handleTransactionWebhook({
        body: body as WebhookPayload,
        headers,
      });
    },
    {
      body: t.Object({
        transactionHash: t.String({ minLength: 64, maxLength: 64 }),
        status: t.Union([t.Literal('confirmed'), t.Literal('failed')]),
        network: t.Optional(t.String()),
        timestamp: t.Optional(t.String()),
      }),
      beforeHandle: [rateLimit()],
      detail: {
        summary: 'Handle transaction webhooks',
        description: 'Receives notifications from Stellar network and updates transaction status',
        tags: ['Webhooks'],
      },
    },
  );
