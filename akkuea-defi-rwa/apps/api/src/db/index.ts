import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection pool configuration
const poolConfig = {
  max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Create postgres connection
const client = postgres(connectionString, poolConfig);

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export client for raw queries if needed
export { client };

// Health check function
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await client`SELECT 1`;
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await client.end();
}
