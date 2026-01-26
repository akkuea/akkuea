import { Elysia } from 'elysia';
import { PropertyController } from '../controllers/PropertyController';
import type { CreatePropertyDto, UpdatePropertyDto } from '../dto/property.dto';

const handleError = (error: unknown, set: any) => {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message.includes('Validation failed')) {
    set.status = 400;
    return { error: message };
  }

  if (message.includes('Unauthorized')) {
    set.status = 403;
    return { error: message };
  }

  if (message.includes('not found') || message.includes('required')) {
    set.status = 404;
    return { error: message };
  }

  set.status = 500;
  return { error: message };
};

export const propertyRoutes = new Elysia({ prefix: '/properties' })
  .get('/', async ({ query }) => {
    try {
      return await PropertyController.getAll(query);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        error: message,
        statusCode: message.includes('not found') ? 404 : 500,
      };
    }
  })

  .get('/:id', async ({ params: { id }, set }) => {
    try {
      return await PropertyController.getById(id);
    } catch (error) {
      return handleError(error, set);
    }
  })

  .post('/', async ({ body, set }) => {
    try {
      return await PropertyController.create(body as CreatePropertyDto);
    } catch (error) {
      return handleError(error, set);
    }
  })

  .put('/:id', async ({ params: { id }, body, set }) => {
    try {
      return await PropertyController.update(id, body as UpdatePropertyDto);
    } catch (error) {
      return handleError(error, set);
    }
  })

  .patch('/:id', async ({ params: { id }, body, set }) => {
    try {
      return await PropertyController.update(id, body as UpdatePropertyDto);
    } catch (error) {
      return handleError(error, set);
    }
  })

  .delete('/:id', async ({ params: { id }, headers, set }) => {
    try {
      const userAddress = headers.authorization?.replace('Bearer ', '');
      await PropertyController.delete(id, userAddress);
      set.status = 204;
      return null;
    } catch (error) {
      return handleError(error, set);
    }
  })

  .post('/:id/tokenize', async ({ params: { id }, body, set }) => {
    try {
      return await PropertyController.tokenizeProperty(id, body as unknown);
    } catch (error) {
      return handleError(error, set);
    }
  })

  .post('/:id/buy-shares', async ({ params: { id }, body, set }) => {
    try {
      return await PropertyController.buyShares(id, body as { buyer: string; shares: number });
    } catch (error) {
      return handleError(error, set);
    }
  })

  .get('/:id/shares/:owner', async ({ params: { id, owner }, set }) => {
    try {
      return await PropertyController.getUserShares(id, owner);
    } catch (error) {
      return handleError(error, set);
    }
  });
