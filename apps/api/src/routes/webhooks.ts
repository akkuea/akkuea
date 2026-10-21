import { Elysia, t } from 'elysia';
import { webhookController } from '../controllers/WebhookController';
import type { WebhookPayload } from '../services/WebhookService';
import { rateLimit } from '../middleware';
import { errorHandler } from '../middleware/errorHandler';
import { ApiError } from '../errors/ApiError';

const rawRequestBodies = new WeakMap<Request, Promise<Uint8Array>>();

export const webhookRoutes = new Elysia({ prefix: '/webhooks' })
  .use(errorHandler)
  .onParse(({ request, contentType }) => {
    if (contentType?.toLowerCase().startsWith('application/json')) {
      rawRequestBodies.set(
        request,
        request
          .clone()
          .arrayBuffer()
          .then((body) => new Uint8Array(body)),
      );
    }
  })
  .post(
    '/transactions',
    async ({ body, headers, request }) => {
      const rawBody = await rawRequestBodies.get(request);
      if (!rawBody) {
        throw ApiError.badRequest('Unable to read raw webhook request body');
      }

      return await webhookController.handleTransactionWebhook({
        body: body as WebhookPayload,
        headers,
        rawBody,
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
