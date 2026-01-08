import { Elysia } from 'elysia';
import { LendingController } from '../controllers/LendingController';

export const lendingRoutes = new Elysia({ prefix: '/lending' })
  .get('/pools', () => LendingController.getPools)
  .post('/pools', ({ body }) => LendingController.createPool(body))
  .get('/pools/:id', ({ params: { id } }) => LendingController.getPool(id))
  .post('/pools/:id/deposit', ({ params: { id }, body }) => LendingController.deposit(id, body))
  .post('/pools/:id/borrow', ({ params: { id }, body }) => LendingController.borrow(id, body))
  .get('/pools/:id/user/:address/deposits', ({ params: { id, address } }) =>
    LendingController.getUserDeposits(id, address),
  )
  .get('/pools/:id/user/:address/borrows', ({ params: { id, address } }) =>
    LendingController.getUserBorrows(id, address),
  );
