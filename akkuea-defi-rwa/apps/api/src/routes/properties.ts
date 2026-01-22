import { Elysia } from 'elysia';
import { PropertyController } from '../controllers/PropertyController';

export const propertyRoutes = new Elysia({ prefix: '/properties' })
  .get('/', PropertyController.getProperties)
  .get('/:id', ({ params: { id } }) => PropertyController.getProperty(id))
  .post('/', ({ body }) =>
    PropertyController.createProperty(
      body as Partial<import('@real-estate-defi/shared').PropertyInfo>,
    ),
  )
  .post('/:id/tokenize', ({ params: { id }, body }) =>
    PropertyController.tokenizeProperty(id, body as unknown),
  )
  .post('/:id/buy-shares', ({ params: { id }, body }) =>
    PropertyController.buyShares(id, body as { buyer: string; shares: number }),
  )
  .get('/:id/shares/:owner', ({ params: { id, owner } }) =>
    PropertyController.getUserShares(id, owner),
  );
