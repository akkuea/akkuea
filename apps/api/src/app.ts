import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { propertyRoutes } from './routes/properties';
import { lendingRoutes } from './routes/lending';
import { userRoutes } from './routes/users';
import { kycRoutes } from './routes/kyc';
import { webhookRoutes } from './routes/webhooks';
import { internalOperationsRoutes } from './routes/internalOperations';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware';

/**
 * Base Elysia app (NO swagger, NO side effects)
 */
const app = new Elysia()
  .use(requestLogger)
  .use(cors())
  .use(errorHandler)
  .use(propertyRoutes)
  .use(lendingRoutes)
  .use(userRoutes)
  .use(kycRoutes)
  .use(webhookRoutes)
  .use(internalOperationsRoutes);

export default app;
