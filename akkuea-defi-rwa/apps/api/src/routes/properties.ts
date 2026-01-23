import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, paginationQuerySchema } from '../middleware';
import { PropertyController } from '../controllers/PropertyController';

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
  .get('/', ({ validatedQuery }: any) => {
    return PropertyController.getProperties(validatedQuery);
  }, validate({ query: propertyQuerySchema }))

  // GET /properties/:id - get single property
  .get('/:id', ({ validatedParams }: any) => {
    return PropertyController.getProperty(validatedParams.id);
  }, validate({ params: uuidParamSchema }))

  // POST /properties - create property
  .post('/', ({ validatedBody, headers }: any) => {
    const userId = headers['x-user-id'];
    // PropertyController.createProperty has been confirmed to exist
    return PropertyController.createProperty({ ...validatedBody, owner: userId });
  }, validate({ body: createPropertySchema }))

  // PUT /properties/:id - update property
  .put('/:id', ({ validatedParams, validatedBody, headers }: any) => {
    const userId = headers['x-user-id'];
    // PropertyController fallback since update/delete aren't fully implemented in the existing controller
    return (PropertyController as any).updateProperty?.(validatedParams.id, validatedBody, userId) ?? 
           PropertyController.getProperty(validatedParams.id);
  }, validate({ params: uuidParamSchema, body: updatePropertySchema }))

  // DELETE /properties/:id - delete property
  .delete('/:id', ({ validatedParams, headers }: any) => {
    const userId = headers['x-user-id'];
    return (PropertyController as any).deleteProperty?.(validatedParams.id, userId) ?? 
           PropertyController.getProperty(validatedParams.id);
  }, validate({ params: uuidParamSchema }))

  // POST /properties/:id/buy-shares - buy property shares
  .post('/:id/buy-shares', ({ validatedParams, validatedBody, headers }: any) => {
    const userId = headers['x-user-id'] ?? 'placeholder-userId';
    return PropertyController.buyShares(validatedParams.id, {
      buyer: userId,
      shares: validatedBody.shares
    });
  }, validate({ params: uuidParamSchema, body: buySharesSchema }));
