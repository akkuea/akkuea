import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazy initialization to avoid module load-time errors in tests
let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPoolConfig() {
  return {
    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
    idle_timeout: 20,
    connect_timeout: 10,
    // In production, always validate SSL certificates to prevent MITM attacks
    // In development, allow self-signed certificates if DATABASE_SSL is set
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
  };
}

function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    client = postgres(connectionString, getPoolConfig());
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

function getClient() {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    client = postgres(connectionString, getPoolConfig());
    dbInstance = drizzle(client, { schema });
  }
  return client;
}

// Proxy that only initializes the database when accessed
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];
    // Bind functions to preserve 'this' context
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

// Export client getter for raw queries if needed
export { getClient as client };

// Health check function
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const conn = getClient();
    await conn`SELECT 1`;
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
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
