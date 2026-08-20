import { Elysia, t } from 'elysia';
import { WhitelistController } from '../controllers/WhitelistController';

import { internalKeyAuth } from './internalOperations';

const requestSchema = t.Object({
  walletAddress: t.String({ maxLength: 56 }),
  fullName: t.String({ maxLength: 255 }),
  idType: t.Union([
    t.Literal('passport'),
    t.Literal('national_id'),
    t.Literal('drivers_license'),
  ]),
  idReference: t.String({ maxLength: 255 }),
});

const reviewSchema = t.Object({
  action: t.Union([t.Literal('approve'), t.Literal('reject')]),
  reason: t.Optional(t.String()),
});

export const whitelistRoutes = new Elysia({ prefix: '/pilot/whitelist' })
  .post('/request', (ctx) => WhitelistController.request(ctx), {
    body: requestSchema,
    detail: {
      summary: 'Submit whitelist request',
      tags: ['Pilot Whitelist'],
    },
  })
  .get('/status/:walletAddress', (ctx) => WhitelistController.status(ctx), {
    params: t.Object({ walletAddress: t.String() }),
    detail: {
      summary: 'Get status of whitelist request',
      tags: ['Pilot Whitelist'],
    },
  })
  .group('', (app) => 
    app
      .use(internalKeyAuth)
      .get('/pending', (ctx) => WhitelistController.pending(ctx), {
        detail: {
          summary: 'Get pending whitelist requests (Admin)',
          tags: ['Pilot Whitelist'],
        },
      })
      .post('/:id/review', (ctx) => WhitelistController.review(ctx), {
        body: reviewSchema,
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          summary: 'Review whitelist request (Admin)',
          tags: ['Pilot Whitelist'],
        },
      })
  );
