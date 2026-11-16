import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  validate,
  uuidParamSchema,
  paginationQuerySchema,
  rateLimit,
  walletKeyGenerator,
  authPlugin,
  idempotency,
} from '../middleware';
import { LendingController } from '../controllers/LendingController';
import { sorobanAssetAddressSchema } from '../dto/lending.dto';
import { positionService } from '../services/PositionService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';

const poolQuerySchema = paginationQuerySchema.extend({
  asset: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const poolIdParamSchema = uuidParamSchema;

const stellarAddressSchema = z
  .string()
  .refine(
    (value: string) => positionService.validateAddress(value),
    'Invalid Stellar address format',
  );

const poolUserParamsSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  address: stellarAddressSchema,
});

const liquidationParamsSchema = z.object({
  id: z.string().uuid('Invalid pool UUID format'),
  borrowerId: z.string().uuid('Invalid borrower UUID format'),
});

// `as: 'scoped'` is required: a default-scope (`'local'`) hook only applies
// to routes defined directly on this instance, not to the routes of whoever
// calls `.use(liquidatorAuth)` (here, lendingRoutes' liquidate group below),
// so without it the liquidate endpoint runs with no authentication at all.
const liquidatorAuth = new Elysia({ name: 'liquidator-auth' }).onBeforeHandle(
  { as: 'scoped' },
  ({ headers, set }) => {
    if (!isLiquidatorAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return {
        success: false,
        error: 'FORBIDDEN',
        message: 'Liquidator access required',
        timestamp: new Date().toISOString(),
      };
    }
  },
);

const depositSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const withdrawSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const borrowSchema = z.object({
  borrowAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  collateralAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  collateralAsset: sorobanAssetAddressSchema,
});

const repaySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const createPoolSchema = z.object({
  contractPoolId: z.string().trim().min(1).max(128).optional(),
  name: z.string().min(1).max(255),
  asset: z.string().min(1).max(20),
  assetAddress: sorobanAssetAddressSchema,
  collateralFactor: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationThreshold: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationPenalty: z.string().regex(/^\d+(\.\d+)?$/),
  closeFactor: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  reserveFactor: z.coerce.number().int().min(0).max(10000).optional(),
});

// Every route below registers its own `validate()` inside a group, so the
// scoped hook only covers the route written next to it. Using `.use()` at
// instance level would keep the first schema in scope for every later route
// and reject valid requests.
export const lendingRoutes = new Elysia({ prefix: '/lending' })
  // PUBLIC ROUTES
  // GET /pools - List pools with pagination and filters
  .group('', (app) =>
    app
      .use(validate({ query: poolQuerySchema }))
      .get('/pools', async (ctx) => LendingController.getPools(ctx), {
        detail: {
          summary: 'List lending pools',
          description: 'Retrieve lending pools with pagination and optional filters',
          tags: ['Lending'],
        },
      }),
  )

  // GET /pools/:id - Get single pool
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .get('/pools/:id', async (ctx) => LendingController.getPool(ctx), {
        detail: {
          summary: 'Get lending pool',
          description: 'Retrieve a single lending pool by its UUID',
          tags: ['Lending'],
        },
      }),
  )

  // GET /pools/:id/user/:address/deposits - Get user deposits
  .group('', (app) =>
    app
      .use(validate({ params: poolUserParamsSchema }))
      .get(
        '/pools/:id/user/:address/deposits',
        async (ctx) => LendingController.getUserDeposits(ctx),
        {
          detail: {
            summary: 'Get user deposits',
            description: 'Retrieve all deposits for a user in a specific lending pool',
            tags: ['Lending'],
          },
        },
      ),
  )

  // GET /pools/:id/user/:address/borrows - Get user borrows
  .group('', (app) =>
    app
      .use(validate({ params: poolUserParamsSchema }))
      .get(
        '/pools/:id/user/:address/borrows',
        async (ctx) => LendingController.getUserBorrows(ctx),
        {
          detail: {
            summary: 'Get user borrows',
            description: 'Retrieve all borrows for a user in a specific lending pool',
            tags: ['Lending'],
          },
        },
      ),
  )

  // GET /pools/:id/user/:address/summary - Get user position summary
  .group('', (app) =>
    app
      .use(validate({ params: poolUserParamsSchema }))
      .get(
        '/pools/:id/user/:address/summary',
        async (ctx) => LendingController.getUserPositionSummary(ctx),
        {
          detail: {
            summary: 'Get user position summary',
            description: 'Retrieve a summary of a user position in a specific lending pool',
            tags: ['Lending'],
          },
        },
      ),
  )

  // PROTECTED ROUTES
  .use(authPlugin)

  // POST /pools - Create pool on-chain (operator authorization required)
  .group('', (app) =>
    app
      .use(validate({ body: createPoolSchema }))
      .post('/pools', async (ctx) => LendingController.createPool(ctx), {
        beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
        detail: {
          summary: 'Create a lending pool',
          description:
            'Create a new lending pool on defi-rwa and store contract_pool_id (requires operator authorization)',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/deposit/prepare - Build unsigned deposit XDR
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/deposit/prepare', async (ctx) => LendingController.prepareDeposit(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare deposit transaction',
          description: 'Simulate and return an unsigned defi-rwa deposit XDR',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/deposit/confirm - Verify confirmed deposit tx and cache chain state
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/deposit/confirm', async (ctx) => LendingController.confirmDeposit(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Confirm deposit transaction',
          description: 'Verify a confirmed defi-rwa deposit transaction and refresh chain state',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/withdraw/prepare - Build unsigned withdraw XDR
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/withdraw/prepare', async (ctx) => LendingController.prepareWithdraw(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare withdraw transaction',
          description: 'Simulate and return an unsigned defi-rwa withdraw XDR',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/withdraw/confirm - Verify confirmed withdraw tx and cache chain state
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/withdraw/confirm', async (ctx) => LendingController.confirmWithdraw(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Confirm withdraw transaction',
          description: 'Verify a confirmed defi-rwa withdraw transaction and refresh chain state',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/borrow/prepare - Build unsigned borrow XDR
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/borrow/prepare', async (ctx) => LendingController.prepareBorrow(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare borrow transaction',
          description: 'Simulate and return an unsigned defi-rwa borrow XDR',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/borrow/confirm - Verify confirmed borrow tx and cache chain state
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/borrow/confirm', async (ctx) => LendingController.confirmBorrow(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Confirm borrow transaction',
          description: 'Verify a confirmed defi-rwa borrow transaction and refresh chain state',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/repay/prepare - Build unsigned repay XDR
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/repay/prepare', async (ctx) => LendingController.prepareRepay(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare repay transaction',
          description: 'Simulate and return an unsigned defi-rwa repay XDR',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/repay/confirm - Verify confirmed repay tx and cache chain state
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema }))
      .post('/pools/:id/repay/confirm', async (ctx) => LendingController.confirmRepay(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Confirm repay transaction',
          description: 'Verify a confirmed defi-rwa repay transaction and refresh chain state',
          tags: ['Lending'],
        },
      }),
  )

  // RETIRED DIRECT WRITE ROUTES (410 Gone pointing to /prepare and /confirm)
  .group('', (app) =>
    app
      .use(validate({ body: depositSchema }))
      .post('/pools/:id/deposit', async (ctx) => LendingController.deposit(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Retired direct deposit route',
          description:
            'Retired. Returns 410 Gone pointing to /deposit/prepare and /deposit/confirm',
          tags: ['Lending'],
        },
      }),
  )

  .group('', (app) =>
    app
      .use(validate({ body: withdrawSchema }))
      .post('/pools/:id/withdraw', async (ctx) => LendingController.withdraw(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Retired direct withdraw route',
          description:
            'Retired. Returns 410 Gone pointing to /withdraw/prepare and /withdraw/confirm',
          tags: ['Lending'],
        },
      }),
  )

  .use(idempotency)
  .group('', (app) =>
    app
      .use(validate({ body: borrowSchema }))
      .post('/pools/:id/borrow', async (ctx) => LendingController.borrow(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Retired direct borrow route',
          description: 'Retired. Returns 410 Gone pointing to /borrow/prepare and /borrow/confirm',
          tags: ['Lending'],
        },
      }),
  )

  .use(idempotency)
  .group('', (app) =>
    app
      .use(validate({ body: repaySchema }))
      .post('/pools/:id/repay', async (ctx) => LendingController.repay(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Retired direct repay route',
          description: 'Retired. Returns 410 Gone pointing to /repay/prepare and /repay/confirm',
          tags: ['Lending'],
        },
      }),
  )

  // LIQUIDATOR ROUTES (liquidator role required)
  .use(liquidatorAuth)
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate/prepare',
        async (ctx) => LendingController.prepareLiquidate(ctx),
        {
          detail: {
            summary: 'Prepare liquidation transaction',
            description:
              'Build and simulate an unsigned defi-rwa liquidate call (requires liquidator role)',
            tags: ['Lending'],
          },
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate/confirm',
        async (ctx) => LendingController.confirmLiquidate(ctx),
        {
          detail: {
            summary: 'Confirm liquidation transaction',
            description:
              'Verify a confirmed defi-rwa liquidate transaction and refresh position from chain',
            tags: ['Lending'],
          },
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate',
        async (ctx) => LendingController.liquidate(ctx),
        {
          detail: {
            summary: 'Retired direct liquidate route',
            description:
              'Retired. Returns 410 Gone pointing to /liquidate/prepare and /liquidate/confirm',
            tags: ['Lending'],
          },
        },
      ),
  );
