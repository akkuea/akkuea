import { logger } from './logger';
import { transactionRepository } from '../repositories/TransactionRepository';
import { ApiError } from '../errors/ApiError';
import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookPayload {
  transactionHash: string;
  status: 'confirmed' | 'failed';
  network?: string;
  timestamp?: string;
}

const DEFAULT_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export class WebhookService {
  private readonly webhookSecret: string;
  private readonly timestampToleranceMs: number;

  constructor() {
    const configuredTolerance = Number(
      process.env.WEBHOOK_TIMESTAMP_TOLERANCE_MS ?? DEFAULT_TIMESTAMP_TOLERANCE_MS,
    );
    if (!Number.isSafeInteger(configuredTolerance) || configuredTolerance <= 0) {
      throw new Error('WEBHOOK_TIMESTAMP_TOLERANCE_MS must be a positive integer');
    }
    this.timestampToleranceMs = configuredTolerance;

    const configuredSecret = process.env.WEBHOOK_SECRET;
    if (configuredSecret) {
      this.webhookSecret = configuredSecret;
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('WEBHOOK_SECRET must be configured in production');
    }

    this.webhookSecret = 'default-secret-for-dev';
  }

  /**
   * Validates the webhook signature from the request header.
   * Expects an X-Webhook-Signature header.
   */
  validateSignature(payload: string | Uint8Array, signature: string): boolean {
    if (!/^[0-9a-f]{64}$/i.test(signature)) {
      return false;
    }

    const hmac = createHmac('sha256', this.webhookSecret);
    const digest = hmac.update(payload).digest('hex');
    const expected = Buffer.from(digest, 'hex');
    const received = Buffer.from(signature, 'hex');

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  }

  validateTimestamp(timestamp: string | undefined, now = Date.now()): void {
    if (timestamp === undefined) {
      return;
    }

    const parsedTimestamp = Date.parse(timestamp);
    if (
      !Number.isFinite(parsedTimestamp) ||
      Math.abs(now - parsedTimestamp) > this.timestampToleranceMs
    ) {
      throw ApiError.badRequest('Webhook timestamp is outside the allowed window');
    }
  }

  /**
   * Processes the transaction webhook payload.
   * Updates transaction status and handles idempotency.
   */
  async processTransactionWebhook(payload: WebhookPayload): Promise<void> {
    const { transactionHash, status } = payload;
    this.validateTimestamp(payload.timestamp);

    logger.info('Processing transaction webhook', {
      operation: 'WEBHOOK_PROCESS',
      transactionHash,
      status,
    });

    const transaction = await transactionRepository.findByHash(transactionHash);

    if (!transaction) {
      logger.warn('Transaction not found for webhook', { transactionHash });
      throw ApiError.notFound(`Transaction with hash ${transactionHash} not found`);
    }

    if (transaction.status !== 'pending') {
      this.rejectNonPendingTransition(transaction.id, transaction.status, status);
    }

    try {
      const updatedTransaction = await transactionRepository.updateStatusIfPending(
        transaction.id,
        status,
      );
      if (!updatedTransaction) {
        const latestTransaction = await transactionRepository.findByHash(transactionHash);
        this.rejectNonPendingTransition(
          latestTransaction?.id ?? transaction.id,
          latestTransaction?.status ?? transaction.status,
          status,
        );
      }

      logger.crud.success('WEBHOOK_UPDATE', 'Transaction', transaction.id);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.crud.failure('WEBHOOK_UPDATE', 'Transaction', error as Error, transaction.id);
      throw ApiError.internal('Failed to update transaction status');
    }
  }

  private rejectNonPendingTransition(
    transactionId: string,
    currentStatus: string,
    requestedStatus: WebhookPayload['status'],
  ): never {
    logger.warn('Rejected webhook transition for non-pending transaction', {
      transactionId,
      currentStatus,
      requestedStatus,
    });
    if (currentStatus === requestedStatus) {
      throw ApiError.conflict(`Transaction status is already ${requestedStatus}`);
    }
    throw ApiError.conflict(
      `Cannot transition transaction from ${currentStatus} to ${requestedStatus}`,
    );
  }
}

export const webhookService = new WebhookService();
