import { Keypair } from '@stellar/stellar-sdk';
import { ApiError } from '../errors/ApiError';
import { userRepository } from '../repositories/UserRepository';

// In-memory store for challenges (nonce)
// Format: Map<stellarAddress, { nonce: string, expiresAt: number }>
/** @internal Exported for test access only - do not use outside of test suites. */
export const challengeStore = new Map<string, { nonce: string; expiresAt: number }>();

const CHALLENGE_EXPIRATION_MS = 1000 * 60 * 5; // 5 minutes

// A Stellar Ed25519 signature is 64 raw bytes; standard base64 (with
// padding) encodes that as exactly 88 characters.
const MAX_SIGNATURE_LENGTH = 88;

// Caps the number of outstanding (unconsumed) challenges so an attacker
// requesting challenges for many addresses without ever completing
// /auth/session cannot grow this in-memory map without bound.
const MAX_OUTSTANDING_CHALLENGES = 10_000;

const CHALLENGE_SWEEP_INTERVAL_MS = 1000 * 60; // 1 minute

/**
 * Remove expired challenges from the store. Called opportunistically before
 * issuing a new challenge, and on a periodic timer so abandoned challenges
 * (a caller that never calls /auth/session) are reclaimed even when no new
 * challenge is requested.
 * @internal Exported for test access only - do not use outside of test suites.
 */
export function sweepExpiredChallenges(now: number = Date.now()): number {
  let removed = 0;
  for (const [address, challenge] of challengeStore) {
    if (challenge.expiresAt <= now) {
      challengeStore.delete(address);
      removed++;
    }
  }
  return removed;
}

// `unref()` keeps this timer from holding the process open (relevant for
// test runners and short-lived scripts); Bun and Node both support it.
const challengeSweepTimer = setInterval(
  () => sweepExpiredChallenges(),
  CHALLENGE_SWEEP_INTERVAL_MS,
);
if (typeof challengeSweepTimer.unref === 'function') {
  challengeSweepTimer.unref();
}

/**
 * Minimal shape of the jwt property added to context by @elysiajs/jwt.
 * Only the members actually used by AuthController are declared.
 */
type JwtPlugin = {
  sign: (payload: Record<string, string | number>) => Promise<string>;
  verify: (token: string) => Promise<false | Record<string, unknown>>;
};

/** Minimal context shape consumed by getChallenge. */
type ChallengeContext = {
  body: unknown;
};

/** Minimal context shape consumed by verifySession. */
type SessionContext = {
  body: unknown;
  jwt: JwtPlugin;
};

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
  static async getChallenge(ctx: ChallengeContext): Promise<Response> {
    const { stellarAddress } = ctx.body as { stellarAddress: string };

    if (!stellarAddress || !/^G[A-Z2-7]{55}$/.test(stellarAddress)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    sweepExpiredChallenges();

    if (!challengeStore.has(stellarAddress) && challengeStore.size >= MAX_OUTSTANDING_CHALLENGES) {
      throw new ApiError(
        429,
        'TOO_MANY_CHALLENGES',
        'Too many outstanding authentication challenges, try again later',
      );
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
  static async verifySession(ctx: SessionContext): Promise<Response> {
    const { stellarAddress, signature } = ctx.body as { stellarAddress: string; signature: string };

    const jwt = ctx.jwt;

    if (!stellarAddress || !/^G[A-Z2-7]{55}$/.test(stellarAddress)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    if (!signature) {
      throw new ApiError(400, 'MISSING_SIGNATURE', 'Signature is required');
    }

    // Enforced here (not just in routes/auth.ts's sessionSchema) because the
    // `validate()` plugin does not reliably apply a second route's schema
    // within the same Elysia instance (separate, out-of-scope bug - see
    // routes/notifications.ts for the same issue). A base64-encoded 64-byte
    // Ed25519 signature is at most 88 characters.
    if (signature.length > MAX_SIGNATURE_LENGTH) {
      throw new ApiError(400, 'INVALID_SIGNATURE', 'Signature exceeds maximum length');
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
