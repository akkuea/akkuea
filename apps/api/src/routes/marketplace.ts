import { Elysia } from 'elysia';
import { validateQuery, validateParams, uuidParamSchema } from '../middleware';
import { marketplaceQuerySchema } from '../dto/marketplace.dto';
import { MarketplaceController } from '../controllers/MarketplaceController';
import { handleError } from '../utils/errors';

// GET /marketplace - list approved properties with available shares
const listMarketplaceRoute = new Elysia()
  .use(validateQuery(marketplaceQuerySchema))
  .get('/', async ({ validatedQuery, set }) => {
    try {
      return await MarketplaceController.getListings(validatedQuery!);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// GET /marketplace/:id - get single marketplace listing
const getMarketplaceListingRoute = new Elysia()
  .use(validateParams(uuidParamSchema))
  .get('/:id', async ({ validatedParams, set }) => {
    try {
      return await MarketplaceController.getListing(validatedParams!.id);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });

// Combine all marketplace routes
export const marketplaceRoutes = new Elysia({ prefix: '/marketplace' })
  .use(listMarketplaceRoute)
  .use(getMarketplaceListingRoute);
