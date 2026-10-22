import { Elysia } from 'elysia';
import { z } from 'zod';
import { jwt } from '@elysiajs/jwt';
import { validate, rateLimit } from '../middleware';
import { AuthController } from '../controllers/AuthController';

const challengeSchema = z.object({
  stellarAddress: z
    .string()
    .length(56)
    .regex(/^G[A-Z2-7]{55}$/),
});

const sessionSchema = z.object({
  stellarAddress: z
    .string()
    .length(56)
    .regex(/^G[A-Z2-7]{55}$/),
  // A Stellar Ed25519 signature is 64 raw bytes; standard base64 (with
  // padding) encodes that as exactly 88 characters.
  signature: z.string().min(1).max(88),
});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwt({ name: 'jwt', secret: JWT_SECRET }))
  // POST /auth/challenge - Get a nonce to sign
  .group('', (app) =>
    app
      .use(validate({ body: challengeSchema }))
      .post('/challenge', async (ctx) => AuthController.getChallenge(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Get authentication challenge',
          description: 'Request a nonce to sign for Stellar wallet authentication',
          tags: ['Auth'],
        },
      }),
  )

  // POST /auth/session - Verify signature and issue JWT
  .group('', (app) =>
    app
      .use(validate({ body: sessionSchema }))
      .post('/session', async (ctx) => AuthController.verifySession(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Create a session',
          description: 'Verify a signed challenge and issue a JWT session token',
          tags: ['Auth'],
        },
      }),
  );
