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

const liquidatorAuth = new Elysia({ name: 'liquidator-auth' }).onBeforeHandle(
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
  collateralAsset: stellarAddressSchema,
});

const repaySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string'),
});

const createPoolSchema = z.object({
  name: z.string().min(1).max(255),
  asset: z.string().min(1).max(20),
  assetAddress: stellarAddressSchema,
  collateralFactor: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationThreshold: z.string().regex(/^\d+(\.\d+)?$/),
  liquidationPenalty: z.string().regex(/^\d+(\.\d+)?$/),
  reserveFactor: z.coerce.number().int().nonnegative().optional(),
});

export const lendingRoutes = new Elysia({ prefix: '/lending' })
  // PUBLIC ROUTES
  // GET /pools - List pools with pagination and filters
  .use(validate({ query: poolQuerySchema }))
  .get('/pools', async (ctx) => LendingController.getPools(ctx))

  // GET /pools/:id - Get single pool
  .use(validate({ params: poolIdParamSchema }))
  .get('/pools/:id', async (ctx) => LendingController.getPool(ctx))

  // GET /pools/:id/user/:address/deposits - Get user deposits
  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/deposits', async (ctx) => LendingController.getUserDeposits(ctx))

  // GET /pools/:id/user/:address/borrows - Get user borrows
  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/borrows', async (ctx) => LendingController.getUserBorrows(ctx))

  // GET /pools/:id/user/:address/summary - Get user position summary
  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/summary', async (ctx) =>
    LendingController.getUserPositionSummary(ctx),
  )

  // PROTECTED ROUTES
  .use(authPlugin)

  // POST /pools - Create pool (auth required)
  .use(validate({ body: createPoolSchema }))
  .post('/pools', async (ctx) => LendingController.createPool(ctx), { beforeHandle: [rateLimit()] })

  // POST /pools/:id/deposit - Deposit into pool (auth required)
  .use(validate({ body: depositSchema }))
  .post('/pools/:id/deposit', async (ctx) => LendingController.deposit(ctx), {
    beforeHandle: [rateLimit()],
  })

  // POST /pools/:id/withdraw - Withdraw from pool (auth required)
  .use(validate({ body: withdrawSchema }))
  .post('/pools/:id/withdraw', async (ctx) => LendingController.withdraw(ctx), {
    beforeHandle: [rateLimit()],
  })

  // POST /pools/:id/borrow - Borrow from pool (auth required)
  .use(validate({ body: borrowSchema }))
  .post('/pools/:id/borrow', async (ctx) => LendingController.borrow(ctx), {
    beforeHandle: [rateLimit()],
  })

  // POST /pools/:id/repay - Repay loan (auth required)
  .use(validate({ body: repaySchema }))
  .post('/pools/:id/repay', async (ctx) => LendingController.repay(ctx), {
    beforeHandle: [rateLimit()],
  })

  // POST /pools/:id/positions/:borrowerId/liquidate - Execute liquidation (liquidator role required)
  .use(liquidatorAuth)
  .use(validate({ params: liquidationParamsSchema }))
  .post('/pools/:id/positions/:borrowerId/liquidate', async (ctx) =>
    LendingController.liquidate(ctx),
  );
