import { describe, expect, it, spyOn, beforeEach, afterEach, mock } from 'bun:test';
import { webhookService, type WebhookPayload } from './WebhookService';
import { transactionRepository } from '../repositories/TransactionRepository';
import type { Transaction } from '../db/schema/transactions';
import { logger } from './logger';
import { createHmac } from 'crypto';

describe('WebhookService', () => {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret-for-dev';

  beforeEach(() => {
    // Mock logger to avoid noisy output
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'warn').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
    spyOn(logger.crud, 'success').mockImplementation(() => {});
    spyOn(logger.crud, 'failure').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore spies on shared singletons (e.g. transactionRepository) so DB integration tests are not affected
    mock.restore();
  });

  describe('validateSignature', () => {
    it('should return true for valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const hmac = createHmac('sha256', WEBHOOK_SECRET);
      const signature = hmac.update(payload).digest('hex');

      const isValid = webhookService.validateSignature(payload, signature);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const isValid = webhookService.validateSignature(payload, 'wrong-signature');
      expect(isValid).toBe(false);
    });

    it('should verify exact raw request bytes without normalizing JSON', () => {
      const rawBody = new TextEncoder().encode('{\n  "test": "data"\n}');
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');

      expect(webhookService.validateSignature(rawBody, signature)).toBe(true);
      expect(
        webhookService.validateSignature(new TextEncoder().encode('{"test":"data"}'), signature),
      ).toBe(false);
    });

    it('should reject malformed hexadecimal signatures', () => {
      expect(webhookService.validateSignature('{}', 'a'.repeat(63) + 'z')).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    it('should accept the inclusive five-minute boundary', () => {
      const now = Date.now();

      expect(() =>
        webhookService.validateTimestamp(new Date(now - 5 * 60 * 1000).toISOString(), now),
      ).not.toThrow();
      expect(() =>
        webhookService.validateTimestamp(new Date(now + 5 * 60 * 1000).toISOString(), now),
      ).not.toThrow();
    });

    it('should reject timestamps older than the five-minute window', () => {
      const now = Date.now();

      expect(() =>
        webhookService.validateTimestamp(new Date(now - 5 * 60 * 1000 - 1).toISOString(), now),
      ).toThrow('Webhook timestamp is outside the allowed window');
    });

    it('should reject timestamps too far in the future and malformed timestamps', () => {
      const now = Date.now();

      expect(() =>
        webhookService.validateTimestamp(new Date(now + 5 * 60 * 1000 + 1).toISOString(), now),
      ).toThrow('Webhook timestamp is outside the allowed window');
      expect(() => webhookService.validateTimestamp('not-a-date', now)).toThrow(
        'Webhook timestamp is outside the allowed window',
      );
    });
  });

  describe('processTransactionWebhook', () => {
    it('should update transaction status to confirmed', async () => {
      const txHash = 'a'.repeat(64);
      const mockTx = { id: 'uuid-1', hash: txHash, status: 'pending' };

      const findSpy = spyOn(transactionRepository, 'findByHash').mockResolvedValue(
        mockTx as unknown as Transaction,
      );
      const updateSpy = spyOn(transactionRepository, 'updateStatusIfPending').mockResolvedValue({
        ...mockTx,
        status: 'confirmed',
      } as unknown as Transaction);

      const payload: WebhookPayload = {
        transactionHash: txHash,
        status: 'confirmed',
      };

      await webhookService.processTransactionWebhook(payload);

      expect(findSpy).toHaveBeenCalledWith(txHash);
      expect(updateSpy).toHaveBeenCalledWith('uuid-1', 'confirmed');
    });

    it('should throw NOT_FOUND for unknown transaction', async () => {
      const txHash = 'unknown-hash';
      spyOn(transactionRepository, 'findByHash').mockResolvedValue(undefined);

      const payload: WebhookPayload = {
        transactionHash: txHash,
        status: 'confirmed',
      };

      expect(webhookService.processTransactionWebhook(payload)).rejects.toThrow(
        'Transaction with hash unknown-hash not found',
      );
    });

    it('should reject confirmed to failed without writing and log both statuses', async () => {
      const txHash = 'a'.repeat(64);
      const mockTx = { id: 'uuid-1', hash: txHash, status: 'confirmed' };
      const findSpy = spyOn(transactionRepository, 'findByHash').mockResolvedValue(
        mockTx as unknown as Transaction,
      );
      const updateSpy = spyOn(transactionRepository, 'updateStatusIfPending');
      const warningSpy = spyOn(logger, 'warn').mockImplementation(() => {});

      await expect(
        webhookService.processTransactionWebhook({
          transactionHash: txHash,
          status: 'failed',
        }),
      ).rejects.toThrow('Cannot transition transaction from confirmed to failed');

      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalledWith(
        'Rejected webhook transition for non-pending transaction',
        { transactionId: 'uuid-1', currentStatus: 'confirmed', requestedStatus: 'failed' },
      );
    });

    it('should reject failed to confirmed without writing', async () => {
      const txHash = 'a'.repeat(64);
      const mockTx = { id: 'uuid-1', hash: txHash, status: 'failed' };
      spyOn(transactionRepository, 'findByHash').mockResolvedValue(
        mockTx as unknown as Transaction,
      );
      const updateSpy = spyOn(transactionRepository, 'updateStatusIfPending');

      await expect(
        webhookService.processTransactionWebhook({
          transactionHash: txHash,
          status: 'confirmed',
        }),
      ).rejects.toThrow('Cannot transition transaction from failed to confirmed');

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('should reject a concurrent transition that loses the pending-only update', async () => {
      const txHash = 'a'.repeat(64);
      const pendingTx = { id: 'uuid-1', hash: txHash, status: 'pending' };
      const confirmedTx = { ...pendingTx, status: 'confirmed' };
      spyOn(transactionRepository, 'findByHash')
        .mockResolvedValueOnce(pendingTx as unknown as Transaction)
        .mockResolvedValueOnce(confirmedTx as unknown as Transaction);
      const updateSpy = spyOn(transactionRepository, 'updateStatusIfPending').mockResolvedValue(
        undefined,
      );

      await expect(
        webhookService.processTransactionWebhook({
          transactionHash: txHash,
          status: 'failed',
        }),
      ).rejects.toThrow('Cannot transition transaction from confirmed to failed');

      expect(updateSpy).toHaveBeenCalledWith('uuid-1', 'failed');
    });
  });
});
