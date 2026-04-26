import { webhookService, type WebhookPayload } from '../services/WebhookService';
import { logger } from '../services/logger';
import { ApiError } from '../errors/ApiError';

export class WebhookController {
  async handleTransactionWebhook({
    body,
    headers,
  }: {
    body: WebhookPayload;
    headers: Record<string, string | undefined>;
  }) {
    const signature = headers['x-webhook-signature'];

    if (!signature) {
      logger.warn('Webhook received without signature');
      throw ApiError.badRequest('Missing webhook signature');
    }

    const isValid = webhookService.validateSignature(JSON.stringify(body), signature);
    if (!isValid) {
      logger.warn('Invalid webhook signature');
      throw ApiError.badRequest('Invalid webhook signature');
    }

    try {
      await webhookService.processTransactionWebhook(body);
      return { status: 'success', message: 'Webhook processed' };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('Unexpected error during webhook processing', error);
      throw ApiError.internal('Internal server error during webhook processing');
    }
  }
}

export const webhookController = new WebhookController();
