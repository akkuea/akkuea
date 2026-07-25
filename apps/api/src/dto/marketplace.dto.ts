import { z } from 'zod';
import { paginationQuerySchema } from '../middleware/validation';

/**
 * Marketplace query schema.
 * Extends the shared pagination schema with marketplace-specific filters.
 * Unlike the properties endpoint, the marketplace only surfaces
 * approved, verified properties that have available shares.
 */
export const marketplaceQuerySchema = paginationQuerySchema.extend({
  propertyType: z
    .enum(['residential', 'commercial', 'industrial', 'land', 'mixed'])
    .optional(),
  country: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
});

export type MarketplaceQueryInput = z.input<typeof marketplaceQuerySchema>;
export type MarketplaceQuery = z.output<typeof marketplaceQuerySchema>;
