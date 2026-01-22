import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { propertyRoutes } from './routes/properties';
import { lendingRoutes } from './routes/lending';
import { userRoutes } from './routes/users';
import { kycRoutes } from './routes/kyc';
import { errorHandler, requestLogger } from './middleware';

const app = new Elysia()
  .use(requestLogger)
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Real Estate DeFi API',
          version: '1.0.0',
          description:
            'Backend API for Real Estate Tokenization and DeFi Lending Platform on Stellar',
        },
      },
    }),
  )
  .use(errorHandler)
  .use(propertyRoutes)
  .use(lendingRoutes)
  .use(userRoutes)
  .use(kycRoutes)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }))
  .listen(process.env.PORT || 3001);

// eslint-disable-next-line no-console
console.log(`🚀 Real Estate DeFi API is running on port ${process.env.PORT || 3001}`);
// eslint-disable-next-line no-console
console.log(`📚 Swagger docs available at http://localhost:${process.env.PORT || 3001}/swagger`);

export default app;
