/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * End-to-End Integration Test: Tokenization → Share Purchase → Collateral Lending
 *
 * Covers:
 *  1. Happy path: property tokenized → buyer KYC approved → shares purchased →
 *     deposit made into lending pool → shares used as collateral to borrow
 *  2. Error path: KYC not approved - buyer cannot purchase shares
 *  3. Error path: Insufficient liquidity - borrow amount exceeds pool's available liquidity
 *
 * Pattern: follows PropertyController.buyShares.test.ts conventions:
 *   - describe.skipIf(skipIfNoDatabase) guards all DB-requiring tests
 *   - StellarService methods are stubbed by monkey-patching the singleton
 *   - originals saved/restored in beforeEach/afterEach
 *   - real DB is used with seeded data via repositories
 *   - raw DB state verified with Drizzle queries after controller calls
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { PropertyController } from '../controllers/PropertyController';
import { LendingController } from '../controllers/LendingController';
import { stellarService } from '../services/StellarService';
import { propertyRepository } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { lendingRepository } from '../repositories/LendingRepository';
import { kycRepository } from '../repositories/KYCRepository';
import { db } from '../db';
import {
  properties,
  shareOwnerships,
  transactions,
  borrowPositions,
  depositPositions,
  lendingPools,
} from '../db/schema';
import { users } from '../db/schema/users';
import { eq, and } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const skipIfNoDatabase = !process.env.DATABASE_URL;

/**
 * Unique wallet addresses for this test suite (exactly 56 chars, G-prefix, base32-ish).
 * These must not clash with wallets used in other test files.
 */
const OWNER_ADDRESS = 'GOWNE2ETESTFLOWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 56
const BUYER_ADDRESS_KYC_OK = 'GBUYERKYC2ETESTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 56
const BUYER_ADDRESS_NO_KYC = 'GNOKYCBUYR2ETESTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 56
const DEPOSITOR_ADDRESS = 'GDEPOSI2ETESTFLOWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 56

/**
 * Valid 56-char G… Stellar address used as a stand-in for the collateral asset address.
 * (BorrowDto requires a G… address; the tokenization contract id is a C… address
 * which would fail validation, so we reuse the buyer's wallet address here.)
 */
const COLLATERAL_ASSET_ADDRESS = BUYER_ADDRESS_KYC_OK;

/** Deterministic tx hashes */
const TOKENIZE_TX_HASH = 'a'.repeat(64);
const BUY_SHARES_TX_HASH = 'b'.repeat(64);

/** Mock contract ID (C… Soroban contract format, NOT a G… address) */
const MOCK_CONTRACT_ID = 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const MOCK_ADMIN_PUBLIC_KEY = 'GADMINFLOWE2ETESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const MOCK_ADMIN_SECRET = 'SADMINFLOWE2ETESTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(skipIfNoDatabase)('E2E: tokenization → share purchase → collateral lending', () => {
  // -----------------------------------------------------------------------
  // Shared state created in beforeAll
  // -----------------------------------------------------------------------
  let propertyId: string;
  let sorobanPropertyId: number;
  let ownerId: string;
  let buyerKycOkId: string;
  let buyerNoKycId: string;
  let depositorId: string;
  let poolId: string;

  // StellarService originals (restored after each test)
  let originalListPropertyShares: any;
  let originalPreparePurchaseShares: any;
  let originalVerifyPurchaseTransaction: any;
  let originalGetMintingConfig: any;

  /** Payment token used by the shared purchase stubs (7-decimal USDC units). */
  const PAYMENT_TOKEN_ID = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

  /**
   * Build a minimal auth context compatible with LendingController's
   * resolveAuthenticatedUser() which calls ctx.getAuthenticatedUser().
   */
  function makeAuthCtx(userId: string, walletAddress: string, poolIdParam: string, body: unknown) {
    return {
      getAuthenticatedUser: async () => ({ id: userId, walletAddress }),
      params: { id: poolIdParam },
      body,
      headers: {},
      query: {},
      set: { headers: {} },
    } as any;
  }

  // -----------------------------------------------------------------------
  // One-time setup: seed users, property, and lending pool
  // -----------------------------------------------------------------------
  beforeAll(async () => {
    if (skipIfNoDatabase) return;

    // Users
    const owner = await userRepository.getOrCreateByWallet(OWNER_ADDRESS);
    ownerId = owner.id;

    const buyerOk = await userRepository.getOrCreateByWallet(BUYER_ADDRESS_KYC_OK);
    buyerKycOkId = buyerOk.id;

    const buyerNoKyc = await userRepository.getOrCreateByWallet(BUYER_ADDRESS_NO_KYC);
    buyerNoKycId = buyerNoKyc.id;

    const depositor = await userRepository.getOrCreateByWallet(DEPOSITOR_ADDRESS);
    depositorId = depositor.id;

    // KYC: approve only the "ok" buyer; leave the other as not_started (default)
    await kycRepository.updateUserKycStatus(buyerKycOkId, 'approved');
    // Ensure no-KYC user is explicitly not approved
    await kycRepository.updateUserKycStatus(buyerNoKycId, 'not_started');

    // Property - verified so tokenization can proceed immediately
    const prop = await propertyRepository.create({
      name: 'E2E Test Property',
      description: 'An end-to-end test property with enough description',
      propertyType: 'residential',
      location: { address: '1 Test St', city: 'TestCity', country: 'TC' },
      totalValue: '500000',
      totalShares: 100,
      availableShares: 100,
      pricePerShare: '50.00',
      images: ['https://example.com/img.jpg'],
      verified: true,
      ownerId,
    });
    propertyId = prop.id;

    // Lending pool - will be pre-funded with 2000 USDC for later borrow tests
    const pool = await lendingRepository.create({
      name: 'E2E USDC Pool',
      asset: 'USDC',
      assetAddress: DEPOSITOR_ADDRESS,
      collateralFactor: '0.75',
      liquidationThreshold: '0.80',
      liquidationPenalty: '0.05',
      reserveFactor: 1000,
    });
    poolId = pool.id;

    // Pre-fund the pool so there is available liquidity for borrowing
    await lendingRepository.deposit(poolId, depositorId, '2000', '2000');
  });

  // -----------------------------------------------------------------------
  // Per-test stub setup / teardown for StellarService
  // -----------------------------------------------------------------------
  beforeEach(() => {
    originalListPropertyShares = stellarService.listPropertyShares;
    originalPreparePurchaseShares = stellarService.preparePurchaseShares;
    originalVerifyPurchaseTransaction = stellarService.verifyPurchaseTransaction;
    originalGetMintingConfig = stellarService.getMintingConfig;

    // Default minting config stub (shared by all tests)
    (stellarService as any).getMintingConfig = () => ({
      contractId: MOCK_CONTRACT_ID,
      adminPublicKey: MOCK_ADMIN_PUBLIC_KEY,
      adminSecret: MOCK_ADMIN_SECRET,
    });
  });

  afterEach(() => {
    (stellarService as any).listPropertyShares = originalListPropertyShares;
    (stellarService as any).preparePurchaseShares = originalPreparePurchaseShares;
    (stellarService as any).verifyPurchaseTransaction = originalVerifyPurchaseTransaction;
    (stellarService as any).getMintingConfig = originalGetMintingConfig;
  });

  // -----------------------------------------------------------------------
  // Cleanup: remove seeded data in FK-safe order
  // -----------------------------------------------------------------------
  afterAll(async () => {
    if (skipIfNoDatabase) return;

    // Borrow & deposit positions (FK → pool and user)
    if (poolId) {
      await db.delete(borrowPositions).where(eq(borrowPositions.poolId, poolId));
      await db.delete(depositPositions).where(eq(depositPositions.poolId, poolId));
      await db.delete(lendingPools).where(eq(lendingPools.id, poolId));
    }

    // Share ownerships & transactions (FK → property and users)
    if (propertyId) {
      await db.delete(shareOwnerships).where(eq(shareOwnerships.propertyId, propertyId));
      // Delete transactions referencing buyer or owner
      for (const uid of [buyerKycOkId, buyerNoKycId, ownerId, depositorId]) {
        if (uid) {
          await db.delete(transactions).where(eq(transactions.fromUserId, uid));
          await db.delete(transactions).where(eq(transactions.toUserId, uid));
        }
      }
      await db.delete(properties).where(eq(properties.id, propertyId));
    }

    // Users - must come after all referencing records are removed
    for (const id of [ownerId, buyerKycOkId, buyerNoKycId, depositorId]) {
      if (id) await db.delete(users).where(eq(users.id, id));
    }
  });

  // =======================================================================
  // STEP 1 - Tokenization
  // =======================================================================
  describe('Step 1: Tokenize property', () => {
    it('tokenizes the property and persists contract address + sorobanPropertyId', async () => {
      let capturedListParams: any = {};
      (stellarService as any).listPropertyShares = async (params: any) => {
        capturedListParams = params;
        return { txHash: TOKENIZE_TX_HASH, contractId: MOCK_CONTRACT_ID };
      };

      const result = await PropertyController.tokenizeProperty(propertyId, {}, OWNER_ADDRESS);

      expect(result.txHash).toBe(TOKENIZE_TX_HASH);
      expect(result.contractId).toBe(MOCK_CONTRACT_ID);
      expect(result.tokenAddress).toBe(MOCK_CONTRACT_ID);
      expect(result.totalShares).toBe(100);
      expect(result.owner).toBe(OWNER_ADDRESS);

      // The property is listed for sale on-chain instead of having its supply
      // minted to the owner: price, inventory and payment token are recorded.
      expect(capturedListParams).toMatchObject({
        contractId: MOCK_CONTRACT_ID,
        adminPublicKey: MOCK_ADMIN_PUBLIC_KEY,
        adminSecret: MOCK_ADMIN_SECRET,
        owner: OWNER_ADDRESS,
        sharesForSale: 100,
        paymentToken: PAYMENT_TOKEN_ID,
        // 50.00 at 7 decimals
        pricePerShareUnits: BigInt('500000000'),
      });
      expect(capturedListParams.sorobanPropertyId).toBeGreaterThan(0);

      // Verify DB: property now has tokenAddress and sorobanPropertyId set
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.tokenAddress).toBe(MOCK_CONTRACT_ID);
      expect(prop!.sorobanPropertyId).toBeGreaterThan(0);

      // Capture sorobanPropertyId for later assertions
      sorobanPropertyId = prop!.sorobanPropertyId!;
    });

    it('rejects tokenization of an already-tokenized property', async () => {
      // Property is tokenized from the previous test - should conflict
      await expect(
        PropertyController.tokenizeProperty(propertyId, {}, OWNER_ADDRESS),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    });
  });

  // =======================================================================
  // STEP 2 - Prepare Share Purchase (KYC gating)
  // =======================================================================
  describe('Step 2: Prepare share purchase - KYC not approved', () => {
    it('rejects the purchase when buyer KYC is not approved', async () => {
      // buyerNoKyc has kycStatus = 'not_started'
      let prepareCalled = false;
      (stellarService as any).preparePurchaseShares = async () => {
        prepareCalled = true;
        throw new Error('should not be called - KYC gate should fire first');
      };

      await expect(
        PropertyController.prepareBuyShares(
          propertyId,
          { buyer: BUYER_ADDRESS_NO_KYC, shares: 5 },
          BUYER_ADDRESS_NO_KYC,
        ),
      ).rejects.toThrow('KYC verification must be approved before purchasing shares');

      expect(prepareCalled).toBe(false);

      // DB: no share ownership record created
      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(
            eq(shareOwnerships.propertyId, propertyId),
            eq(shareOwnerships.ownerId, buyerNoKycId),
          ),
        );
      expect(ownership).toBeUndefined();

      // DB: available shares unchanged at 100
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(100);
    });
  });

  // =======================================================================
  // STEP 3 - Buy Shares (buyer-signed, paid, then confirmed on-chain)
  // =======================================================================
  describe('Step 3: Buy shares - KYC approved', () => {
    it('prepares an unsigned purchase transaction for the buyer', async () => {
      let capturedPrepareParams: any = {};
      (stellarService as any).preparePurchaseShares = async (params: any) => {
        capturedPrepareParams = params;
        return { xdr: 'AAAA-UNSIGNED-XDR', contractId: MOCK_CONTRACT_ID };
      };

      const result = await PropertyController.prepareBuyShares(
        propertyId,
        { buyer: BUYER_ADDRESS_KYC_OK, shares: 10 },
        BUYER_ADDRESS_KYC_OK,
      );

      expect(result.xdr).toBe('AAAA-UNSIGNED-XDR');
      expect(result.contractId).toBe(MOCK_CONTRACT_ID);
      expect(result.sorobanPropertyId).toBe(String(sorobanPropertyId));
      expect(result.shares).toBe(10);
      expect(result.paymentToken).toBe(PAYMENT_TOKEN_ID);
      // 10 shares at 50.00, expressed in 7-decimal payment token units
      expect(result.totalAmount).toBe('500.0000000');

      expect(capturedPrepareParams).toMatchObject({
        contractId: MOCK_CONTRACT_ID,
        buyer: BUYER_ADDRESS_KYC_OK,
        sorobanPropertyId,
        shares: 10,
        paymentToken: PAYMENT_TOKEN_ID,
      });

      // Nothing is recorded until the transaction is confirmed on-chain
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(100);
    });

    it('records a verified purchase and updates DB state', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () => ({
        txHash: BUY_SHARES_TX_HASH,
        sourceAccount: BUYER_ADDRESS_KYC_OK,
        contractId: MOCK_CONTRACT_ID,
        functionName: 'purchase_shares',
        call: {
          buyer: BUYER_ADDRESS_KYC_OK,
          propertyId: BigInt(sorobanPropertyId),
          amount: BigInt(10),
          paymentToken: PAYMENT_TOKEN_ID,
        },
        sharePurchase: {
          propertyId: String(sorobanPropertyId),
          buyer: BUYER_ADDRESS_KYC_OK,
          shares: BigInt(10),
          // 10 shares at 50.00 in 7-decimal units
          totalCost: BigInt('5000000000'),
        },
      });

      const result = await PropertyController.confirmBuyShares(
        propertyId,
        { txHash: BUY_SHARES_TX_HASH },
        BUYER_ADDRESS_KYC_OK,
      );

      expect(result.transactionHash).toBe(BUY_SHARES_TX_HASH);
      expect(result.newBalance).toBe(10);

      // DB: available shares decremented
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(90);

      // DB: share ownership record created
      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(
            eq(shareOwnerships.propertyId, propertyId),
            eq(shareOwnerships.ownerId, buyerKycOkId),
          ),
        );
      expect(ownership).toBeDefined();
      expect(ownership!.shares).toBe(10);
      expect(parseFloat(ownership!.purchasePrice)).toBe(500); // 10 × 50.00

      // DB: confirmed transaction record with the real paid amount and asset
      const [tx] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.hash, BUY_SHARES_TX_HASH));
      expect(tx).toBeDefined();
      expect(tx!.status).toBe('confirmed');
      expect(parseFloat(tx!.amount)).toBe(500);
      expect(tx!.asset).toBe(PAYMENT_TOKEN_ID);
    });

    it('does not persist changes when on-chain verification fails', async () => {
      (stellarService as any).verifyPurchaseTransaction = async () => {
        throw new Error('Transaction did not succeed on-chain');
      };

      await expect(
        PropertyController.confirmBuyShares(
          propertyId,
          { txHash: 'c'.repeat(64) },
          BUYER_ADDRESS_KYC_OK,
        ),
      ).rejects.toThrow('Transaction did not succeed on-chain');

      // DB: available shares still 90 - unchanged from the previous test's purchase
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.availableShares).toBe(90);
    });
  });

  // =======================================================================
  // STEP 4 - Collateral Lending (happy path)
  // =======================================================================
  describe('Step 4: Borrow against share collateral - happy path', () => {
    it('creates a borrow position using tokenized shares as collateral', async () => {
      const poolBefore = await lendingRepository.findById(poolId);
      const liquidityBefore = parseFloat(poolBefore!.availableLiquidity);
      expect(liquidityBefore).toBeGreaterThanOrEqual(300);

      // Buyer borrows 300 USDC, pledging their shares as collateral.
      // collateralAsset must be a valid G… Stellar address per BorrowDto schema.
      const response = await LendingController.borrow(
        makeAuthCtx(buyerKycOkId, BUYER_ADDRESS_KYC_OK, poolId, {
          borrowAmount: '300',
          collateralAmount: '500', // 10 shares × 50.00 = 500 (> 300/0.75 = 400 required)
          collateralAsset: COLLATERAL_ASSET_ADDRESS,
        }),
      );

      expect(response.status).toBe(200);
      const position = (await response.json()) as any;
      expect(position.poolId).toBe(poolId);
      expect(position.borrowerId).toBe(buyerKycOkId);
      expect(parseFloat(position.principal)).toBe(300);
      expect(parseFloat(position.collateralAmount)).toBe(500);
      expect(position.collateralAsset).toBe(COLLATERAL_ASSET_ADDRESS);

      // DB: pool liquidity decreased by borrow amount
      const poolAfter = await lendingRepository.findById(poolId);
      expect(parseFloat(poolAfter!.availableLiquidity)).toBeCloseTo(liquidityBefore - 300, 4);
      expect(parseFloat(poolAfter!.totalBorrows)).toBeGreaterThanOrEqual(300);

      // DB: borrow position record exists
      const [dbPosition] = await db
        .select()
        .from(borrowPositions)
        .where(
          and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, buyerKycOkId)),
        );
      expect(dbPosition).toBeDefined();
      expect(parseFloat(dbPosition!.principal)).toBe(300);
    });
  });

  // =======================================================================
  // STEP 5 - Collateral Lending (insufficient liquidity error path)
  // =======================================================================
  describe('Step 5: Borrow - insufficient liquidity in pool', () => {
    /**
     * Helper that calls LendingController.borrow and returns a normalized
     * { status, body } pair regardless of whether the controller throws an
     * ApiError (error path) or returns a Response (happy path).
     */
    async function callBorrow(ctx: any): Promise<{ status: number; body: any }> {
      try {
        const response = await LendingController.borrow(ctx);
        const body = await response.json();
        return { status: response.status, body };
      } catch (err: any) {
        // ApiError thrown by the controller - mirror the error handler output
        if (err?.statusCode) {
          return {
            status: err.statusCode,
            body: { error: err.code, message: err.message, statusCode: err.statusCode },
          };
        }
        throw err;
      }
    }

    it('rejects a borrow request that exceeds the pool available liquidity', async () => {
      const pool = await lendingRepository.findById(poolId);
      const available = parseFloat(pool!.availableLiquidity);

      // Ask for more than the pool has
      const excessiveBorrow = (available + 10_000).toFixed(7);

      const { status, body } = await callBorrow(
        makeAuthCtx(buyerKycOkId, BUYER_ADDRESS_KYC_OK, poolId, {
          borrowAmount: excessiveBorrow,
          collateralAmount: '99999',
          collateralAsset: COLLATERAL_ASSET_ADDRESS,
        }),
      );

      expect(status).toBe(400);
      expect(body.error).toBe('INSUFFICIENT_LIQUIDITY');
    });

    it('rejects a borrow request against a non-existent pool', async () => {
      const fakePoolId = '00000000-0000-0000-0000-000000000000';

      const { status, body } = await callBorrow(
        makeAuthCtx(buyerKycOkId, BUYER_ADDRESS_KYC_OK, fakePoolId, {
          borrowAmount: '100',
          collateralAmount: '200',
          collateralAsset: COLLATERAL_ASSET_ADDRESS,
        }),
      );

      expect(status).toBe(404);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  // =======================================================================
  // Full flow: end-state summary assertion
  // =======================================================================
  describe('Full flow: end-state verification', () => {
    it('reflects the correct state across all entities after the full flow', async () => {
      // Property: tokenized, available shares decremented by purchase
      const prop = await propertyRepository.findById(propertyId);
      expect(prop!.tokenAddress).toBe(MOCK_CONTRACT_ID);
      expect(prop!.availableShares).toBe(90); // started at 100, 10 purchased

      // Buyer: holds 10 shares
      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(
            eq(shareOwnerships.propertyId, propertyId),
            eq(shareOwnerships.ownerId, buyerKycOkId),
          ),
        );
      expect(ownership!.shares).toBe(10);

      // Borrow position: principal is 300
      const [borrow] = await db
        .select()
        .from(borrowPositions)
        .where(
          and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, buyerKycOkId)),
        );
      expect(borrow).toBeDefined();
      expect(parseFloat(borrow!.principal)).toBe(300);

      // Non-KYC user: no share ownership record at all
      const [noKycOwnership] = await db
        .select()
        .from(shareOwnerships)
        .where(
          and(
            eq(shareOwnerships.propertyId, propertyId),
            eq(shareOwnerships.ownerId, buyerNoKycId),
          ),
        );
      expect(noKycOwnership).toBeUndefined();
    });
  });
});
