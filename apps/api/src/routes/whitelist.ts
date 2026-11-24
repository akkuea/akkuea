import { Elysia, t } from 'elysia';
import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';
import { WhitelistController } from '../controllers/WhitelistController';
import { BadRequestError, handleError } from '../utils/errors';
import { validateQuery } from '../middleware/validation';
import { rateLimit, authPlugin } from '../middleware';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';

// A Stellar public key is 56 base32 characters, starts with G, and ends with
// a CRC16 checksum. The pattern rejects malformed values early; the checksum
// check in assertValidWalletAddress rejects look-alikes that only pass the
// character set (and contract addresses, which start with C).
const stellarAddressPattern = '^G[A-Z2-7]{55}$';

function assertValidWalletAddress(walletAddress: string): void {
  if (!StrKey.isValidEd25519PublicKey(walletAddress)) {
    throw new BadRequestError('walletAddress must be a valid Stellar public key');
  }
}

const requestSchema = t.Object({
  walletAddress: t.String({ maxLength: 56, pattern: stellarAddressPattern }),
  fullName: t.String({ maxLength: 255 }),
  idType: t.Union([t.Literal('passport'), t.Literal('national_id'), t.Literal('drivers_license')]),
  idReference: t.String({ maxLength: 255 }),
});

const metricsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  windowDays: z.coerce.number().int().positive().max(365).optional(),
});

function operationsDenied() {
  return {
    success: false as const,
    error: 'FORBIDDEN',
    message: 'Operations access denied',
    timestamp: new Date().toISOString(),
  };
}

const whitelistMetricsRoute = new Elysia().use(validateQuery(metricsQuerySchema)).get(
  '/metrics',
  async ({ headers, validatedQuery, set }) => {
    if (!isInternalOperationsAuthorized(headers as Record<string, string | undefined>)) {
      set.status = 403;
      return operationsDenied();
    }
    try {
      return await WhitelistController.metrics(validatedQuery ?? {});
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'Whitelist and evidence review turnaround metrics (operator)',
      description:
        'Count, mean, median, p95, and SLA-breach stats for whitelist review (database) and evidence review (on-chain). Requires x-internal-api-key.',
      tags: ['Pilot Whitelist'],
      security: [{ internalApiKey: [] }],
    },
  },
);

export const whitelistRoutes = new Elysia({ prefix: '/pilot/whitelist' })
  // authPlugin only derives getAuthenticatedUser(); it does not enforce
  // auth by itself, so applying it here lets /status check for an optional
  // session without requiring one on the otherwise-public endpoints below.
  .use(authPlugin)
  .post(
    '/request',
    async (ctx) => {
      try {
        assertValidWalletAddress(ctx.body.walletAddress);
        return await WhitelistController.request(ctx);
      } catch (error) {
        const errorResponse = handleError(error);
        ctx.set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      beforeHandle: [rateLimit()],
      body: requestSchema,
      detail: {
        summary: 'Submit whitelist request',
        description:
          'Public, unauthenticated KYC intake endpoint. Rate-limited to 10 requests per minute per IP (same default as other public endpoints in this API). This endpoint accepts PII (full name, ID type, ID reference), so abuse protection is critical.',
        tags: ['Pilot Whitelist'],
      },
    },
  )
  // GET /status is intentionally not rate-limited: the status itself is
  // coarse application state (pending/approved/rejected/none) with no PII,
  // and the endpoint is read-only. Rate limiting is not required for the
  // current pilot threat model. The one field that is PII-adjacent,
  // rejectionReason, is only ever included for the wallet's own owner
  // (Bearer session) or an operator (x-internal-api-key); see
  // WhitelistController.status. Revisit if response data expands further or
  // enumeration becomes operationally relevant.
  .get(
    '/status/:walletAddress',
    async (ctx) => {
      try {
        assertValidWalletAddress(ctx.params.walletAddress);
        return await WhitelistController.status(ctx);
      } catch (error) {
        const errorResponse = handleError(error);
        ctx.set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      params: t.Object({
        walletAddress: t.String({ maxLength: 56, pattern: stellarAddressPattern }),
      }),
      detail: {
        summary: 'Get status of whitelist request',
        description:
          'Returns the request status for a wallet. The rejectionReason field is only included when the caller is authenticated as that wallet or is an operator.',
        tags: ['Pilot Whitelist'],
        security: [{ bearerAuth: [] }, { internalApiKey: [] }],
      },
    },
  )
  .use(whitelistMetricsRoute);
