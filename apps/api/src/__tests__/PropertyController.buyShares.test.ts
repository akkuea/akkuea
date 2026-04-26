/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { PropertyController } from '../controllers/PropertyController';
import { stellarService } from '../services/StellarService';
import { db } from '../db';
import { propertyRepository } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';

const PROPERTY_ID = '11111111-1111-1111-1111-111111111111';
const BUYER_ADDRESS = 'GBUYERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const OWNER_ADDRESS = 'GOWNERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const CONTRACT_ID = 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const ADMIN_PUBLIC_KEY = 'GADMINADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const ADMIN_SECRET = 'SADMINSECRETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

let originalMintPropertyShares: any;
let originalGetMintingConfig: any;
let originalDbTransaction: any;
let originalPropertyFindById: any;
let originalGetOrCreateByWallet: any;
let originalUserFindById: any;

beforeEach(() => {
  originalMintPropertyShares = stellarService.mintPropertyShares;
  originalGetMintingConfig = stellarService.getMintingConfig;
  originalDbTransaction = db.transaction;
  originalPropertyFindById = propertyRepository.findById;
  originalGetOrCreateByWallet = userRepository.getOrCreateByWallet;
  originalUserFindById = userRepository.findById;
});

afterEach(() => {
  (stellarService as any).mintPropertyShares = originalMintPropertyShares;
  (stellarService as any).getMintingConfig = originalGetMintingConfig;
  (db as any).transaction = originalDbTransaction;
  (propertyRepository as any).findById = originalPropertyFindById;
  (userRepository as any).getOrCreateByWallet = originalGetOrCreateByWallet;
  (userRepository as any).findById = originalUserFindById;
});

describe('PropertyController.buyShares', () => {
  it('submits a real Soroban transaction and returns the Horizon hash', async () => {
    let mintParams: any = {};

    (stellarService as any).getMintingConfig = () => ({
      contractId: CONTRACT_ID,
      adminPublicKey: ADMIN_PUBLIC_KEY,
      adminSecret: ADMIN_SECRET,
    });

    (stellarService as any).mintPropertyShares = async (params: any) => {
      mintParams = params;
      return {
        txHash: 'a'.repeat(64),
        contractId: params.contractId,
      };
    };

    let capturedInsert: any = {};

    (db as any).transaction = async (fn: any) => {
      const mockTx = {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
        update: () => ({
          set: () => ({
            where: () => ({ returning: async () => [{ availableShares: 8 }] }),
          }),
        }),
        insert: () => ({
          values: async (vals: any) => {
            capturedInsert = vals;
            return [{ shares: 2 }];
          },
        }),
      };
      return fn(mockTx);
    };

    (propertyRepository as any).findById = async () => ({
      id: PROPERTY_ID,
      ownerId: OWNER_ADDRESS,
      availableShares: 10,
      pricePerShare: '100.00',
      tokenAddress: CONTRACT_ID,
      sorobanPropertyId: 1,
    } as any);

    (userRepository as any).getOrCreateByWallet = async (walletAddress: string) => ({
      id: 'buyer-id',
      walletAddress,
    } as any);

    (userRepository as any).findById = async () => ({
      id: 'owner-id',
      walletAddress: OWNER_ADDRESS,
    } as any);

    const result = await PropertyController.buyShares(PROPERTY_ID, {
      buyer: BUYER_ADDRESS,
      shares: 2,
    }, BUYER_ADDRESS);

    expect(result.transactionHash).toBe('a'.repeat(64));
    expect(result.newBalance).toBe(2);
    expect(mintParams).toEqual({
      contractId: CONTRACT_ID,
      adminPublicKey: ADMIN_PUBLIC_KEY,
      adminSecret: ADMIN_SECRET,
      sorobanPropertyId: 1,
      recipient: BUYER_ADDRESS,
      amount: 2,
    });
    expect(capturedInsert.hash).toBe('a'.repeat(64));
    expect(capturedInsert.status).toBe('confirmed');
  });

  it('does not persist a pending transaction when Soroban submission fails', async () => {
    (stellarService as any).getMintingConfig = () => ({
      contractId: CONTRACT_ID,
      adminPublicKey: ADMIN_PUBLIC_KEY,
      adminSecret: ADMIN_SECRET,
    });

    (stellarService as any).mintPropertyShares = async () => {
      throw new Error('Soroban submission failed');
    };

    let dbTransactionCalled = false;
    (db as any).transaction = async () => {
      dbTransactionCalled = true;
      return { newBalance: 0 };
    };

    (propertyRepository as any).findById = async () => ({
      id: PROPERTY_ID,
      ownerId: OWNER_ADDRESS,
      availableShares: 10,
      pricePerShare: '100.00',
      tokenAddress: CONTRACT_ID,
      sorobanPropertyId: 1,
    } as any);

    (userRepository as any).getOrCreateByWallet = async () => ({
      id: 'buyer-id',
      walletAddress: BUYER_ADDRESS,
    } as any);

    (userRepository as any).findById = async () => ({
      id: 'owner-id',
      walletAddress: OWNER_ADDRESS,
    } as any);

    await expect(
      PropertyController.buyShares(PROPERTY_ID, { buyer: BUYER_ADDRESS, shares: 2 }, BUYER_ADDRESS),
    ).rejects.toThrow('Soroban submission failed');
    expect(dbTransactionCalled).toBe(false);
  });
});
