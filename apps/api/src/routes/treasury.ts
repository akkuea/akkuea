import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { validateBody, validateQuery } from '../middleware/validation';
import { treasuryController, type TreasuryMovementBody } from '../controllers/TreasuryController';
import { TREASURY_VENUE_IDS } from '../config/treasury';
import { handleError } from '../utils/errors';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

const venueEnum = z.enum(TREASURY_VENUE_IDS);

const historyQuerySchema = z.object({
  venue: venueEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const movementBodySchema = z.object({
  venue: venueEnum,
  /**
   * Whole units of the venue's underlying asset. Bounded so a fat-fingered
   * operator request is rejected here rather than on chain.
   */
  amount: z.number().positive().max(1_000_000_000),
  slippageBps: z.number().int().min(0).max(1000).optional(),
  requestedBy: z.string().min(1).max(128).optional(),
});

/**
 * Read-only treasury endpoints.
 *
 * Position data is public on the ledger already, so exposing it needs no auth —
 * the point of the treasury track is that anyone can check it.
 */
const publicTreasuryRoutes = new Elysia()
  .get(
    '/',
    async ({ set }) => {
      try {
        const data = await treasuryController.getPortfolio();
        return { success: true, data };
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      detail: {
        summary: 'Get treasury portfolio',
        description:
          'Current treasury position across every configured venue, read live from the vault contracts',
        tags: ['Treasury'],
      },
    },
  )
  .get(
    '/venues/:venue',
    async ({ params, set }) => {
      try {
        const data = await treasuryController.getPosition(params.venue);
        return { success: true, data };
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      params: t.Object({ venue: t.String() }),
      detail: {
        summary: 'Get treasury position for one venue',
        description: 'Live position for a single treasury venue, read from its vault contract',
        tags: ['Treasury'],
      },
    },
  );

const treasuryHistoryRoute = new Elysia().use(validateQuery(historyQuerySchema)).get(
  '/history',
  async ({ validatedQuery, set }) => {
    try {
      const data = await treasuryController.getHistory({
        venue: validatedQuery!.venue,
        limit: validatedQuery!.limit,
        offset: validatedQuery!.offset,
      });
      return { success: true, data };
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'Get treasury history',
      description: 'Recorded treasury movements (including failed attempts) and position snapshots',
      tags: ['Treasury'],
    },
  },
);

/**
 * Admin guard for treasury movements, using the same internal API key as the
 * other privileged defi-rwa operations.
 */
const treasuryAdminAuth = new Elysia({ name: 'treasury-admin-auth' }).onBeforeHandle(
  ({ headers, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return {
        success: false,
        error: 'FORBIDDEN',
        message: 'Treasury operations access denied',
        timestamp: new Date().toISOString(),
      };
    }
  },
);

function movementRoute(
  path: '/deposit' | '/withdraw',
  operation: 'deposit' | 'withdraw',
  summary: string,
  description: string,
) {
  return new Elysia()
    .use(treasuryAdminAuth)
    .use(validateBody(movementBodySchema))
    .post(
      path,
      async ({ validatedBody, set }) => {
        try {
          const body = validatedBody! as TreasuryMovementBody;
          const data =
            operation === 'deposit'
              ? await treasuryController.deposit(body, 'internal-operations')
              : await treasuryController.withdraw(body, 'internal-operations');
          return { success: true, data };
        } catch (error) {
          const errorResponse = handleError(error);
          set.status = errorResponse.statusCode;
          return errorResponse;
        }
      },
      { detail: { summary, description, tags: ['Treasury'] } },
    );
}

export const treasuryRoutes = new Elysia({ prefix: '/api/v1/treasury' })
  .use(publicTreasuryRoutes)
  .use(treasuryHistoryRoute)
  .use(
    movementRoute(
      '/deposit',
      'deposit',
      'Deposit into a treasury venue',
      'Admin-only. Deposits platform fee balance into the venue vault and records the movement.',
    ),
  )
  .use(
    movementRoute(
      '/withdraw',
      'withdraw',
      'Withdraw from a treasury venue',
      'Admin-only. Burns vault shares to return the requested amount to the treasury account.',
    ),
  );
