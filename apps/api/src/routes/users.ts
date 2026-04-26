import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, rateLimit } from '../middleware';
import { UserController } from '../controllers/UserController';

const walletParamSchema = z.object({
  address: z.string().length(56),
});

const createUserSchema = z.object({
  walletAddress: z
    .string()
    .length(56)
    .regex(/^G[A-Z2-7]{55}$/),
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

const authWalletSchema = z.object({
  walletAddress: z
    .string()
    .length(56)
    .regex(/^G[A-Z2-7]{55}$/),
});

export const userRoutes = new Elysia({ prefix: '/users' })
  // POST /users - Create user
  .use(validate({ body: createUserSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/', async (ctx: any) => UserController.create(ctx))

  // GET /users/me - Get current user profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/me', async (ctx: any) => UserController.getProfile(ctx))

  // PATCH /users/me - Update current user profile
  .use(validate({ body: updateUserSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .patch('/me', async (ctx: any) => UserController.updateProfile(ctx))

  // GET /users/:id - Get user by ID
  .use(validate({ params: uuidParamSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/:id', async (ctx: any) => UserController.getById(ctx))

  // GET /users/wallet/:address - Get user by wallet address
  .use(validate({ params: walletParamSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/wallet/:address', async (ctx: any) => UserController.getByWallet(ctx))

  // POST /users/auth - Authenticate by wallet (get or create)
  .use(validate({ body: authWalletSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/auth', async (ctx: any) => UserController.authenticateByWallet(ctx), {
    beforeHandle: [rateLimit()],
  });
