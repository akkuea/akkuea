import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { webhookRoutes } from '../routes/webhooks';
import { createHmac } from 'crypto';
import { db } from '../db';
import { transactions, users, type Transaction, type User } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { WebhookPayload } from '../services/WebhookService';

import { errorHandler } from '../middleware/errorHandler';

// Skip tests if DATABASE_URL is not set
const skipIfNoDatabase = !process.env.DATABASE_URL;

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret-for-dev';

function generateSignature(payload: WebhookPayload): string {
  const hmac = createHmac('sha256', WEBHOOK_SECRET);
  return hmac.update(JSON.stringify(payload)).digest('hex');
}

describe.skipIf(skipIfNoDatabase)('Webhook Routes Integration Tests', () => {
  let app: unknown;
  let testUser: User;
  let testTx: Transaction;

  beforeAll(async () => {
    app = new Elysia().use(errorHandler).use(webhookRoutes);

    // Create a test user
    const userResults = await db
      .insert(users)
      .values({
        walletAddress: 'G' + 'A'.repeat(55),
        email: 'webhook-test@example.com',
      })
      .returning();
    testUser = userResults[0]!;

    // Create a pending transaction
    const txResults = await db
      .insert(transactions)
      .values({
        type: 'deposit',
        hash: 'a'.repeat(64),
        fromUserId: testUser.id,
        amount: '100.0000000',
        asset: 'native',
        status: 'pending',
      })
      .returning();
    testTx = txResults[0]!;
  });

  afterAll(async () => {
    // Cleanup
    if (testTx) {
      await db.delete(transactions).where(eq(transactions.id, testTx.id));
    }
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  describe('POST /webhooks/transactions', () => {
    it('should update transaction status to confirmed', async () => {
      const payload: WebhookPayload = {
        transactionHash: testTx.hash as string,
        status: 'confirmed',
      };
      const signature = generateSignature(payload);

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
          },
          body: JSON.stringify(payload),
        }),
      );

      expect(response.status).toBe(200);
      const results = await db.select().from(transactions).where(eq(transactions.id, testTx.id));
      const updatedTx = results[0];
      expect(updatedTx).toBeDefined();
      expect(updatedTx?.status).toBe('confirmed');

      // Reset for next tests
      await db
        .update(transactions)
        .set({ status: 'pending' })
        .where(eq(transactions.id, testTx.id));
    });

    it('should return 400 for invalid signature', async () => {
      const payload: WebhookPayload = {
        transactionHash: testTx.hash as string,
        status: 'confirmed',
      };

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': 'invalid-signature',
          },
          body: JSON.stringify(payload),
        }),
      );

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate delivery (already confirmed)', async () => {
      // First confirm it
      await db
        .update(transactions)
        .set({ status: 'confirmed' })
        .where(eq(transactions.id, testTx.id));

      const payload: WebhookPayload = {
        transactionHash: testTx.hash as string,
        status: 'confirmed',
      };
      const signature = generateSignature(payload);

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
          },
          body: JSON.stringify(payload),
        }),
      );

      expect(response.status).toBe(409);
    });

    it('should return 404 for unknown transaction hash', async () => {
      const payload: WebhookPayload = {
        transactionHash: 'b'.repeat(64),
        status: 'confirmed',
      };
      const signature = generateSignature(payload);

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': signature,
          },
          body: JSON.stringify(payload),
        }),
      );

      expect(response.status).toBe(404);
    });
  });
});
