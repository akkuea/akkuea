import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Elysia } from 'elysia';
import {
  OperationalPropertyController,
  type OperationalPropertyDetail,
} from '../controllers/OperationalPropertyController';
import { internalOperationsRoutes } from './internalOperations';

describe('internal property operations audit actor', () => {
  const app = new Elysia().use(internalOperationsRoutes);
  const operatorWallet = `G${'A'.repeat(55)}`;
  let applyReview: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = 'internal-secret';
    applyReview = spyOn(OperationalPropertyController, 'applyReviewAction').mockResolvedValue(
      {} as OperationalPropertyDetail,
    );
  });

  afterEach(() => {
    applyReview.mockRestore();
    delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
  });

  test('uses the trusted proxy identity and ignores any actor in the request body', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost/internal/operations/properties/00000000-0000-0000-0000-000000000001/review',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'internal-secret',
            'x-operator-wallet': operatorWallet,
          },
          body: JSON.stringify({ action: 'approve', actorWallet: 'Gclient-controlled' }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(applyReview.mock.calls[0]?.[1].actorWallet).toBe(operatorWallet);
  });

  test('requires the trusted actor header for review actions', async () => {
    const response = await app.handle(
      new Request(
        'http://localhost/internal/operations/properties/00000000-0000-0000-0000-000000000001/review',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-api-key': 'internal-secret',
          },
          body: JSON.stringify({ action: 'approve' }),
        },
      ),
    );

    expect(response.status).toBe(401);
    expect(applyReview).not.toHaveBeenCalled();
  });
});
