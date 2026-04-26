import { describe, expect, it, spyOn, beforeEach } from 'bun:test';
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
  });

  describe('processTransactionWebhook', () => {
    it('should update transaction status to confirmed', async () => {
      const txHash = 'a'.repeat(64);
      const mockTx = { id: 'uuid-1', hash: txHash, status: 'pending' };

      const findSpy = spyOn(transactionRepository, 'findByHash').mockResolvedValue(
        mockTx as unknown as Transaction,
      );
      const updateSpy = spyOn(transactionRepository, 'updateStatus').mockResolvedValue({
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

    it('should throw CONFLICT for duplicate status update', async () => {
      const txHash = 'a'.repeat(64);
      const mockTx = { id: 'uuid-1', hash: txHash, status: 'confirmed' };

      spyOn(transactionRepository, 'findByHash').mockResolvedValue(
        mockTx as unknown as Transaction,
      );

      const payload: WebhookPayload = {
        transactionHash: txHash,
        status: 'confirmed',
      };

      expect(webhookService.processTransactionWebhook(payload)).rejects.toThrow(
        'Transaction status is already confirmed',
      );
    });
  });
});
