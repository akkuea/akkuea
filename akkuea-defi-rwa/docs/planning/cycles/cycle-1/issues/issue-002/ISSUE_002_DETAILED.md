# C1-002: Implement Database Connection and ORM Setup

## Detailed Implementation Guide

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-002 |
| Title | Implement database connection and ORM setup |
| Area | API |
| Difficulty | High |
| Labels | backend, database, high |
| Dependencies | None |
| Estimated Lines | 300-400 |

## Overview

This issue establishes the persistence layer for the Akkuea DeFi RWA API using PostgreSQL and Drizzle ORM. Drizzle provides a TypeScript-first approach with excellent performance and type safety.

## Prerequisites

- PostgreSQL 15+ installed locally or accessible via Docker
- Understanding of SQL and ORM concepts
- Familiarity with Drizzle ORM

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd apps/api
bun add drizzle-orm postgres
bun add -d drizzle-kit @types/pg
```

### Step 2: Configure Environment Variables

Create/update `apps/api/.env.example`:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/akkuea_defi
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=false

# API Configuration
PORT=3001
NODE_ENV=development
```

### Step 3: Create Database Connection

Create `apps/api/src/db/index.ts`:

```typescript
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
```

### Step 4: Create Schema Files

Create `apps/api/src/db/schema/users.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  text,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const kycStatusEnum = pgEnum('kyc_status', [
  'not_started',
  'pending',
  'approved',
  'rejected',
  'expired',
]);

export const kycTierEnum = pgEnum('kyc_tier', [
  'none',
  'basic',
  'verified',
  'accredited',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 56 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 50 }),
  kycStatus: kycStatusEnum('kyc_status').notNull().default('not_started'),
  kycTier: kycTierEnum('kyc_tier').notNull().default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const kycDocumentTypeEnum = pgEnum('kyc_document_type', [
  'passport',
  'national_id',
  'drivers_license',
  'proof_of_address',
  'bank_statement',
  'tax_document',
]);

export const kycDocumentStatusEnum = pgEnum('kyc_document_status', [
  'pending',
  'approved',
  'rejected',
]);

export const kycDocuments = pgTable('kyc_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: kycDocumentTypeEnum('type').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  status: kycDocumentStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

export const usersRelations = relations(users, ({ many }) => ({
  kycDocuments: many(kycDocuments),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, {
    fields: [kycDocuments.userId],
    references: [users.id],
  }),
}));
```

Create `apps/api/src/db/schema/properties.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  decimal,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const propertyTypeEnum = pgEnum('property_type', [
  'residential',
  'commercial',
  'industrial',
  'land',
  'mixed',
]);

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  propertyType: propertyTypeEnum('property_type').notNull(),
  location: jsonb('location').notNull().$type<{
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  }>(),
  totalValue: decimal('total_value', { precision: 20, scale: 2 }).notNull(),
  tokenAddress: varchar('token_address', { length: 56 }),
  totalShares: integer('total_shares').notNull(),
  availableShares: integer('available_shares').notNull(),
  pricePerShare: decimal('price_per_share', { precision: 20, scale: 2 }).notNull(),
  images: jsonb('images').notNull().$type<string[]>(),
  verified: boolean('verified').notNull().default(false),
  listedAt: timestamp('listed_at', { withTimezone: true }).notNull().defaultNow(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
});

export const propertyDocumentTypeEnum = pgEnum('property_document_type', [
  'deed',
  'appraisal',
  'inspection',
  'insurance',
  'other',
]);

export const propertyDocuments = pgTable('property_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  type: propertyDocumentTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  verified: boolean('verified').notNull().default(false),
});

export const shareOwnerships = pgTable('share_ownerships', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  shares: integer('shares').notNull(),
  purchasePrice: decimal('purchase_price', { precision: 20, scale: 2 }).notNull(),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  lastDividendClaimed: timestamp('last_dividend_claimed', { withTimezone: true }),
});

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id],
  }),
  documents: many(propertyDocuments),
  shareOwnerships: many(shareOwnerships),
}));
```

Create `apps/api/src/db/schema/lending.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const lendingPools = pgTable('lending_pools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  asset: varchar('asset', { length: 20 }).notNull(),
  assetAddress: varchar('asset_address', { length: 56 }).notNull(),
  totalDeposits: decimal('total_deposits', { precision: 20, scale: 7 }).notNull().default('0'),
  totalBorrows: decimal('total_borrows', { precision: 20, scale: 7 }).notNull().default('0'),
  availableLiquidity: decimal('available_liquidity', { precision: 20, scale: 7 }).notNull().default('0'),
  utilizationRate: decimal('utilization_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  supplyAPY: decimal('supply_apy', { precision: 5, scale: 2 }).notNull().default('0'),
  borrowAPY: decimal('borrow_apy', { precision: 5, scale: 2 }).notNull().default('0'),
  collateralFactor: decimal('collateral_factor', { precision: 5, scale: 2 }).notNull(),
  liquidationThreshold: decimal('liquidation_threshold', { precision: 5, scale: 2 }).notNull(),
  liquidationPenalty: decimal('liquidation_penalty', { precision: 5, scale: 2 }).notNull(),
  reserveFactor: integer('reserve_factor').notNull().default(1000),
  isActive: boolean('is_active').notNull().default(true),
  isPaused: boolean('is_paused').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const depositPositions = pgTable('deposit_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id')
    .notNull()
    .references(() => lendingPools.id),
  depositorId: uuid('depositor_id')
    .notNull()
    .references(() => users.id),
  amount: decimal('amount', { precision: 20, scale: 7 }).notNull(),
  shares: decimal('shares', { precision: 20, scale: 7 }).notNull(),
  depositedAt: timestamp('deposited_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccrualAt: timestamp('last_accrual_at', { withTimezone: true }).notNull().defaultNow(),
  accruedInterest: decimal('accrued_interest', { precision: 20, scale: 7 }).notNull().default('0'),
});

export const borrowPositions = pgTable('borrow_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id')
    .notNull()
    .references(() => lendingPools.id),
  borrowerId: uuid('borrower_id')
    .notNull()
    .references(() => users.id),
  principal: decimal('principal', { precision: 20, scale: 7 }).notNull(),
  accruedInterest: decimal('accrued_interest', { precision: 20, scale: 7 }).notNull().default('0'),
  collateralAmount: decimal('collateral_amount', { precision: 20, scale: 7 }).notNull(),
  collateralAsset: varchar('collateral_asset', { length: 56 }).notNull(),
  healthFactor: decimal('health_factor', { precision: 10, scale: 4 }).notNull(),
  borrowedAt: timestamp('borrowed_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccrualAt: timestamp('last_accrual_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lendingPoolsRelations = relations(lendingPools, ({ many }) => ({
  depositPositions: many(depositPositions),
  borrowPositions: many(borrowPositions),
}));
```

Create `apps/api/src/db/schema/transactions.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'deposit',
  'withdraw',
  'borrow',
  'repay',
  'liquidation',
  'buy_shares',
  'sell_shares',
  'dividend',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'confirmed',
  'failed',
]);

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: transactionTypeEnum('type').notNull(),
  hash: varchar('hash', { length: 64 }),
  fromUserId: uuid('from_user_id')
    .notNull()
    .references(() => users.id),
  toUserId: uuid('to_user_id').references(() => users.id),
  amount: decimal('amount', { precision: 20, scale: 7 }).notNull(),
  asset: varchar('asset', { length: 56 }).notNull(),
  status: transactionStatusEnum('status').notNull().default('pending'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [transactions.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [transactions.toUserId],
    references: [users.id],
  }),
}));
```

Create `apps/api/src/db/schema/index.ts`:

```typescript
export * from './users';
export * from './properties';
export * from './lending';
export * from './transactions';
```

### Step 5: Create Drizzle Configuration

Create `apps/api/drizzle.config.ts`:

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### Step 6: Create Migration Script

Create `apps/api/src/db/migrate.ts`:

```typescript
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDatabaseConnection } from './index';

async function runMigrations() {
  console.log('Running migrations...');

  try {
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabaseConnection();
  }
}

runMigrations();
```

### Step 7: Create Base Repository

Create `apps/api/src/repositories/BaseRepository.ts`:

```typescript
import { db } from '../db';
import { eq, SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

export abstract class BaseRepository<
  TTable extends PgTable,
  TInsert,
  TSelect,
> {
  constructor(protected readonly table: TTable) {}

  async findAll(): Promise<TSelect[]> {
    return db.select().from(this.table) as unknown as TSelect[];
  }

  async findById(id: string): Promise<TSelect | undefined> {
    const idColumn = (this.table as any).id;
    const results = await db
      .select()
      .from(this.table)
      .where(eq(idColumn, id));
    return results[0] as TSelect | undefined;
  }

  async findWhere(condition: SQL): Promise<TSelect[]> {
    return db
      .select()
      .from(this.table)
      .where(condition) as unknown as TSelect[];
  }

  async create(data: TInsert): Promise<TSelect> {
    const results = await db
      .insert(this.table)
      .values(data as any)
      .returning();
    return results[0] as TSelect;
  }

  async update(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const idColumn = (this.table as any).id;
    const results = await db
      .update(this.table)
      .set(data as any)
      .where(eq(idColumn, id))
      .returning();
    return results[0] as TSelect | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const idColumn = (this.table as any).id;
    const results = await db
      .delete(this.table)
      .where(eq(idColumn, id))
      .returning();
    return results.length > 0;
  }
}
```

### Step 8: Add Health Check Route

Update `apps/api/src/index.ts` to include:

```typescript
import { checkDatabaseHealth, closeDatabaseConnection } from './db';

// Add health check endpoint
app.get('/health', async () => {
  const dbHealth = await checkDatabaseHealth();

  return {
    status: dbHealth.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
    },
  };
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connections...');
  await closeDatabaseConnection();
  process.exit(0);
});
```

### Step 9: Add Package Scripts

Update `apps/api/package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run src/db/migrate.ts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

## Testing Guidelines

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db, checkDatabaseHealth, closeDatabaseConnection } from '../src/db';
import { users } from '../src/db/schema';

describe('Database Connection', () => {
  beforeAll(async () => {
    // Ensure connection is established
    const health = await checkDatabaseHealth();
    expect(health.healthy).toBe(true);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it('should connect to database', async () => {
    const health = await checkDatabaseHealth();
    expect(health.healthy).toBe(true);
    expect(health.latency).toBeLessThan(1000);
  });

  it('should perform basic CRUD operations', async () => {
    // Create
    const [user] = await db
      .insert(users)
      .values({
        walletAddress: 'GTEST' + 'X'.repeat(51),
      })
      .returning();

    expect(user.id).toBeDefined();

    // Read
    const found = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(found).toBeDefined();

    // Delete (cleanup)
    await db.delete(users).where(eq(users.id, user.id));
  });
});
```

## Related Resources

| Resource | Link |
|----------|------|
| Drizzle ORM Documentation | https://orm.drizzle.team |
| PostgreSQL Documentation | https://www.postgresql.org/docs/ |
| Bun SQL Driver | https://bun.sh/docs/api/sql |

## Verification Checklist

| Item | Status |
|------|--------|
| Dependencies installed | |
| Environment variables configured | |
| All schema files created | |
| Migrations generated and applied | |
| Health check endpoint working | |
| Base repository implemented | |
| Graceful shutdown handling | |
| Integration tests passing | |
