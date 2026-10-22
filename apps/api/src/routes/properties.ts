import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  uuidParamSchema,
  paginationQuerySchema,
  ownerParamSchema,
  rateLimit,
  walletKeyGenerator,
  authPlugin,
  idempotency,
} from '../middleware';
import { PropertyController } from '../controllers/PropertyController';
import { handleError, UnauthorizedError } from '../utils/errors';

// Property query schema extending pagination
const propertyQuerySchema = paginationQuerySchema.extend({
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'land', 'mixed']).optional(),
  country: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  verified: z.coerce.boolean().optional(),
  owner: z.string().length(56).optional(),
});

// Create property body schema
const createPropertySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(10),
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'land', 'mixed']),
  location: z.object({
    address: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().optional(),
  }),
  totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  totalShares: z.number().int().positive(),
  pricePerShare: z.string().regex(/^\d+(\.\d{1,2})?$/),
  images: z.array(z.string().url()).min(1),
});

// Update property body schema
const updatePropertySchema = createPropertySchema.partial();

// Buy shares body schema
const buySharesSchema = z.object({
  buyer: z.string().min(1, 'Buyer address is required'),
  shares: z.number().int().positive(),
});

// Confirm share purchase body schema
const confirmBuySharesSchema = z.object({
  txHash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'Transaction hash must be a 64-character hex string'),
});

// GET /properties - list with filters
const listPropertiesRoute = new Elysia().use(validateQuery(propertyQuerySchema)).get(
  '/',
  async ({ validatedQuery, set }) => {
    try {
      return await PropertyController.getProperties(validatedQuery!);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'List properties',
      description: 'Retrieve a paginated list of properties with optional filters',
      tags: ['Properties'],
    },
  },
);

// GET /properties/:id - get single property
const getPropertyRoute = new Elysia().use(validateParams(uuidParamSchema)).get(
  '/:id',
  async ({ validatedParams, set }) => {
    try {
      return await PropertyController.getProperty(validatedParams!.id);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'Get property by ID',
      description: 'Retrieve a single property by its UUID',
      tags: ['Properties'],
    },
  },
);

// POST /properties - create property
const createPropertyRoute = new Elysia()
  .use(authPlugin)
  .use(validateBody(createPropertySchema))
  .post(
    '/',
    async ({ validatedBody, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        if (!userAddress) {
          throw new UnauthorizedError('User address is required for authentication');
        }
        return await PropertyController.createProperty(validatedBody!, userAddress);
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
      detail: {
        summary: 'Create a property',
        description: 'Create a new real estate property listing (requires authentication)',
        tags: ['Properties'],
      },
    },
  );

// PUT /properties/:id - update property
const updatePropertyRoute = new Elysia()
  .use(authPlugin)
  .use(validateParams(uuidParamSchema))
  .use(validateBody(updatePropertySchema))
  .put(
    '/:id',
    async ({ validatedParams, validatedBody, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        if (!userAddress) {
          throw new UnauthorizedError('User address is required for authentication');
        }
        return await PropertyController.updateProperty(
          validatedParams!.id,
          validatedBody!,
          userAddress,
        );
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      detail: {
        summary: 'Update a property',
        description: 'Update an existing property listing (requires authentication)',
        tags: ['Properties'],
      },
    },
  );

// DELETE /properties/:id - delete property
const deletePropertyRoute = new Elysia()
  .use(authPlugin)
  .use(validateParams(uuidParamSchema))
  .delete(
    '/:id',
    async ({ validatedParams, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        if (!userAddress) {
          throw new UnauthorizedError('User address is required for authentication');
        }
        return await PropertyController.deleteProperty(validatedParams!.id, userAddress);
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      detail: {
        summary: 'Delete a property',
        description: 'Delete a property listing (requires authentication and ownership)',
        tags: ['Properties'],
      },
    },
  );

// POST /properties/:id/tokenize - tokenize property
const tokenizePropertyRoute = new Elysia()
  .use(authPlugin)
  .use(validateParams(uuidParamSchema))
  .post(
    '/:id/tokenize',
    async ({ validatedParams, body, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        return await PropertyController.tokenizeProperty(
          validatedParams!.id,
          body as unknown,
          userAddress,
        );
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
      detail: {
        summary: 'Tokenize a property',
        description: 'Tokenize a property on the Stellar network (requires authentication)',
        tags: ['Properties'],
      },
    },
  );

// POST /properties/:id/buy-shares/prepare - unsigned purchase for the buyer to sign
const prepareBuySharesRoute = new Elysia()
  .use(authPlugin)
  .use(idempotency)
  .use(validateParams(uuidParamSchema))
  .use(validateBody(buySharesSchema))
  .post(
    '/:id/buy-shares/prepare',
    async ({ validatedParams, validatedBody, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        if (!userAddress) {
          throw new UnauthorizedError('User address is required for authentication');
        }

        return await PropertyController.prepareBuyShares(
          validatedParams!.id,
          {
            buyer: validatedBody!.buyer,
            shares: validatedBody!.shares,
          },
          userAddress,
        );
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
      detail: {
        summary: 'Prepare a share purchase',
        description:
          'Returns an unsigned purchase_shares transaction for the buyer to sign and submit themselves (requires authentication)',
        tags: ['Properties'],
      },
    },
  );

// POST /properties/:id/buy-shares/confirm - verify a submitted purchase and record it
const confirmBuySharesRoute = new Elysia()
  .use(authPlugin)
  .use(validateParams(uuidParamSchema))
  .use(validateBody(confirmBuySharesSchema))
  .post(
    '/:id/buy-shares/confirm',
    async ({ validatedParams, validatedBody, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        if (!userAddress) {
          throw new UnauthorizedError('User address is required for authentication');
        }

        return await PropertyController.confirmBuyShares(
          validatedParams!.id,
          { txHash: validatedBody!.txHash },
          userAddress,
        );
      } catch (error) {
        const errorResponse = handleError(error);
        set.status = errorResponse.statusCode;
        return errorResponse;
      }
    },
    {
      beforeHandle: [rateLimit({ keyGenerator: walletKeyGenerator })],
      detail: {
        summary: 'Confirm a share purchase',
        description:
          'Verifies a buyer-signed purchase_shares transaction on-chain and records it (requires authentication)',
        tags: ['Properties'],
      },
    },
  );

// GET /properties/:id/shares/:owner - get user shares
const getUserSharesRoute = new Elysia().use(validateParams(ownerParamSchema)).get(
  '/:id/shares/:owner',
  async ({ validatedParams, set }) => {
    try {
      return await PropertyController.getUserShares(validatedParams!.id, validatedParams!.owner);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  },
  {
    detail: {
      summary: 'Get user shares',
      description: 'Retrieve the number of shares owned by a user for a specific property',
      tags: ['Properties'],
    },
  },
);

// Combine all routes
export const propertyRoutes = new Elysia({ prefix: '/properties' })
  .use(listPropertiesRoute)
  .use(getPropertyRoute)
  .use(createPropertyRoute)
  .use(updatePropertyRoute)
  .use(deletePropertyRoute)
  .use(tokenizePropertyRoute)
  .use(prepareBuySharesRoute)
  .use(confirmBuySharesRoute)
  .use(getUserSharesRoute);
