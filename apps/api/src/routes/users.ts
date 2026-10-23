import { Elysia } from 'elysia';
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

// Each route registers its own `validate()` inside a group, so the scoped
// hook can only ever see the route written next to it. A plugin added with
// `.use()` at instance level would stay in scope for every later sibling and
// let the first schema reject the following routes.
export const userRoutes = new Elysia({ prefix: '/users' })
  // authPlugin only derives getAuthenticatedUser(); it does not enforce
  // auth by itself, so applying it here lets /users/auth check for an
  // optional session without requiring one.
  .use(authPlugin)
  // POST /users - Create user
  .group('', (app) =>
    app
      .use(validate({ body: createUserSchema }))
      .post('/', async (ctx) => UserController.create(ctx), {
        detail: {
          summary: 'Create a user',
          description: 'Create a new user account with a Stellar wallet address',
          tags: ['Users'],
        },
      }),
  )

  // GET /users/:id - Get user by ID
  .group('', (app) =>
    app
      .use(validate({ params: uuidParamSchema }))
      .get('/:id', async (ctx) => UserController.getById(ctx), {
        detail: {
          summary: 'Get user by ID',
          description: 'Retrieve a user by their UUID',
          tags: ['Users'],
        },
      }),
  )

  // GET /users/wallet/:address - Get user by wallet address
  .group('', (app) =>
    app
      .use(validate({ params: walletParamSchema }))
      .get('/wallet/:address', async (ctx) => UserController.getByWallet(ctx), {
        detail: {
          summary: 'Get user by wallet address',
          description: 'Retrieve a user by their Stellar wallet address',
          tags: ['Users'],
        },
      }),
  )

  // POST /users/auth - Look up a user by wallet, or create one if the
  // caller holds a valid session (Bearer JWT from /auth/session) for that
  // exact wallet. Returns the same public projection as GET /users/:id.
  .group('', (app) =>
    app
      .use(validate({ body: authWalletSchema }))
      .post('/auth', async (ctx) => UserController.authenticateByWallet(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Authenticate by wallet',
          description:
            'Returns the public profile for an existing wallet. For a wallet with no account yet, creates one only if the caller has a valid session for that exact wallet.',
          tags: ['Users'],
        },
      }),
  )

  // Protected Routes
  // GET /users/me - Get current user profile
  .get('/me', async (ctx) => UserController.getProfile(ctx), {
    detail: {
      summary: 'Get current user profile',
      description: 'Retrieve the authenticated user profile',
      tags: ['Users'],
    },
  })

  // PATCH /me - Update current user profile
  .group('', (app) =>
    app
      .use(validate({ body: updateUserSchema }))
      .patch('/me', async (ctx) => UserController.updateProfile(ctx), {
        detail: {
          summary: 'Update current user profile',
          description: 'Update the authenticated user profile information',
          tags: ['Users'],
        },
      }),
  );
