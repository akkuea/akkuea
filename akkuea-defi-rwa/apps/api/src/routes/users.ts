import { Elysia } from 'elysia';
import { UserController } from '../controllers/UserController';

export const userRoutes = new Elysia({ prefix: '/users' })
  .get('/:address', ({ params: { address } }) => UserController.getUser(address))
  .post('/:address/wallet', ({ params: { address }, body }) =>
    UserController.connectWallet(address, body as { signature: string; message: string }),
  )
  .get('/:address/transactions', ({ params: { address } }) =>
    UserController.getUserTransactions(address),
  )
  .get('/:address/portfolio', ({ params: { address } }) =>
    UserController.getUserPortfolio(address),
  );
