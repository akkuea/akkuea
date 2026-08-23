import { Elysia, t } from 'elysia';
import { WhitelistController } from '../controllers/WhitelistController';

const requestSchema = t.Object({
  walletAddress: t.String({ maxLength: 56 }),
  fullName: t.String({ maxLength: 255 }),
  idType: t.Union([t.Literal('passport'), t.Literal('national_id'), t.Literal('drivers_license')]),
  idReference: t.String({ maxLength: 255 }),
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
  });
