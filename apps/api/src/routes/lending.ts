import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, paginationQuerySchema, rateLimit } from '../middleware';
import { LendingController } from '../controllers/LendingController';
import { positionService } from '../services/PositionService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';

function requireAuth(headers: Record<string, string | undefined>) {
  const auth = headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return {
      status: 401,
      body: {
        error: 'UNAUTHORIZED',
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    };
  }
}

const poolQuerySchema = paginationQuerySchema.extend({
  asset: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

const poolUserParamsSchema = z.object({
  id: z.string().uuid(),
  address: z.string().refine((v) => positionService.validateAddress(v)),
});

const liquidationParamsSchema = z.object({
  id: z.string().uuid(),
  borrowerId: z.string().uuid(),
});

const depositSchema = z.object({
  amount: z.string(),
});

const withdrawSchema = z.object({
  amount: z.string(),
});

const borrowSchema = z.object({
  borrowAmount: z.string(),
  collateralAmount: z.string(),
  collateralAsset: z.string(),
});

const repaySchema = z.object({
  amount: z.string(),
});

const createPoolSchema = z.object({
  name: z.string(),
  asset: z.string(),
  assetAddress: z.string(),
  collateralFactor: z.string(),
  liquidationThreshold: z.string(),
  liquidationPenalty: z.string(),
  reserveFactor: z.number().optional(),
});

const liquidatorAuth = new Elysia().onBeforeHandle(({ headers, set }) => {
  if (!isLiquidatorAuthorized(headers as Record<string, string | undefined>)) {
    set.status = 403;
    return {
      error: 'FORBIDDEN',
      code: 'FORBIDDEN',
      message: 'Liquidator access required',
    };
  }
});

export const lendingRoutes = new Elysia({ prefix: '/lending', tags: ['Lending'] })

  /**
   * GET /lending/pools
   */
  .use(validate({ query: poolQuerySchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/pools', async (ctx: any) => LendingController.getPools(ctx), {
    query: poolQuerySchema,
    detail: { summary: 'List lending pools' },
  })

  /**
   * POST /lending/pools
   */
  .use(validate({ body: createPoolSchema }))
  .post(
    '/pools',
    async (ctx) => {
      const authError = requireAuth(ctx.headers);
      if (authError) {
        ctx.set.status = 401;
        return authError.body;
      }

      return LendingController.createPool(ctx);
    },
    {
      body: createPoolSchema,
      beforeHandle: rateLimit(),
      detail: { summary: 'Create lending pool' },
    },
  )

  /**
   * GET /lending/pools/:id
   */
  .use(validate({ params: uuidParamSchema }))
  .get('/pools/:id', async (ctx) => LendingController.getPool(ctx), {
    params: uuidParamSchema,
    detail: { summary: 'Get pool by ID' },
  })

  /**
   * Deposit / Withdraw / Borrow / Repay
   */
  .use(validate({ body: depositSchema }))
  .post(
    '/pools/:id/deposit',
    async (ctx) => {
      const authError = requireAuth(ctx.headers);
      if (authError) {
        ctx.set.status = 401;
        return authError.body;
      }
      return LendingController.deposit(ctx);
    },
    {
      body: depositSchema,
      beforeHandle: rateLimit(),
      detail: { summary: 'Deposit into pool' },
    },
  )

  .use(validate({ body: withdrawSchema }))
  .post(
    '/pools/:id/withdraw',
    async (ctx) => {
      const authError = requireAuth(ctx.headers);
      if (authError) {
        ctx.set.status = 401;
        return authError.body;
      }
      return LendingController.withdraw(ctx);
    },
    {
      body: withdrawSchema,
      beforeHandle: rateLimit(),
      detail: { summary: 'Withdraw from pool' },
    },
  )

  .use(validate({ body: borrowSchema }))
  .post(
    '/pools/:id/borrow',
    async (ctx) => {
      const authError = requireAuth(ctx.headers);
      if (authError) {
        ctx.set.status = 401;
        return authError.body;
      }
      return LendingController.borrow(ctx);
    },
    {
      body: borrowSchema,
      beforeHandle: rateLimit(),
      detail: { summary: 'Borrow from pool' },
    },
  )

  .use(validate({ body: repaySchema }))
  .post(
    '/pools/:id/repay',
    async (ctx) => {
      const authError = requireAuth(ctx.headers);
      if (authError) {
        ctx.set.status = 401;
        return authError.body;
      }
      return LendingController.repay(ctx);
    },
    {
      body: repaySchema,
      beforeHandle: rateLimit(),
      detail: { summary: 'Repay loan' },
    },
  )

  /**
   * User positions
   */
  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/deposits', async (ctx) => LendingController.getUserDeposits(ctx))

  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/borrows', async (ctx) => LendingController.getUserBorrows(ctx))

  .use(validate({ params: poolUserParamsSchema }))
  .get('/pools/:id/user/:address/summary', async (ctx) =>
    LendingController.getUserPositionSummary(ctx),
  )

  /**
   * Liquidation
   */
  .use(liquidatorAuth)
  .use(validate({ params: liquidationParamsSchema }))
  .post(
    '/pools/:id/positions/:borrowerId/liquidate',
    async (ctx) => LendingController.liquidate(ctx),
    {
      params: liquidationParamsSchema,
      detail: { summary: 'Execute liquidation' },
    },
  );
