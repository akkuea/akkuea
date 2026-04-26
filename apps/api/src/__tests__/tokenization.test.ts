import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { propertyRoutes } from '../routes/properties';
import { TokenizationService } from '../services/TokenizationService';
import { logger } from '../services/logger';
import { VALID_UUID as PROPERTY_ID } from '@real-estate-defi/shared';
const OWNER_WALLET = 'GBQ6M5OBU64ATKSRH4OKW2IFQCB5R6Q73F4VMK6KQ37C5G6GQ6FJTYA3';
const ADMIN_WALLET = 'GC3C4X5R7N2X7CII7SPRD4U6ZLKZKAJZDW6N4Q4QAV3FJ7Q3N7GJ5P6L';
const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

describe('TokenizationService', () => {
  beforeEach(() => {
    process.env.REAL_ESTATE_TOKEN_CONTRACT_ID = CONTRACT_ID;
    process.env.STELLAR_ADMIN_PUBLIC_KEY = ADMIN_WALLET;
    process.env.STELLAR_ADMIN_SECRET = 'SBQ6M5OBU64ATKSRH4OKW2IFQCB5R6Q73F4VMK6KQ37C5G6GQ6FJTYA3';
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('tokenizes a verified property and returns tx details', async () => {
    const service = new TokenizationService({
      propertyRepository: {
        findById: mock(async () => ({
          id: PROPERTY_ID,
          ownerId: 'owner-id',
          verified: true,
          tokenAddress: null,
          sorobanPropertyId: null,
          totalShares: 1000,
        })),
        allocateSorobanPropertyId: mock(async () => 42),
        setTokenizationResult: mock(async () => ({
          id: PROPERTY_ID,
          tokenAddress: CONTRACT_ID,
          sorobanPropertyId: 42,
          totalShares: 1000,
        })),
      },
      userRepository: {
        findById: mock(async () => ({
          id: 'owner-id',
          walletAddress: OWNER_WALLET,
        })),
      },
      stellarService: {
        getMintingConfig: mock(() => ({
          contractId: CONTRACT_ID,
          adminPublicKey: ADMIN_WALLET,
          adminSecret: process.env.STELLAR_ADMIN_SECRET!,
        })),
        mintPropertyShares: mock(async () => ({
          txHash: 'a'.repeat(64),
          contractId: CONTRACT_ID,
        })),
      },
    } as never);

    const result = await service.tokenizeProperty(PROPERTY_ID, OWNER_WALLET);

    expect(result).toEqual({
      txHash: 'a'.repeat(64),
      contractId: CONTRACT_ID,
      sorobanPropertyId: '42',
      tokenAddress: CONTRACT_ID,
      totalShares: 1000,
      owner: OWNER_WALLET,
    });
  });

  it('rejects unverified properties', async () => {
    const service = new TokenizationService({
      propertyRepository: {
        findById: mock(async () => ({
          id: PROPERTY_ID,
          ownerId: 'owner-id',
          verified: false,
          tokenAddress: null,
          sorobanPropertyId: null,
          totalShares: 1000,
        })),
      },
      userRepository: {},
      stellarService: {},
    } as never);

    await expect(service.tokenizeProperty(PROPERTY_ID, OWNER_WALLET)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects already tokenized properties', async () => {
    const service = new TokenizationService({
      propertyRepository: {
        findById: mock(async () => ({
          id: PROPERTY_ID,
          ownerId: 'owner-id',
          verified: true,
          tokenAddress: CONTRACT_ID,
          sorobanPropertyId: 42,
          totalShares: 1000,
        })),
      },
      userRepository: {},
      stellarService: {},
    } as never);

    await expect(service.tokenizeProperty(PROPERTY_ID, OWNER_WALLET)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('rejects callers who are neither owner nor admin', async () => {
    const service = new TokenizationService({
      propertyRepository: {
        findById: mock(async () => ({
          id: PROPERTY_ID,
          ownerId: 'owner-id',
          verified: true,
          tokenAddress: null,
          sorobanPropertyId: null,
          totalShares: 1000,
        })),
      },
      userRepository: {
        findById: mock(async () => ({
          id: 'owner-id',
          walletAddress: OWNER_WALLET,
        })),
      },
      stellarService: {
        getMintingConfig: mock(() => ({
          contractId: CONTRACT_ID,
          adminPublicKey: ADMIN_WALLET,
          adminSecret: process.env.STELLAR_ADMIN_SECRET!,
        })),
      },
    } as never);

    await expect(
      service.tokenizeProperty(
        PROPERTY_ID,
        'GD6W3QYRU6A5EIRL2BW3Y5BJN2Q4M2Q2TZADWHLFT6RDB7MWYV34JQ4R',
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('does not persist DB changes when Soroban submission fails', async () => {
    const setTokenizationResult = mock(async () => undefined);
    const service = new TokenizationService({
      propertyRepository: {
        findById: mock(async () => ({
          id: PROPERTY_ID,
          ownerId: 'owner-id',
          verified: true,
          tokenAddress: null,
          sorobanPropertyId: null,
          totalShares: 1000,
        })),
        allocateSorobanPropertyId: mock(async () => 42),
        setTokenizationResult,
      },
      userRepository: {
        findById: mock(async () => ({
          id: 'owner-id',
          walletAddress: OWNER_WALLET,
        })),
      },
      stellarService: {
        getMintingConfig: mock(() => ({
          contractId: CONTRACT_ID,
          adminPublicKey: ADMIN_WALLET,
          adminSecret: process.env.STELLAR_ADMIN_SECRET!,
        })),
        mintPropertyShares: mock(async () => {
          throw new Error('submission failed');
        }),
      },
    } as never);

    await expect(service.tokenizeProperty(PROPERTY_ID, OWNER_WALLET)).rejects.toBeDefined();
    expect(setTokenizationResult).not.toHaveBeenCalled();
  });
});

describe('POST /properties/:id/tokenize', () => {
  it('returns 401 when x-user-address is missing', async () => {
    const app = new Elysia().use(propertyRoutes);

    const response = await app.handle(
      new Request(`http://localhost/properties/${PROPERTY_ID}/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });
});
