/**
 * Integration tests for WhitelistService.approveRequest against the real
 * pilot-whitelist contract deployed on Stellar testnet. Nothing here is
 * mocked for the happy path: every assertion is about what the deployed
 * contract and the real database actually agree on after a genuine
 * admin-signed approval transaction.
 *
 * The failure-path test exercises the same WhitelistService code but
 * forces the chain submission to fail deterministically (invalid admin
 * secret), proving that the database status is never flipped to
 * "approved" when the on-chain approval does not succeed.
 *
 * These are opt-in because they need:
 *   - A running PostgreSQL instance (DATABASE_URL)
 *   - Outbound network access to Stellar testnet (for the happy path)
 *   - The admin secret that matches the deployed pilot-whitelist contract
 *
 *   RUN_WHITELIST_INTEGRATION_TESTS=1 bun test src/tests/whitelist.integration.test.ts
 */
import { describe, test, expect, afterAll, beforeEach } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { PilotWhitelistClient, type PilotWhitelistClientInterface } from '@akkuea/shared';
import { WhitelistService } from '../services/WhitelistService';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { eq } from 'drizzle-orm';

const RUN = process.env.RUN_WHITELIST_INTEGRATION_TESTS === '1';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const RPC_URL = process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_TIMEOUT_MS = 60_000;

const SKIP_DB = !process.env.DATABASE_URL;

const describeIntegration = RUN && !SKIP_DB ? describe : describe.skip;

// Track inserted rows for cleanup
const insertedIds: string[] = [];

function randomWallet(): string {
  return Keypair.random().publicKey();
}

function makeClient(contractId: string, publicKey?: string): PilotWhitelistClientInterface {
  return new PilotWhitelistClient({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
  }) as unknown as PilotWhitelistClientInterface;
}

beforeEach(() => {
  insertedIds.length = 0;
});

afterAll(async () => {
  // Clean up any test rows that were inserted
  for (const id of insertedIds) {
    try {
      await db.delete(pilotWhitelistRequests).where(eq(pilotWhitelistRequests.id, id));
    } catch {
      // Ignore cleanup errors
    }
  }
  // Do NOT call closeDatabaseConnection() here. It tears down the shared
  // postgres pool, killing the DB connection for every other test file that
  // runs after this one in the same bun test process.
});

describeIntegration('whitelist integration: approveRequest against real contract (testnet)', () => {
  test(
    'after successful approval, database status and on-chain is_approved() agree',
    async () => {
      const walletAddress = randomWallet();
      const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY!;
      const contractId = process.env.WHITELIST_CONTRACT_ID!;

      if (!contractId) {
        console.log('Skipping: WHITELIST_CONTRACT_ID not set');
        return;
      }

      // 1. Insert a pending whitelist request
      const [inserted] = await db
        .insert(pilotWhitelistRequests)
        .values({
          walletAddress,
          fullName: 'Integration Test User',
          idType: 'passport',
          idReference: `INT-TEST-${Date.now()}`,
          status: 'pending',
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to insert test whitelist request');
      }

      insertedIds.push(inserted.id);

      // 2. Approve via WhitelistService (real DB + real chain)
      const service = new WhitelistService();
      const txHash = await service.approveRequest(inserted.id);

      expect(txHash).toBeTruthy();
      expect(typeof txHash).toBe('string');

      // 3. Verify database status is 'approved'
      const [row] = await db
        .select()
        .from(pilotWhitelistRequests)
        .where(eq(pilotWhitelistRequests.id, inserted.id))
        .limit(1);

      expect(row).toBeDefined();
      expect(row!.status).toBe('approved');
      expect(row!.reviewedAt).not.toBeNull();

      // 4. Verify on-chain is_approved() returns true
      const client = makeClient(contractId, adminPublicKey);
      const isApprovedTx = await client.is_approved({ address: walletAddress });
      const simulated = await isApprovedTx.simulate();
      const isApproved = simulated.result;

      expect(isApproved).toBe(true);
    },
    NETWORK_TIMEOUT_MS,
  );

  test(
    'when on-chain submission fails, database status remains pending',
    async () => {
      const walletAddress = randomWallet();
      const contractId = process.env.WHITELIST_CONTRACT_ID;

      if (!contractId) {
        console.log('Skipping: WHITELIST_CONTRACT_ID not set');
        return;
      }

      // 1. Insert a pending whitelist request
      const [inserted] = await db
        .insert(pilotWhitelistRequests)
        .values({
          walletAddress,
          fullName: 'Failure Path Test User',
          idType: 'national_id',
          idReference: `FAIL-TEST-${Date.now()}`,
          status: 'pending',
        })
        .returning();

      if (!inserted) {
        throw new Error('Failed to insert test whitelist request');
      }

      insertedIds.push(inserted.id);

      // 2. Override admin credentials to force failure
      const originalSecret = process.env.STELLAR_ADMIN_SECRET;
      const originalPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
      process.env.STELLAR_ADMIN_SECRET =
        'SINVALIDSECRET000000000000000000000000000000000000000000000';
      process.env.STELLAR_ADMIN_PUBLIC_KEY = randomWallet();

      try {
        // 3. Attempt approval - should throw
        const service = new WhitelistService();
        await expect(service.approveRequest(inserted.id)).rejects.toThrow();
      } finally {
        // Restore env vars
        if (originalSecret !== undefined) {
          process.env.STELLAR_ADMIN_SECRET = originalSecret;
        } else {
          delete process.env.STELLAR_ADMIN_SECRET;
        }
        if (originalPublicKey !== undefined) {
          process.env.STELLAR_ADMIN_PUBLIC_KEY = originalPublicKey;
        } else {
          delete process.env.STELLAR_ADMIN_PUBLIC_KEY;
        }
      }

      // 4. Verify database status is still 'pending' (not flipped to 'approved')
      const [row] = await db
        .select()
        .from(pilotWhitelistRequests)
        .where(eq(pilotWhitelistRequests.id, inserted.id))
        .limit(1);

      expect(row).toBeDefined();
      expect(row!.status).toBe('pending');
      expect(row!.reviewedAt).toBeNull();
    },
    NETWORK_TIMEOUT_MS,
  );
});

if (!RUN || SKIP_DB) {
  describe('whitelist integration tests', () => {
    test('are skipped without RUN_WHITELIST_INTEGRATION_TESTS=1 and DATABASE_URL', () => {
      expect(RUN && !SKIP_DB).toBe(false);
    });
  });
}
