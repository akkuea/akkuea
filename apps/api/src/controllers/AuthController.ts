import type { Context } from 'elysia';
import { Keypair } from 'stellar-sdk';
import { ApiError } from '../errors/ApiError';
import { userRepository } from '../repositories/UserRepository';

// In-memory store for challenges (nonce)
// Format: Map<stellarAddress, { nonce: string, expiresAt: number }>
/** @internal Exported for test access only — do not use outside of test suites. */
export const challengeStore = new Map<string, { nonce: string; expiresAt: number }>();

const CHALLENGE_EXPIRATION_MS = 1000 * 60 * 5; // 5 minutes

export class AuthController {
  /**
   * Helper method to create JSON responses
   */
  private static jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Generate a challenge for a given Stellar address
   */
  static async getChallenge(ctx: Context): Promise<Response> {
    const { stellarAddress } = ctx.body as { stellarAddress: string };

    if (!stellarAddress || !/^G[A-Z2-7]{55}$/.test(stellarAddress)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    // Generate a secure random nonce
    const nonce = crypto.randomUUID();
    const expiresAt = Date.now() + CHALLENGE_EXPIRATION_MS;

    challengeStore.set(stellarAddress, { nonce, expiresAt });

    return this.jsonResponse({ nonce, expiresAt });
  }

  /**
   * Verify session signature and issue JWT
   */
  static async verifySession(ctx: Context): Promise<Response> {
    const { stellarAddress, signature } = ctx.body as { stellarAddress: string; signature: string };

    // Using any for the jwt method provided by the @elysiajs/jwt plugin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwt = (ctx as any).jwt;

    if (!stellarAddress || !/^G[A-Z2-7]{55}$/.test(stellarAddress)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    if (!signature) {
      throw new ApiError(400, 'MISSING_SIGNATURE', 'Signature is required');
    }

    const challenge = challengeStore.get(stellarAddress);

    if (!challenge) {
      throw new ApiError(401, 'CHALLENGE_NOT_FOUND', 'No active challenge found for this address');
    }

    if (Date.now() > challenge.expiresAt) {
      challengeStore.delete(stellarAddress);
      throw new ApiError(401, 'CHALLENGE_EXPIRED', 'Challenge has expired');
    }

    try {
      const keypair = Keypair.fromPublicKey(stellarAddress);
      // signature is usually base64 or hex encoded in API requests. Assuming hex or base64.
      // The client signs the nonce (string). We need to verify it.
      // Usually signature is passed as base64 string.
      const isValid = keypair.verify(
        Buffer.from(challenge.nonce),
        Buffer.from(signature, 'base64'),
      );

      if (!isValid) {
        throw new ApiError(401, 'INVALID_SIGNATURE', 'Signature verification failed');
      }
    } catch {
      throw new ApiError(401, 'INVALID_SIGNATURE', 'Failed to parse signature or public key');
    }

    // Valid signature, delete challenge
    challengeStore.delete(stellarAddress);

    // Get or create user
    const user = await userRepository.getOrCreateByWallet(stellarAddress);

    // Issue JWT
    const token = await jwt.sign({
      id: user.id,
      walletAddress: user.walletAddress,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    });

    return this.jsonResponse({
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
      },
    });
  }
}
