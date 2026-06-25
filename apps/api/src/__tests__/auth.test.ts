import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { authRoutes } from '../routes/auth';
import { Keypair } from '@stellar/stellar-sdk';
import { jwt } from '@elysiajs/jwt';
import { spyOn } from 'bun:test';
import { userRepository } from '../repositories/UserRepository';
import { errorHandler } from '../middleware/errorHandler';
import { challengeStore } from '../controllers/AuthController';

describe('Auth Routes Integration Tests', () => {
  const app = new Elysia()
    .use(errorHandler)
    .use(
      jwt({
        name: 'jwt',
        secret: 'test-secret',
      }),
    )
    .use(authRoutes);

  let keypair: Keypair;
  let stellarAddress: string;
  let getOrCreateByWalletSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    keypair = Keypair.random();
    stellarAddress = keypair.publicKey();
    // Clear any leftover challenges between tests
    challengeStore.clear();
    getOrCreateByWalletSpy = spyOn(userRepository, 'getOrCreateByWallet').mockImplementation(
      async (address) =>
        ({
          id: '11111111-1111-1111-1111-111111111111',
          walletAddress: address,
          displayName: 'Mock User',
          createdAt: new Date(),
          updatedAt: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    );
  });

  afterEach(() => {
    getOrCreateByWalletSpy.mockRestore();
  });

  it('POST /auth/challenge should return a nonce', async () => {
    console.log('stellarAddress:', stellarAddress);
    const response = await app.handle(
      new Request('http://localhost/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress }),
      }),
    );

    const data = (await response.json()) as { nonce: string; expiresAt: number };
    if (response.status !== 200) console.log(data);
    expect(response.status).toBe(200);
    expect(data.nonce).toBeDefined();
    expect(typeof data.nonce).toBe('string');
    expect(data.expiresAt).toBeDefined();
  });

  it('POST /auth/session should return JWT for valid signature', async () => {
    // 1. Get challenge
    const challengeRes = await app.handle(
      new Request('http://localhost/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress }),
      }),
    );
    const { nonce } = (await challengeRes.json()) as { nonce: string };

    // 2. Sign challenge
    const signatureBuffer = keypair.sign(Buffer.from(nonce));
    const signature = signatureBuffer.toString('base64');

    // 3. Verify session
    const sessionRes = await app.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, signature }),
      }),
    );

    expect(sessionRes.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionData = (await sessionRes.json()) as { token: string; user: any };
    expect(sessionData.token).toBeDefined();
    expect(sessionData.user.walletAddress).toBe(stellarAddress);
  });

  it('POST /auth/session should reject invalid signature', async () => {
    // 1. Get challenge
    const challengeRes = await app.handle(
      new Request('http://localhost/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress }),
      }),
    );
    const { nonce } = (await challengeRes.json()) as { nonce: string };

    // 2. Sign with a DIFFERENT key
    const badKeypair = Keypair.random();
    const badSignatureBuffer = badKeypair.sign(Buffer.from(nonce));
    const badSignature = badSignatureBuffer.toString('base64');

    // 3. Verify session
    const sessionRes = await app.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, signature: badSignature }),
      }),
    );

    expect(sessionRes.status).toBe(401);
  });

  it('POST /auth/session should reject request without a challenge', async () => {
    const signatureBuffer = keypair.sign(Buffer.from('fake-nonce'));
    const signature = signatureBuffer.toString('base64');

    const sessionRes = await app.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, signature }),
      }),
    );

    expect(sessionRes.status).toBe(401);
  });

  it('POST /auth/session should reject expired nonce', async () => {
    // 1. Get challenge so a nonce is stored
    const challengeRes = await app.handle(
      new Request('http://localhost/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress }),
      }),
    );
    const { nonce } = (await challengeRes.json()) as { nonce: string };

    // 2. Manually expire the stored challenge by setting expiresAt in the past
    challengeStore.set(stellarAddress, { nonce, expiresAt: Date.now() - 1000 });

    // 3. Sign the nonce with the correct key
    const signatureBuffer = keypair.sign(Buffer.from(nonce));
    const signature = signatureBuffer.toString('base64');

    // 4. Attempt to create session - should reject as expired
    const sessionRes = await app.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, signature }),
      }),
    );

    expect(sessionRes.status).toBe(401);
    const body = (await sessionRes.json()) as { error: string };
    expect(body.error).toBe('CHALLENGE_EXPIRED');
  });

  it('POST /auth/session should reject reuse of a consumed nonce', async () => {
    // 1. Get challenge
    const challengeRes = await app.handle(
      new Request('http://localhost/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress }),
      }),
    );
    const { nonce } = (await challengeRes.json()) as { nonce: string };

    // 2. Sign and verify (first use - should succeed)
    const signatureBuffer = keypair.sign(Buffer.from(nonce));
    const signature = signatureBuffer.toString('base64');

    const firstRes = await app.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, signature }),
      }),
    );
    expect(firstRes.status).toBe(200);

    // 3. Attempt to reuse the same nonce - should fail
    const secondRes = await app.handle(
      new Request('http://localhost/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress, signature }),
      }),
    );

    expect(secondRes.status).toBe(401);
    const body = (await secondRes.json()) as { error: string };
    expect(body.error).toBe('CHALLENGE_NOT_FOUND');
  });

  it('POST /auth/challenge should reject invalid Stellar address format', async () => {
    const sessionRes = await app.handle(
      new Request('http://localhost/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stellarAddress: 'INVALID_ADDRESS' }),
      }),
    );

    expect(sessionRes.status).toBe(400);
  });
});
