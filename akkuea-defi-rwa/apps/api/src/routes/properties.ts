import { Elysia } from 'elysia';
import { PropertyController } from '../controllers/PropertyController';
import { handleError, BadRequestError, UnauthorizedError } from '../utils/errors';

export const propertyRoutes = new Elysia({ prefix: '/properties' })
  .get('/', async ({ query, set }) => {
    try {
      return await PropertyController.getProperties(query);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .get('/:id', async ({ params: { id }, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Property ID is required');
      }
      return await PropertyController.getProperty(id);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .post('/', async ({ body, headers, set }) => {
    try {
      const userAddress = headers['x-user-address'] as string | undefined;
      return await PropertyController.createProperty(
        body as Partial<import('@real-estate-defi/shared').PropertyInfo>,
        userAddress,
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .put('/:id', async ({ params: { id }, body, headers, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Property ID is required');
      }
      const userAddress = headers['x-user-address'] as string;
      if (!userAddress) {
        throw new UnauthorizedError('User address is required for authentication');
      }
      return await PropertyController.updateProperty(
        id,
        body as Partial<import('@real-estate-defi/shared').PropertyInfo>,
        userAddress,
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .delete('/:id', async ({ params: { id }, headers, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Property ID is required');
      }
      const userAddress = headers['x-user-address'] as string;
      if (!userAddress) {
        throw new UnauthorizedError('User address is required for authentication');
      }
      return await PropertyController.deleteProperty(id, userAddress);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .post('/:id/tokenize', async ({ params: { id }, body, headers, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Property ID is required');
      }
      const userAddress = headers['x-user-address'] as string | undefined;
      return await PropertyController.tokenizeProperty(id, body as unknown, userAddress);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .post('/:id/buy-shares', async ({ params: { id }, body, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Property ID is required');
      }
      return await PropertyController.buyShares(id, body as { buyer: string; shares: number });
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
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
