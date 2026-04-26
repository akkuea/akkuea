import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { propertyRoutes } from '../routes/properties';
import { lendingRoutes } from '../routes/lending';
import { userRoutes } from '../routes/users';
import { kycRoutes } from '../routes/kyc';
import { webhookRoutes } from '../routes/webhooks';
import { notificationRoutes } from '../routes/notifications';
import { errorHandler } from '../middleware/errorHandler';
import { requestLogger } from '../middleware';

/**
 * Base Elysia app without swagger
 * This allows tests to import the app without triggering @scalar/themes Zod incompatibility
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
  .use(notificationRoutes);

export default app;
