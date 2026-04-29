import { Elysia, type Context } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, rateLimit, authPlugin } from '../middleware';
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

export const userRoutes = new Elysia({ prefix: '/users', tags: ['Users'] })

  /**
   * POST /users
   */
  .use(validate({ body: createUserSchema }))
  .post('/', async (ctx) => UserController.create(ctx), {
    body: createUserSchema,
    detail: {
      summary: 'Create user',
      description: 'Create a new user with wallet address',
    },
  })

  /**
   * GET /users/me
   */
  .get('/me', async (ctx) => UserController.getProfile(ctx), {
    detail: {
      summary: 'Get current user profile',
    },
  })

  /**
   * PATCH /users/me
   */
  .use(validate({ body: updateUserSchema }))
  .patch('/me', async (ctx) => UserController.updateProfile(ctx), {
    body: updateUserSchema,
    detail: {
      summary: 'Update current user profile',
    },
  })

  /**
   * GET /users/:id
   */
  .use(validate({ params: uuidParamSchema }))
  .get('/:id', async (ctx) => UserController.getById(ctx), {
    params: uuidParamSchema,
    detail: {
      summary: 'Get user by ID',
    },
  })

  /**
   * GET /users/wallet/:address
   */
  .use(validate({ params: walletParamSchema }))
  .get('/wallet/:address', async (ctx) => UserController.getByWallet(ctx), {
    params: walletParamSchema,
    detail: {
      summary: 'Get user by wallet address',
    },
  })

  /**
   * POST /users/auth
   */
  .use(validate({ body: authWalletSchema }))
  .post('/auth', async (ctx) => UserController.authenticateByWallet(ctx), {
    body: authWalletSchema,
    detail: {
      summary: 'Authenticate or create user by wallet',
    },
    beforeHandle: [rateLimit()],
  })

  // Protected Routes
  .use(authPlugin)
  // GET /users/me - Get current user profile
  .get('/me', async (ctx: Context) => UserController.getProfile(ctx))

  // PATCH /users/me - Update current user profile
  .use(validate({ body: updateUserSchema }))
  .patch('/me', async (ctx) => UserController.updateProfile(ctx));
