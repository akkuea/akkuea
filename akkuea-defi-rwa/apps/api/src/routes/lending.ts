import { Elysia } from 'elysia';
import { LendingController } from '../controllers/LendingController';
import { handleError, BadRequestError } from '../utils/errors';

export const lendingRoutes = new Elysia({ prefix: '/lending' })
  .get('/pools', async ({ set }) => {
    try {
      return await LendingController.getPools();
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .post('/pools', async ({ body, set }) => {
    try {
      return await LendingController.createPool(
        body as Partial<import('@real-estate-defi/shared').LendingPool>,
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .get('/pools/:id', async ({ params: { id }, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Pool ID is required');
      }
      return await LendingController.getPool(id);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .post('/pools/:id/deposit', async ({ params: { id }, body, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Pool ID is required');
      }
      return await LendingController.deposit(id, body as { user: string; amount: number });
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .post('/pools/:id/borrow', async ({ params: { id }, body, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Pool ID is required');
      }
      return await LendingController.borrow(
        id,
        body as {
          borrower: string;
          collateralPropertyId: string;
          collateralShares: number;
          borrowAmount: number;
        },
      );
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .get('/pools/:id/user/:address/deposits', async ({ params: { id, address }, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Pool ID is required');
      }
      return await LendingController.getUserDeposits(id, address);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  })
  .get('/pools/:id/user/:address/borrows', async ({ params: { id, address }, set }) => {
    try {
      if (!id) {
        throw new BadRequestError('Pool ID is required');
      }
      return await LendingController.getUserBorrows(id, address);
    } catch (error) {
      const errorResponse = handleError(error);
      set.status = errorResponse.statusCode;
      return errorResponse;
    }
  });
