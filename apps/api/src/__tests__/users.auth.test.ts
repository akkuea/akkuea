import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import jsonwebtoken from 'jsonwebtoken';
import { userRoutes } from '../routes/users';
import { userRepository } from '../repositories/UserRepository';
import { errorHandler } from '../middleware/errorHandler';
import type { User } from '../db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

const WALLET_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2T';
const WALLET_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function makeUser(walletAddress: string): User {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    walletAddress,
    email: 'secret-owner-email@example.com',
    displayName: 'Mock User',
    kycStatus: 'pending',
    kycTier: 'none',
    kycDocuments: [],
    kycExpiresAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('POST /users/auth', () => {
  const app = new Elysia()
    .use(errorHandler)
    .use(jwt({ name: 'jwt', secret: JWT_SECRET }))
    .use(userRoutes);

  let findByWalletAddressSpy: ReturnType<typeof spyOn>;
  let getOrCreateByWalletSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    findByWalletAddressSpy = spyOn(userRepository, 'findByWalletAddress');
    getOrCreateByWalletSpy = spyOn(userRepository, 'getOrCreateByWallet');
  });

  afterEach(() => {
    findByWalletAddressSpy.mockRestore();
    getOrCreateByWalletSpy.mockRestore();
  });

  it('never returns email for an existing wallet', async () => {
    findByWalletAddressSpy.mockResolvedValue(makeUser(WALLET_A));

    const response = await app.handle(
      new Request('http://localhost/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-bypass-ratelimit': 'true' },
        body: JSON.stringify({ walletAddress: WALLET_A }),
      }),
    );

    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await response.json()) as any;
    expect(body.walletAddress).toBe(WALLET_A);
    expect(body.email).toBeUndefined();
    expect(getOrCreateByWalletSpy).not.toHaveBeenCalled();
  });

  it('returns 404 and does not create a user for an unknown wallet with no session', async () => {
    findByWalletAddressSpy.mockResolvedValue(undefined);

    const response = await app.handle(
      new Request('http://localhost/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-bypass-ratelimit': 'true' },
        body: JSON.stringify({ walletAddress: WALLET_A }),
      }),
    );

    expect(response.status).toBe(404);
    expect(getOrCreateByWalletSpy).not.toHaveBeenCalled();
  });

  it('returns 404 and does not create a user when the session is for a different wallet', async () => {
    findByWalletAddressSpy.mockResolvedValue(undefined);
    const tokenForOtherWallet = jsonwebtoken.sign(
      { id: 'user-b', walletAddress: WALLET_B },
      JWT_SECRET,
    );

    const response = await app.handle(
      new Request('http://localhost/users/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-ratelimit': 'true',
          Authorization: `Bearer ${tokenForOtherWallet}`,
        },
        body: JSON.stringify({ walletAddress: WALLET_A }),
      }),
    );

    expect(response.status).toBe(404);
    expect(getOrCreateByWalletSpy).not.toHaveBeenCalled();
  });

  it('creates and returns the public profile when the caller has a valid session for that exact wallet', async () => {
    findByWalletAddressSpy.mockResolvedValue(undefined);
    getOrCreateByWalletSpy.mockResolvedValue(makeUser(WALLET_A));
    const tokenForThisWallet = jsonwebtoken.sign(
      { id: 'user-a', walletAddress: WALLET_A },
      JWT_SECRET,
    );

    const response = await app.handle(
      new Request('http://localhost/users/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-ratelimit': 'true',
          Authorization: `Bearer ${tokenForThisWallet}`,
        },
        body: JSON.stringify({ walletAddress: WALLET_A }),
      }),
    );

    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await response.json()) as any;
    expect(body.walletAddress).toBe(WALLET_A);
    expect(body.email).toBeUndefined();
    expect(getOrCreateByWalletSpy).toHaveBeenCalledWith(WALLET_A);
  });
});
