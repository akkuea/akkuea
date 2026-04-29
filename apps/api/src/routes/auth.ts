import { Elysia } from 'elysia';
import { z } from 'zod';
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
  signature: z.string().min(1),
});

export const authRoutes = new Elysia({ prefix: '/auth' })
  // POST /auth/challenge - Get a nonce to sign
  .use(validate({ body: challengeSchema }))
  .post('/challenge', async (ctx) => AuthController.getChallenge(ctx), {
    beforeHandle: [rateLimit()],
  })

  // POST /auth/session - Verify signature and issue JWT
  .use(validate({ body: sessionSchema }))
  .post('/session', async (ctx) => AuthController.verifySession(ctx), {
    beforeHandle: [rateLimit()],
  });
