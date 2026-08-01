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
  authPlugin,
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
      beforeHandle: [rateLimit()],
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
      beforeHandle: [rateLimit()],
      detail: {
        summary: 'Tokenize a property',
        description: 'Tokenize a property on the Stellar network (requires authentication)',
        tags: ['Properties'],
      },
    },
  );

// POST /properties/:id/buy-shares - buy property shares
const buySharesRoute = new Elysia()
  .use(authPlugin)
  .use(validateParams(uuidParamSchema))
  .use(validateBody(buySharesSchema))
  .post(
    '/:id/buy-shares',
    async ({ validatedParams, validatedBody, set, getAuthenticatedUser }) => {
      try {
        const { walletAddress: userAddress } = await getAuthenticatedUser();
        if (!userAddress) {
          throw new UnauthorizedError('User address is required for authentication');
        }

        return await PropertyController.buyShares(
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
      beforeHandle: [rateLimit()],
      detail: {
        summary: 'Buy property shares',
        description: 'Purchase shares in a tokenized property (requires authentication)',
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
  .use(buySharesRoute)
  .use(getUserSharesRoute);
