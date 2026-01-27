import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, paginationQuerySchema } from '../middleware';
import { PropertyController } from '../controllers/PropertyController';
import { handleError, BadRequestError, UnauthorizedError } from '../utils/errors';

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
  shares: z.number().int().positive(),
});

export const propertyRoutes = new Elysia({ prefix: '/properties' })
  // GET /properties - list with filters
  .get('/', async ({ validatedQuery, set }: any) => {
    try {
      return await PropertyController.getProperties(validatedQuery);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ query: propertyQuerySchema }))

  // GET /properties/:id - get single property
  .get('/:id', async ({ validatedParams, set }: any) => {
    try {
      return await PropertyController.getProperty(validatedParams.id);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ params: uuidParamSchema }))

  // POST /properties - create property
  .post('/', async ({ validatedBody, headers, set }: any) => {
    try {
      const userAddress = headers['x-user-address'] as string | undefined;
      return await PropertyController.createProperty(
        validatedBody as Partial<import('@real-estate-defi/shared').PropertyInfo>,
        userAddress,
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ body: createPropertySchema }))

  // PUT /properties/:id - update property
  .put('/:id', async ({ validatedParams, validatedBody, headers, set }: any) => {
    try {
      const userAddress = headers['x-user-address'] as string;
      if (!userAddress) {
        throw new UnauthorizedError('User address is required for authentication');
      }
      return await PropertyController.updateProperty(
        validatedParams.id,
        validatedBody as Partial<import('@real-estate-defi/shared').PropertyInfo>,
        userAddress,
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ params: uuidParamSchema, body: updatePropertySchema }))

  // DELETE /properties/:id - delete property
  .delete('/:id', async ({ validatedParams, headers, set }: any) => {
    try {
      const userAddress = headers['x-user-address'] as string;
      if (!userAddress) {
        throw new UnauthorizedError('User address is required for authentication');
      }
      return await PropertyController.deleteProperty(validatedParams.id, userAddress);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ params: uuidParamSchema }))

  // POST /properties/:id/tokenize - tokenize property
  .post('/:id/tokenize', async ({ validatedParams, body, headers, set }: any) => {
    try {
      const userAddress = headers['x-user-address'] as string | undefined;
      return await PropertyController.tokenizeProperty(validatedParams.id, body as unknown, userAddress);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ params: uuidParamSchema }))

  // POST /properties/:id/buy-shares - buy property shares
  .post('/:id/buy-shares', async ({ validatedParams, validatedBody, set }: any) => {
    try {
      return await PropertyController.buyShares(validatedParams.id, {
        buyer: validatedBody.buyer,
        shares: validatedBody.shares
      });
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  }, validate({ params: uuidParamSchema, body: buySharesSchema }))

  // GET /properties/:id/shares/:owner - get user shares
  .get('/:id/shares/:owner', async ({ params: { id, owner }, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Property ID is required');
      }
      return await PropertyController.getUserShares(id, owner);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });
