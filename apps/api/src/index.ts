import baseApp from './app';
import { checkDatabaseHealth, closeDatabaseConnection } from './db';
import { cacheService } from './services/CacheService';
import { NotificationService } from './services/NotificationService';
import { createNotificationWorkerFromEnv } from './workers/notificationWorker';
import { swaggerPlugin } from './swagger';

/**
 * Attach Swagger ONLY in development
 */

const app = baseApp.use(swaggerPlugin);

/**
 * Health route (safe, no duplication)
 */
app.get('/health', async () => {
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
});

/**
 * Start server
 */
const port = Number(process.env.PORT) || 3001;

app.listen({
  port,
  hostname: '0.0.0.0',
});

console.log(`🚀 API running on port ${port}`);

if (process.env.NODE_ENV !== 'production') {
  console.log(`📚 Swagger docs: http://localhost:${port}/docs`);
}

/**
 * Optional services (safe guards added)
 */

// Redis (non-blocking)
cacheService.connect();

/**
 * ⚠️ FIX: Prevent worker crash spam when DATABASE_URL missing
 */
let notificationWorker: ReturnType<typeof createNotificationWorkerFromEnv> | null = null;

if (process.env.DATABASE_URL) {
  notificationWorker = createNotificationWorkerFromEnv(new NotificationService());
  notificationWorker?.start();
} else {
  console.warn('[notificationWorker] Skipped start — DATABASE_URL not set (dev mode)');
}

/**
 * Graceful shutdown
 */
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
