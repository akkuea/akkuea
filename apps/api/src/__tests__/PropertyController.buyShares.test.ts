/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, beforeAll } from 'bun:test';
import { PropertyController } from '../controllers/PropertyController';
import { stellarService } from '../services/StellarService';
import { propertyRepository } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { db } from '../db';
import { properties, shareOwnerships, transactions } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const skipIfNoDatabase = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDatabase)('PropertyController.buyShares', () => {
  const propertyOwnerAddress = 'GOWNERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const buyerAddress = 'GBUYERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const purchaseTxHash = 'd'.repeat(64);
  let propertyId: string;
  let buyerId: string;
  let propertySorobanId: number;

  let originalMintPropertyShares: any;
  let originalGetMintingConfig: any;

  beforeAll(async () => {
    if (skipIfNoDatabase) return;

    // Create users
    const owner = await userRepository.getOrCreateByWallet(propertyOwnerAddress);
    const buyer = await userRepository.getOrCreateByWallet(buyerAddress);
    buyerId = buyer.id;

    // Create property
    const prop = await propertyRepository.create({
      name: 'Test Buy Shares Property',
      description: 'Test description long enough',
      propertyType: 'residential',
      location: { address: '123', city: 'A', country: 'B' },
      totalValue: '100000',
      totalShares: 10,
      availableShares: 10,
      pricePerShare: '100.00',
      images: ['img'],
      verified: true,
      ownerId: owner.id,
    });

    propertySorobanId = await propertyRepository.allocateSorobanPropertyId();

    // Tokenize it so we can buy shares
    await db
      .update(properties)
      .set({
        tokenAddress: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        sorobanPropertyId: propertySorobanId,
      })
      .where(eq(properties.id, prop.id));

    propertyId = prop.id;
  });

  beforeEach(() => {
    originalMintPropertyShares = stellarService.mintPropertyShares;
    originalGetMintingConfig = stellarService.getMintingConfig;
  });

  afterEach(() => {
    (stellarService as any).mintPropertyShares = originalMintPropertyShares;
    (stellarService as any).getMintingConfig = originalGetMintingConfig;
  });

  it('submits a real Soroban transaction and returns the Horizon hash', async () => {
    let mintParams: any = {};

    (stellarService as any).getMintingConfig = () => ({
      contractId: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      adminPublicKey: 'GADMINADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      adminSecret: 'SADMINSECRETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    });

    (stellarService as any).mintPropertyShares = async (params: any) => {
      mintParams = params;
      return {
        txHash: purchaseTxHash,
        contractId: params.contractId,
      };
    };

    const result = await PropertyController.buyShares(
      propertyId,
      {
        buyer: buyerAddress,
        shares: 2,
      },
      buyerAddress,
    );

    expect(result.transactionHash).toBe(purchaseTxHash);
    expect(result.newBalance).toBe(2);

    expect(mintParams).toEqual({
      contractId: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      adminPublicKey: 'GADMINADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      adminSecret: 'SADMINSECRETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      sorobanPropertyId: propertySorobanId,
      recipient: buyerAddress,
      amount: 2,
    });

    // verify DB state
    const prop = await propertyRepository.findById(propertyId);
    expect(prop!.availableShares).toBe(8);

    const [ownership] = await db
      .select()
      .from(shareOwnerships)
      .where(and(eq(shareOwnerships.propertyId, propertyId), eq(shareOwnerships.ownerId, buyerId)));
    expect(ownership).toBeDefined();
    expect(ownership!.shares).toBe(2);

    const [tx] = await db.select().from(transactions).where(eq(transactions.hash, purchaseTxHash));
    expect(tx).toBeDefined();
    expect(tx!.status).toBe('confirmed');
    expect(parseFloat(tx!.amount)).toBe(200); // 2 shares * 100.00
  });

  it('does not persist a pending transaction when Soroban submission fails', async () => {
    (stellarService as any).getMintingConfig = () => ({
      contractId: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      adminPublicKey: 'GADMINADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      adminSecret: 'SADMINSECRETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    });

    (stellarService as any).mintPropertyShares = async () => {
      throw new Error('Soroban submission failed');
    };

    await expect(
      PropertyController.buyShares(propertyId, { buyer: buyerAddress, shares: 2 }, buyerAddress),
    ).rejects.toThrow('Soroban submission failed');

    // Verify DB state unchanged from previous test
    const prop = await propertyRepository.findById(propertyId);
    expect(prop!.availableShares).toBe(8);
  });
});
