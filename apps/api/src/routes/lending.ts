import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  validate,
  uuidParamSchema,
  paginationQuerySchema,
  rateLimit,
  authPlugin,
} from '../middleware';
import { LendingController } from '../controllers/LendingController';
import { positionService } from '../services/PositionService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

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

// Pool creation is an operator action, authenticated with the same internal
// operations credential as the other operator-only routes.
const operatorAuth = new Elysia({ name: 'lending-operator-auth' }).onBeforeHandle(
  { as: 'scoped' },
  ({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return {
        success: false,
        error: 'FORBIDDEN',
        message: 'Operator access required',
        timestamp: new Date().toISOString(),
      };
    }
  },
);

const amountSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const borrowSchema = z.object({
  borrowAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  collateralAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
  collateralAsset: stellarAddressSchema,
});

const confirmSchema = z.object({
  txHash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'Transaction hash must be a 64-character hex string'),
});

const liquidationPrepareSchema = z.object({
  liquidator: stellarAddressSchema,
  debtToCover: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const createPoolSchema = z.object({
  name: z.string().min(1).max(255),
  asset: z.string().min(1).max(20),
  assetAddress: stellarAddressSchema,
  collateralFactor: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationThreshold: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationPenalty: z.string().regex(/^\d+(\.\d+)?$/),
  closeFactor: z.string().regex(/^\d+(\.\d+)?$/),
  reserveFactor: z.coerce.number().int().nonnegative().optional(),
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

  // POST /pools - Create pool on-chain and cache it (operator only)
  .group('', (app) =>
    app
      .use(operatorAuth)
      .use(validate({ body: createPoolSchema }))
      .post('/pools', async (ctx) => LendingController.createPool(ctx), {
        detail: {
          summary: 'Create a lending pool',
          description:
            'Creates the pool on the defi-rwa contract with the admin signer, then stores it (requires the internal operations key)',
          tags: ['Lending'],
        },
      }),
  )

  // Legacy database-only write routes. They no longer change balances or
  // positions; clients must use the prepare/confirm pairs below.
  .post('/pools/:id/deposit', async () => LendingController.deposit(), {
    detail: {
      summary: 'Deposit into pool (removed)',
      description: 'Deprecated: returns 410 Gone. Use /prepare and /confirm.',
      tags: ['Lending'],
    },
  })
  .post('/pools/:id/withdraw', async () => LendingController.withdraw(), {
    detail: {
      summary: 'Withdraw from pool (removed)',
      description: 'Deprecated: returns 410 Gone. Use /prepare and /confirm.',
      tags: ['Lending'],
    },
  })
  .post('/pools/:id/borrow', async () => LendingController.borrow(), {
    detail: {
      summary: 'Borrow from pool (removed)',
      description: 'Deprecated: returns 410 Gone. Use /prepare and /confirm.',
      tags: ['Lending'],
    },
  })
  .post('/pools/:id/repay', async () => LendingController.repay(), {
    detail: {
      summary: 'Repay loan (removed)',
      description: 'Deprecated: returns 410 Gone. Use /prepare and /confirm.',
      tags: ['Lending'],
    },
  })

  // Deposit
  .group('', (app) =>
    app
      .use(validate({ body: amountSchema }))
      .post('/pools/:id/deposit/prepare', async (ctx) => LendingController.prepareDeposit(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare a deposit',
          description:
            'Returns an unsigned deposit transaction for the authenticated wallet to sign (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )
  .group('', (app) =>
    app
      .use(validate({ body: confirmSchema }))
      .post('/pools/:id/deposit/confirm', async (ctx) => LendingController.confirmDeposit(ctx), {
        detail: {
          summary: 'Confirm a deposit',
          description:
            'Verifies the submitted deposit transaction and caches the on-chain position (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )

  // Withdraw
  .group('', (app) =>
    app
      .use(validate({ body: amountSchema }))
      .post('/pools/:id/withdraw/prepare', async (ctx) => LendingController.prepareWithdraw(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare a withdrawal',
          description:
            'Returns an unsigned withdraw transaction for the authenticated wallet to sign (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )
  .group('', (app) =>
    app
      .use(validate({ body: confirmSchema }))
      .post('/pools/:id/withdraw/confirm', async (ctx) => LendingController.confirmWithdraw(ctx), {
        detail: {
          summary: 'Confirm a withdrawal',
          description:
            'Verifies the submitted withdraw transaction and caches the on-chain position (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )

  // Borrow
  .group('', (app) =>
    app
      .use(validate({ body: borrowSchema }))
      .post('/pools/:id/borrow/prepare', async (ctx) => LendingController.prepareBorrow(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare a borrow',
          description:
            'Returns an unsigned borrow transaction for the authenticated wallet to sign (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )
  .group('', (app) =>
    app
      .use(validate({ body: confirmSchema }))
      .post('/pools/:id/borrow/confirm', async (ctx) => LendingController.confirmBorrow(ctx), {
        detail: {
          summary: 'Confirm a borrow',
          description:
            'Verifies the submitted borrow transaction and caches the on-chain position (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )

  // Repay
  .group('', (app) =>
    app
      .use(validate({ body: amountSchema }))
      .post('/pools/:id/repay/prepare', async (ctx) => LendingController.prepareRepay(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Prepare a repayment',
          description:
            'Returns an unsigned repay transaction for the authenticated wallet to sign (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )
  .group('', (app) =>
    app
      .use(validate({ body: confirmSchema }))
      .post('/pools/:id/repay/confirm', async (ctx) => LendingController.confirmRepay(ctx), {
        detail: {
          summary: 'Confirm a repayment',
          description:
            'Verifies the submitted repay transaction and caches the on-chain position (requires authentication)',
          tags: ['Lending'],
        },
      }),
  )

  // Liquidation: liquidator role required for both steps
  .use(liquidatorAuth)
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema, body: liquidationPrepareSchema }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate/prepare',
        async (ctx) => LendingController.prepareLiquidation(ctx),
        {
          detail: {
            summary: 'Prepare a liquidation',
            description:
              'Returns the unsigned four-argument liquidate transaction for the liquidator to sign (requires liquidator role)',
            tags: ['Lending'],
          },
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema, body: confirmSchema }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate/confirm',
        async (ctx) => LendingController.confirmLiquidation(ctx),
        {
          detail: {
            summary: 'Confirm a liquidation',
            description:
              'Verifies the submitted liquidation and refreshes the borrower position from the contract (requires liquidator role)',
            tags: ['Lending'],
          },
        },
      ),
  );
