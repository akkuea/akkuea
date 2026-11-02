/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * End-to-End Integration Test: Tokenization → Share Purchase → Collateral Lending
 *
 * Covers:
 *  1. Happy path: property tokenized → buyer KYC approved → shares purchased →
 *     deposit made into lending pool → shares used as collateral to borrow
 *  2. Error path: KYC not approved - buyer cannot purchase shares
 *  3. Error path: Insufficient liquidity - the contract simulation rejects the borrow
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

/** Collateral token contract (BorrowDto requires a Soroban contract address). */
const COLLATERAL_ASSET_ADDRESS = 'CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX';

/** On-chain pool id of the seeded lending pool. */
const CONTRACT_POOL_ID = 'e2e-usdc-pool';

/** Deterministic tx hashes */
const TOKENIZE_TX_HASH = 'a'.repeat(64);
const BUY_SHARES_TX_HASH = 'b'.repeat(64);
const BORROW_TX_HASH = 'c'.repeat(64);

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
  let originalPrepareLendingCall: any;
  let originalVerifyLendingCall: any;
  let originalReadLendingState: any;
  let originalBuildTypedContractTransaction: any;
  let originalAssertValidAddress: any;
  const originalDefiRwaContractId = process.env.DEFI_RWA_CONTRACT_ID;

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

    // Lending pool mirrored on-chain under CONTRACT_POOL_ID
    process.env.DEFI_RWA_CONTRACT_ID = MOCK_CONTRACT_ID;
    const pool = await lendingRepository.create({
      contractPoolId: CONTRACT_POOL_ID,
      name: 'E2E USDC Pool',
      asset: 'USDC',
      assetAddress: PAYMENT_TOKEN_ID,
      collateralFactor: '0.75',
      liquidationThreshold: '0.80',
      liquidationPenalty: '0.05',
      reserveFactor: 1000,
    });
    poolId = pool.id;

    // Seed the cached state of a pool the depositor funded with 2000 USDC
    await db.insert(depositPositions).values({
      poolId,
      depositorId,
      amount: '2000',
      shares: '2000',
    });
    await db
      .update(lendingPools)
      .set({ totalDeposits: '2000', availableLiquidity: '2000' })
      .where(eq(lendingPools.id, poolId));
  });

  // -----------------------------------------------------------------------
  // Per-test stub setup / teardown for StellarService
  // -----------------------------------------------------------------------
  beforeEach(() => {
    originalListPropertyShares = stellarService.listPropertyShares;
    originalPreparePurchaseShares = stellarService.preparePurchaseShares;
    originalVerifyPurchaseTransaction = stellarService.verifyPurchaseTransaction;
    originalGetMintingConfig = stellarService.getMintingConfig;
    originalPrepareLendingCall = stellarService.prepareLendingCall;
    originalVerifyLendingCall = stellarService.verifyLendingCall;
    originalReadLendingState = stellarService.readLendingState;
    originalBuildTypedContractTransaction = (stellarService as any).buildTypedContractTransaction;
    originalAssertValidAddress = stellarService.assertValidAddress;

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
    (stellarService as any).prepareLendingCall = originalPrepareLendingCall;
    (stellarService as any).verifyLendingCall = originalVerifyLendingCall;
    (stellarService as any).readLendingState = originalReadLendingState;
    (stellarService as any).buildTypedContractTransaction = originalBuildTypedContractTransaction;
    (stellarService as any).assertValidAddress = originalAssertValidAddress;
  });

  // -----------------------------------------------------------------------
  // Cleanup: remove seeded data in FK-safe order
  // -----------------------------------------------------------------------
  afterAll(async () => {
    if (skipIfNoDatabase) return;

    if (originalDefiRwaContractId === undefined) {
      delete process.env.DEFI_RWA_CONTRACT_ID;
    } else {
      process.env.DEFI_RWA_CONTRACT_ID = originalDefiRwaContractId;
    }

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
  // STEP 4 - Collateral Lending (happy path, prepare and confirm)
  // =======================================================================
  describe('Step 4: Borrow against share collateral - happy path', () => {
    it('prepares an unsigned borrow with the buyer wallet as source', async () => {
      let captured: any = null;
      (stellarService as any).prepareLendingCall = async (params: any) => {
        captured = params;
        return { xdr: 'unsigned-borrow-xdr', contractId: params.contractId };
      };

      const response = await LendingController.prepareAction(
        'borrow',
        makeAuthCtx(buyerKycOkId, BUYER_ADDRESS_KYC_OK, poolId, {
          borrowAmount: '300',
          collateralAmount: '500',
          collateralAsset: COLLATERAL_ASSET_ADDRESS,
        }),
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.xdr).toBe('unsigned-borrow-xdr');
      expect(captured).toMatchObject({
        source: BUYER_ADDRESS_KYC_OK,
        functionName: 'borrow',
        args: [
          BUYER_ADDRESS_KYC_OK,
          CONTRACT_POOL_ID,
          BigInt(3_000_000_000),
          COLLATERAL_ASSET_ADDRESS,
          BigInt(5_000_000_000),
        ],
      });
    });

    it('records the borrow position read back from the contract', async () => {
      (stellarService as any).verifyLendingCall = async () => ({
        txHash: BORROW_TX_HASH,
        sourceAccount: BUYER_ADDRESS_KYC_OK,
        contractId: MOCK_CONTRACT_ID,
        functionName: 'borrow',
        actor: BUYER_ADDRESS_KYC_OK,
        poolId: CONTRACT_POOL_ID,
        amount: BigInt(3_000_000_000),
        collateralAsset: COLLATERAL_ASSET_ADDRESS,
        collateralAmount: BigInt(5_000_000_000),
      });
      (stellarService as any).readLendingState = async () => ({
        totalDeposits: BigInt(20_000_000_000),
        totalBorrows: BigInt(3_000_000_000),
        deposit: null,
        borrow: {
          pool_id: CONTRACT_POOL_ID,
          borrower: BUYER_ADDRESS_KYC_OK,
          principal: BigInt(3_000_000_000),
          index_at_borrow: BigInt('1000000000000000000'),
          collateral_amount: BigInt(5_000_000_000),
          collateral_asset: COLLATERAL_ASSET_ADDRESS,
          borrowed_at: BigInt(1_790_000_000),
          healthFactor: BigInt('1333333333333333333'),
        },
      });

      const response = await LendingController.confirmAction(
        'borrow',
        makeAuthCtx(buyerKycOkId, BUYER_ADDRESS_KYC_OK, poolId, { txHash: BORROW_TX_HASH }),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as any;
      expect(result.transactionHash).toBe(BORROW_TX_HASH);
      expect(parseFloat(result.position.principal)).toBe(300);
      expect(result.pool.availableLiquidity).toBe('1700.0000000');

      // DB: pool totals are the contract's
      const poolAfter = await lendingRepository.findById(poolId);
      expect(parseFloat(poolAfter!.totalDeposits)).toBe(2000);
      expect(parseFloat(poolAfter!.totalBorrows)).toBe(300);
      expect(parseFloat(poolAfter!.availableLiquidity)).toBe(1700);

      // DB: one borrow position with the contract's values
      const rows = await db
        .select()
        .from(borrowPositions)
        .where(
          and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, buyerKycOkId)),
        );
      expect(rows).toHaveLength(1);
      expect(parseFloat(rows[0]!.principal)).toBe(300);
      expect(rows[0]!.healthFactor).toBe('1.3333');

      // DB: the confirmed transaction is recorded once, keyed by its hash
      const recorded = await db
        .select()
        .from(transactions)
        .where(eq(transactions.hash, BORROW_TX_HASH));
      expect(recorded).toHaveLength(1);
      expect(recorded[0]!.type).toBe('borrow');
    });
  });

  // =======================================================================
  // STEP 5 - Collateral Lending (failed simulation and unknown pool)
  // =======================================================================
  describe('Step 5: Borrow - rejected before anything is signed', () => {
    async function callPrepareBorrow(ctx: any): Promise<{ status: number; body: any }> {
      try {
        const response = await LendingController.prepareAction('borrow', ctx);
        return { status: response.status, body: await response.json() };
      } catch (err: any) {
        if (err?.statusCode) {
          return { status: err.statusCode, body: { error: err.code, message: err.message } };
        }
        throw err;
      }
    }

    it('returns the contract insufficient-liquidity simulation error as a 400', async () => {
      // The fixture wallets are readable placeholders, not checksummed keys.
      (stellarService as any).assertValidAddress = () => undefined;
      (stellarService as any).buildTypedContractTransaction = async () => ({
        simulation: {
          id: '1',
          latestLedger: 1,
          events: [],
          _parsed: true,
          error: 'HostError: Error(WasmVm, InvalidAction) "Insufficient liquidity"',
        },
        toXDR: () => 'never-returned',
      });

      const { status, body } = await callPrepareBorrow(
        makeAuthCtx(buyerKycOkId, BUYER_ADDRESS_KYC_OK, poolId, {
          borrowAmount: '10000',
          collateralAmount: '99999',
          collateralAsset: COLLATERAL_ASSET_ADDRESS,
        }),
      );

      expect(status).toBe(400);
      expect(body.message).toBe('The pool does not have enough liquidity for this borrow');
    });

    it('rejects a borrow request against a non-existent pool', async () => {
      const fakePoolId = '00000000-0000-0000-0000-000000000000';

      const { status, body } = await callPrepareBorrow(
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
