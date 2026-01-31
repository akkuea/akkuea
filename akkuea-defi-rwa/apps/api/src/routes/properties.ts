import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  uuidParamSchema,
  paginationQuerySchema,
  ownerParamSchema,
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
const listPropertiesRoute = new Elysia()
  .use(validateQuery(propertyQuerySchema))
  .get('/', async ({ validatedQuery, set }) => {
    try {
      return await PropertyController.getProperties(validatedQuery!);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// GET /properties/:id - get single property
const getPropertyRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .get('/:id', async ({ validatedParams, set }) => {
    try {
      return await PropertyController.getProperty(validatedParams!.id);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// POST /properties - create property
const createPropertyRoute = new Elysia()
  .use(validateBody(createPropertySchema))
  .post('/', async ({ validatedBody, headers, set }) => {
    try {
      const userAddress = headers['x-user-address'] as string | undefined;
      return await PropertyController.createProperty(
        validatedBody!,
        userAddress,
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// PUT /properties/:id - update property
const updatePropertyRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .use(validateBody(updatePropertySchema))
  .put('/:id', async ({ validatedParams, validatedBody, headers, set }) => {
    try {
      const userAddress = headers['x-user-address'] as string;
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
  });

// DELETE /properties/:id - delete property
const deletePropertyRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .delete('/:id', async ({ validatedParams, headers, set }) => {
    try {
      const userAddress = headers['x-user-address'] as string;
      if (!userAddress) {
        throw new UnauthorizedError('User address is required for authentication');
      }
      return await PropertyController.deleteProperty(validatedParams!.id, userAddress);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// POST /properties/:id/tokenize - tokenize property
const tokenizePropertyRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .post('/:id/tokenize', async ({ validatedParams, body, headers, set }) => {
    try {
      const userAddress = headers['x-user-address'] as string | undefined;
      return await PropertyController.tokenizeProperty(validatedParams!.id, body as unknown, userAddress);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// POST /properties/:id/buy-shares - buy property shares
const buySharesRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .use(validateBody(buySharesSchema))
  .post('/:id/buy-shares', async ({ validatedParams, validatedBody, set }) => {
    try {
      return await PropertyController.buyShares(validatedParams!.id, {
        buyer: validatedBody!.buyer,
        shares: validatedBody!.shares
      });
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// GET /properties/:id/shares/:owner - get user shares
const getUserSharesRoute = new Elysia()
  .use(validateParams(ownerParamSchema))
  .get('/:id/shares/:owner', async ({ validatedParams, set }) => {
    try {
      return await PropertyController.getUserShares(validatedParams!.id, validatedParams!.owner);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

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
