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
} from '../middleware';
import { PropertyController } from '../controllers/PropertyController';
import { handleError, UnauthorizedError } from '../utils/errors';

// ------------------ Schemas ------------------

const propertyQuerySchema = paginationQuerySchema.extend({
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'land', 'mixed']).optional(),
  country: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  verified: z.coerce.boolean().optional(),
  owner: z.string().length(56).optional(),
});

const createPropertySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(10),
  propertyType: z.enum(['residential', 'commercial', 'industrial', 'land', 'mixed']),
  location: z.object({
    address: z.string(),
    city: z.string(),
    country: z.string(),
    postalCode: z.string().optional(),
  }),
  totalValue: z.string(),
  totalShares: z.number().int().positive(),
  pricePerShare: z.string(),
  images: z.array(z.string().url()).min(1),
});

const updatePropertySchema = createPropertySchema.partial();

const buySharesSchema = z.object({
  buyer: z.string(),
  shares: z.number().int().positive(),
});

// ------------------ Routes ------------------

export const propertyRoutes = new Elysia({ prefix: '/properties', tags: ['Properties'] })

  /**
   * GET /properties
   */
  .use(validateQuery(propertyQuerySchema))
  .get(
    '/',
    async ({ validatedQuery, set }) => {
      try {
        return await PropertyController.getProperties(validatedQuery!);
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      query: propertyQuerySchema,
      detail: {
        summary: 'List properties',
        description: 'Fetch properties with filters and pagination',
      },
    },
  )

  /**
   * GET /properties/:id
   */
  .use(validateParams(uuidParamSchema))
  .get(
    '/:id',
    async ({ validatedParams, set }) => {
      try {
        return await PropertyController.getProperty(validatedParams!.id);
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      params: uuidParamSchema,
      detail: {
        summary: 'Get property by ID',
      },
    },
  )

  /**
   * POST /properties
   */
  .use(validateBody(createPropertySchema))
  .post(
    '/',
    async ({ validatedBody, headers, set }) => {
      try {
        const userAddress = headers['x-user-address'];
        if (!userAddress) throw new UnauthorizedError('User address required');

        return await PropertyController.createProperty(validatedBody!, userAddress);
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      body: createPropertySchema,
      beforeHandle: rateLimit(),
      detail: {
        summary: 'Create property',
      },
    },
  )

  /**
   * PUT /properties/:id
   */
  .use(validateParams(uuidParamSchema))
  .use(validateBody(updatePropertySchema))
  .put(
    '/:id',
    async ({ validatedParams, validatedBody, headers, set }) => {
      try {
        const userAddress = headers['x-user-address'];
        if (!userAddress) throw new UnauthorizedError('User address required');

        return await PropertyController.updateProperty(
          validatedParams!.id,
          validatedBody!,
          userAddress,
        );
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      params: uuidParamSchema,
      body: updatePropertySchema,
      detail: {
        summary: 'Update property',
      },
    },
  )

  /**
   * DELETE /properties/:id
   */
  .use(validateParams(uuidParamSchema))
  .delete(
    '/:id',
    async ({ validatedParams, headers, set }) => {
      try {
        const userAddress = headers['x-user-address'];
        if (!userAddress) throw new UnauthorizedError('User address required');

        return await PropertyController.deleteProperty(validatedParams!.id, userAddress);
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      params: uuidParamSchema,
      detail: {
        summary: 'Delete property',
      },
    },
  )

  /**
   * POST /properties/:id/tokenize
   */
  .use(validateParams(uuidParamSchema))
  .post(
    '/:id/tokenize',
    async ({ validatedParams, body, headers, set }) => {
      try {
        return await PropertyController.tokenizeProperty(
          validatedParams!.id,
          body,
          headers['x-user-address'],
        );
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      params: uuidParamSchema,
      beforeHandle: rateLimit(),
      detail: {
        summary: 'Tokenize property',
      },
    },
  )

  /**
   * POST /properties/:id/buy-shares
   */
  .use(validateParams(uuidParamSchema))
  .use(validateBody(buySharesSchema))
  .post(
    '/:id/buy-shares',
    async ({ validatedParams, validatedBody, headers, set }) => {
      try {
        const userAddress = headers['x-user-address'];
        if (!userAddress) throw new UnauthorizedError('User address required');

        return await PropertyController.buyShares(validatedParams!.id, validatedBody!, userAddress);
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      params: uuidParamSchema,
      body: buySharesSchema,
      beforeHandle: rateLimit(),
      detail: {
        summary: 'Buy property shares',
      },
    },
  )

  /**
   * GET /properties/:id/shares/:owner
   */
  .use(validateParams(ownerParamSchema))
  .get(
    '/:id/shares/:owner',
    async ({ validatedParams, set }) => {
      try {
        return await PropertyController.getUserShares(validatedParams!.id, validatedParams!.owner);
      } catch (error) {
        const err = handleError(error);
        set.status = err.statusCode;
        return err;
      }
    },
    {
      params: ownerParamSchema,
      detail: {
        summary: 'Get user shares',
      },
    },
  );
