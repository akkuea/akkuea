import { swagger } from '@elysiajs/swagger';
import app from './app';
import { checkDatabaseHealth, closeDatabaseConnection } from './db';
import { propertyRoutes } from './routes/properties';
import { lendingRoutes } from './routes/lending';
import { userRoutes } from './routes/users';
import { kycRoutes } from './routes/kyc';
import { authRoutes } from './routes/auth';
import { webhookRoutes } from './routes/webhooks';
import { oracleRoutes } from './routes/oracle';
import { riskMonitoringRoutes } from './routes/riskMonitoring';
import { notificationRoutes } from './routes/notifications';
import { internalOperationsRoutes } from './routes/internalOperations';
import { notificationDlqRoutes } from './routes/notificationDlq';
import { ledgerRoutes } from './routes/ledger';
import { errorHandler } from './middleware/errorHandler';
import { cacheService } from './services/CacheService';
import { NotificationService } from './services/NotificationService';
import { createNotificationWorkerFromEnv } from './workers/notificationWorker';

app
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Real Estate DeFi API',
          version: '1.0.0',
          description:
            'Backend API for Real Estate Tokenization and DeFi Lending Platform on Stellar',
        },
        tags: [
          { name: 'Properties', description: 'Property management and tokenization' },
          { name: 'Lending', description: 'Lending pool operations and DeFi' },
          { name: 'Users', description: 'User registration and profile management' },
          { name: 'KYC', description: 'Know Your Customer verification' },
          { name: 'Auth', description: 'Authentication and session management' },
          { name: 'Webhooks', description: 'Stellar network webhook handlers' },
          { name: 'Oracle', description: 'Property valuation oracle' },
          { name: 'Risk Monitoring', description: 'Risk assessment and liquidation readiness' },
          { name: 'Notifications', description: 'User notification management' },
          { name: 'Internal Operations', description: 'Internal property review and operations' },
          { name: 'Notification DLQ', description: 'Dead letter queue for failed notifications' },
          { name: 'Ledger', description: 'Stellar ledger streaming via SSE' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT Bearer token for authenticated endpoints',
            },
            internalApiKey: {
              type: 'apiKey',
              in: 'header',
              name: 'x-internal-api-key',
              description: 'Internal API key for service-to-service communication',
            },
          },
        },
      },
    }),
  )
  .use(errorHandler)
  .use(propertyRoutes)
  .use(lendingRoutes)
  .use(userRoutes)
  .use(kycRoutes)
  .use(authRoutes)
  .use(webhookRoutes)
  .use(oracleRoutes)
  .use(riskMonitoringRoutes)
  .use(notificationRoutes)
  .use(internalOperationsRoutes)
  .use(notificationDlqRoutes)
  .use(ledgerRoutes)
  .get('/health', async () => {
    const dbHealth = await checkDatabaseHealth();

    return {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: {
          healthy: dbHealth.healthy,
          latency: dbHealth.latency,
          ...(dbHealth.error && { error: dbHealth.error }),
        },
      },
    };
  })

  .listen({
    port: Number(process.env.PORT) || 3001,
    hostname: '0.0.0.0',
  });

console.log(`🚀 Real Estate DeFi API is running on port ${process.env.PORT || 3001}`);
console.log(`📚 Swagger docs available at http://localhost:${process.env.PORT || 3001}/swagger`);

// Connect to Redis (non-blocking - app works without it)
cacheService.connect();

// Start the notification delivery worker (opt-out via NOTIFICATIONS_ENABLED=false)
const notificationWorker = createNotificationWorkerFromEnv(new NotificationService());
notificationWorker?.start();

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, closing connections...`);
  await Promise.all([
    closeDatabaseConnection(),
    cacheService.disconnect(),
    notificationWorker?.stop() ?? Promise.resolve(),
  ]);

  console.log('Connections closed. Exiting...');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
