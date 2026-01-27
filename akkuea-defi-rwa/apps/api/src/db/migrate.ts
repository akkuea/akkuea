import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDatabaseConnection } from './index';

async function runMigrations() {
  // eslint-disable-next-line no-console
  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    // eslint-disable-next-line no-console
    console.log('Migrations completed successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

runMigrations();
