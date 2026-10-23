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
const TEST_TRANSACTION_HASH = 'e'.repeat(64);

function generateSignature(payload: string | Uint8Array): string {
  const hmac = createHmac('sha256', WEBHOOK_SECRET);
  return hmac.update(payload).digest('hex');
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
        hash: TEST_TRANSACTION_HASH,
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
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
      };
      const rawBody = JSON.stringify(payload);

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': generateSignature(rawBody),
          },
          body: rawBody,
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

    it('should accept a pretty-printed body signed as sent', async () => {
      const rawBody = JSON.stringify(
        {
          transactionHash: TEST_TRANSACTION_HASH,
          status: 'confirmed',
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
      const response = await postRawBody(rawBody);

      expect(response.status).toBe(200);
      await resetTestTransaction();
    });

    it('should accept alternate JSON key order signed as sent', async () => {
      const rawBody = JSON.stringify({
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        transactionHash: TEST_TRANSACTION_HASH,
      });
      const response = await postRawBody(rawBody);

      expect(response.status).toBe(200);
      await resetTestTransaction();
    });

    it('should accept extra untyped fields signed as sent', async () => {
      const rawBody = JSON.stringify({
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        deliveryMetadata: { attempt: 2 },
      });
      const response = await postRawBody(rawBody);

      expect(response.status).toBe(200);
      await resetTestTransaction();
    });

    it('should return 400 for invalid signature', async () => {
      const payload: WebhookPayload = {
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
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

    it('should reject a signature for a different body preimage', async () => {
      const signedBody = JSON.stringify({
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'failed',
        timestamp: new Date().toISOString(),
      });
      const sentBody = JSON.stringify({
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
      });
      const response = await postRawBody(sentBody, generateSignature(signedBody));

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate delivery (already confirmed)', async () => {
      // First confirm it
      await db
        .update(transactions)
        .set({ status: 'confirmed' })
        .where(eq(transactions.id, testTx.id));

      const payload: WebhookPayload = {
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'confirmed',
        timestamp: new Date().toISOString(),
      };
      const rawBody = JSON.stringify(payload);

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': generateSignature(rawBody),
          },
          body: rawBody,
        }),
      );

      expect(response.status).toBe(409);
    });

    it('should reject transitions between terminal statuses without changing the record', async () => {
      for (const [currentStatus, requestedStatus] of [
        ['confirmed', 'failed'],
        ['failed', 'confirmed'],
      ] as const) {
        await db
          .update(transactions)
          .set({ status: currentStatus })
          .where(eq(transactions.id, testTx.id));

        const rawBody = JSON.stringify({
          transactionHash: TEST_TRANSACTION_HASH,
          status: requestedStatus,
          timestamp: new Date().toISOString(),
        });
        const response = await postRawBody(rawBody);

        expect(response.status).toBe(409);
        const records = await db.select().from(transactions).where(eq(transactions.id, testTx.id));
        expect(records[0]?.status).toBe(currentStatus);
      }

      await resetTestTransaction();
    });

    it('should reject stale timestamped deliveries', async () => {
      const rawBody = JSON.stringify({
        transactionHash: TEST_TRANSACTION_HASH,
        status: 'confirmed',
        timestamp: new Date(Date.now() - 5 * 60 * 1000 - 1).toISOString(),
      });
      const response = await postRawBody(rawBody);

      expect(response.status).toBe(400);
      const records = await db.select().from(transactions).where(eq(transactions.id, testTx.id));
      expect(records[0]?.status).toBe('pending');
    });

    it('should return 404 for unknown transaction hash', async () => {
      const payload: WebhookPayload = {
        transactionHash: 'b'.repeat(64),
        status: 'confirmed',
        timestamp: new Date().toISOString(),
      };
      const rawBody = JSON.stringify(payload);

      const response = await (app as Elysia).handle(
        new Request('http://localhost/webhooks/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': generateSignature(rawBody),
          },
          body: rawBody,
        }),
      );

      expect(response.status).toBe(404);
    });
  });

  async function postRawBody(rawBody: string, signature = generateSignature(rawBody)) {
    return (app as Elysia).handle(
      new Request('http://localhost/webhooks/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
        },
        body: rawBody,
      }),
    );
  }

  async function resetTestTransaction() {
    await db.update(transactions).set({ status: 'pending' }).where(eq(transactions.id, testTx.id));
  }
});
