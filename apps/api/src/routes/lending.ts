import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  validate,
  uuidParamSchema,
  paginationQuerySchema,
  rateLimit,
  walletKeyGenerator,
  authPlugin,
} from '../middleware';
import { LendingController } from '../controllers/LendingController';
import { positionService } from '../services/PositionService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import {
  CreatePoolDto,
  DepositDto,
  WithdrawDto,
  BorrowDto,
  RepayDto,
  ConfirmLendingDto,
  PrepareLiquidationDto,
  ConfirmLiquidationDto,
} from '../dto/lending.dto';

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

// Pool creation calls the contract with the admin key, so it is an operator
// action. Registered inside the create-pool group only.
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

/** Body of the 410 the retired database-only write routes return. */
function retiredWriteRoute(action: string) {
  return {
    success: false,
    error: 'GONE',
    message: `POST /lending/pools/:id/${action} no longer changes balances. Use POST /lending/pools/:id/${action}/prepare, sign and submit the transaction, then POST /lending/pools/:id/${action}/confirm with its hash.`,
    timestamp: new Date().toISOString(),
  };
}

function prepareDetail(action: string) {
  return {
    summary: `Prepare a ${action}`,
    description: `Returns a simulated, unsigned defi-rwa ${action} transaction with the authenticated wallet as source (requires authentication)`,
    tags: ['Lending'],
  };
}

function confirmDetail(action: string) {
  return {
    summary: `Confirm a ${action}`,
    description: `Verifies a submitted ${action} transaction on Soroban RPC and records the position and pool totals read back from the contract (requires authentication)`,
    tags: ['Lending'],
  };
}

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

  // POST /pools - Create pool on-chain and record it (operator only)
  .group('', (app) =>
    app
      .use(operatorAuth)
      .use(validate({ body: CreatePoolDto }))
      .post('/pools', async (ctx) => LendingController.createPool(ctx), {
        beforeHandle: [rateLimit()],
        detail: {
          summary: 'Create a lending pool',
          description:
            'Create a lending pool on the defi-rwa contract with the admin key, then record it with its contract pool id (requires the internal operations key)',
          tags: ['Lending'],
        },
      }),
  )

  // POST /pools/:id/{deposit,withdraw,borrow,repay} - retired. These used to
  // change balances in Postgres without any on-chain transaction; they now
  // answer 410 and point at the prepare/confirm routes below.
  .post('/pools/:id/deposit', ({ set }) => {
    set.status = 410;
    return retiredWriteRoute('deposit');
  })
  .post('/pools/:id/withdraw', ({ set }) => {
    set.status = 410;
    return retiredWriteRoute('withdraw');
  })
  .post('/pools/:id/borrow', ({ set }) => {
    set.status = 410;
    return retiredWriteRoute('borrow');
  })
  .post('/pools/:id/repay', ({ set }) => {
    set.status = 410;
    return retiredWriteRoute('repay');
  })

  // POST /pools/:id/deposit/prepare and /confirm
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: DepositDto }))
      .post(
        '/pools/:id/deposit/prepare',
        async (ctx) => LendingController.prepareAction('deposit', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: prepareDetail('deposit'),
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: ConfirmLendingDto }))
      .post(
        '/pools/:id/deposit/confirm',
        async (ctx) => LendingController.confirmAction('deposit', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: confirmDetail('deposit'),
        },
      ),
  )

  // POST /pools/:id/withdraw/prepare and /confirm
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: WithdrawDto }))
      .post(
        '/pools/:id/withdraw/prepare',
        async (ctx) => LendingController.prepareAction('withdraw', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: prepareDetail('withdraw'),
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: ConfirmLendingDto }))
      .post(
        '/pools/:id/withdraw/confirm',
        async (ctx) => LendingController.confirmAction('withdraw', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: confirmDetail('withdraw'),
        },
      ),
  )

  // POST /pools/:id/borrow/prepare and /confirm
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: BorrowDto }))
      .post(
        '/pools/:id/borrow/prepare',
        async (ctx) => LendingController.prepareAction('borrow', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: prepareDetail('borrow'),
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: ConfirmLendingDto }))
      .post(
        '/pools/:id/borrow/confirm',
        async (ctx) => LendingController.confirmAction('borrow', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: confirmDetail('borrow'),
        },
      ),
  )

  // POST /pools/:id/repay/prepare and /confirm
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: RepayDto }))
      .post(
        '/pools/:id/repay/prepare',
        async (ctx) => LendingController.prepareAction('repay', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: prepareDetail('repay'),
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: poolIdParamSchema, body: ConfirmLendingDto }))
      .post(
        '/pools/:id/repay/confirm',
        async (ctx) => LendingController.confirmAction('repay', ctx),
        {
          beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
          detail: confirmDetail('repay'),
        },
      ),
  )

  // POST /pools/:id/positions/:borrowerId/liquidate/{prepare,confirm} (liquidator role required)
  .use(liquidatorAuth)
  .post('/pools/:id/positions/:borrowerId/liquidate', ({ set }) => {
    set.status = 410;
    return retiredWriteRoute('positions/:borrowerId/liquidate');
  })
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema, body: PrepareLiquidationDto }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate/prepare',
        async (ctx) => LendingController.prepareLiquidation(ctx),
        {
          detail: {
            summary: 'Prepare a liquidation',
            description:
              'Returns an unsigned liquidate(liquidator, pool, borrower, debt_to_cover) transaction for the liquidator to sign (requires liquidator role)',
            tags: ['Lending'],
          },
        },
      ),
  )
  .group('', (app) =>
    app
      .use(validate({ params: liquidationParamsSchema, body: ConfirmLiquidationDto }))
      .post(
        '/pools/:id/positions/:borrowerId/liquidate/confirm',
        async (ctx) => LendingController.confirmLiquidation(ctx),
        {
          detail: {
            summary: 'Confirm a liquidation',
            description:
              'Verifies a liquidator-signed liquidate transaction on-chain and refreshes the position from the contract (requires liquidator role)',
            tags: ['Lending'],
          },
        },
      ),
  );
