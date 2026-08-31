# Environment Variable Setup Guide

This guide provides concrete, step-by-step instructions for obtaining real development values for every environment variable used in the Akkuea monorepo (`apps/api` and `apps/webapp`).

> **SECURITY WARNING**
> Never commit real secret credentials, private keys, or production tokens to version control. All `.env` files are ignored by git (`.gitignore`). Every example in this document uses placeholder syntax or commands to generate local dev credentials.

---

## Overview

To set up your local development environment:

1. For the API backend (`apps/api`):
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
2. For the Webapp frontend (`apps/webapp`):
   ```bash
   cp apps/webapp/.env.example apps/webapp/.env.local
   # or copy from apps/webapp/.env.local.example
   ```

---

## Variable Reference and Instructions

### 1. Database Configuration

#### `DATABASE_URL`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Run the local PostgreSQL container using Docker Compose:
    ```bash
    docker compose -f docker-compose.dev.yml up -d
    ```
  - Standard local development connection string:
    `postgresql://user:password@localhost:5432/akkuea_defi`
  - For local integration tests / CI:
    `postgresql://test:test@localhost:5432/akkuea_test` (run via `docker run -d --name akkuea-pg-test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=akkuea_test -p 5432:5432 postgres:16`)

#### `DATABASE_POOL_MAX`
- **Required**: No (default: `10`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Set to `10` or omit to use the default pool size.

#### `DATABASE_SSL`
- **Required**: No (default: `false`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Set to `false` for local development. Set to `true` only in production environments requiring SSL connections.

---

### 2. API Server Configuration

#### `PORT`
- **Required**: No (default: `3001`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Default is `3001`. Set to another numeric port if 3001 is in use.

#### `NODE_ENV`
- **Required**: Yes
- **Consumer**: `apps/api`, `apps/webapp`
- **Where to get a value for local development**: Set to `development` for local work, `test` during test runs, or `production` for live deployments.

#### `LOG_LEVEL`
- **Required**: No (default: `info`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Options are `debug`, `info`, `warn`, or `error`. Use `debug` when inspecting detailed API output locally.

---

### 3. Internal Security Credentials

#### `WEBHOOK_SECRET`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Generate a random 32-byte hex secret using OpenSSL:
  ```bash
  openssl rand -hex 32
  ```

#### `OPERATIONS_BACKEND_CREDENTIAL`
- **Required**: Yes
- **Consumer**: `apps/api`, `apps/webapp`
- **Where to get a value for local development**: Generate a random secret using OpenSSL:
  ```bash
  openssl rand -hex 32
  ```
  **Note**: This value MUST match in both `apps/api/.env` and `apps/webapp/.env.local`.

#### `OPERATIONS_ALLOWED_WALLETS`
- **Required**: Yes (production), optional/wildcard in development
- **Consumer**: `apps/api`, `apps/webapp`
- **Where to get a value for local development**: Set to `*` to permit any wallet address during local development, or list comma-separated Stellar public keys (e.g. `GABC123...,GDEF456...`).

#### `LIQUIDATOR_API_KEY`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Generate a random key using OpenSSL:
  ```bash
  openssl rand -hex 32
  ```

#### `INTERNAL_API_KEY`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Generate a random key using OpenSSL:
  ```bash
  openssl rand -hex 32
  ```

---

### 4. KYC and Document Storage

#### `KYC_UPLOAD_DIR`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Specify any absolute path to a writable directory on your computer (e.g. `./uploads` or `/tmp/akkuea-kyc`).
- **Production Note**: Must point to an isolated, non-public directory with strict operating system access controls.

#### `KYC_EXPIRY_JOB_ENABLED`
- **Required**: No (default: `true`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Set to `true` (or omit) to enable the background KYC expiry worker, or `false` to disable.

#### `KYC_EXPIRY_POLL_INTERVAL_MS`
- **Required**: No (default: `86400000`, 24 hours)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Default is 24 hours (`86400000`). Set to a lower number (e.g. `10000` for 10 seconds) when testing expiry behavior.

#### `KYC_EXPIRY_REMINDER_WINDOW_MS`
- **Required**: No (default: `2592000000`, 30 days)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Default is 30 days (`2592000000`). Adjust as needed for testing.

---

### 5. Notification Delivery Worker

#### `NOTIFICATIONS_ENABLED`
- **Required**: No (default: `true`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Set to `true` (or omit) to run the background notification worker, or `false` to disable.

#### `NOTIFICATION_WEBHOOK_URL`
- **Required**: No
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Use a webhook testing service (such as webhook.site) or a local mock endpoint URL.

#### `NOTIFICATION_WEBHOOK_SECRET`
- **Required**: No
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Generate via `openssl rand -hex 32` or use a test passphrase.

#### `NOTIFICATION_POLL_INTERVAL_MS`
- **Required**: No (default: `5000`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Poll interval in milliseconds (default: 5000).

#### `NOTIFICATION_REQUEST_TIMEOUT_MS`
- **Required**: No (default: `10000`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: HTTP request timeout in milliseconds (default: 10000).

---

### 6. Redis Caching

#### `REDIS_URL`
- **Required**: No
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Start the local Redis container using Docker Compose:
    ```bash
    docker compose -f docker-compose.dev.yml up -d
    ```
  - Standard connection string: `redis://localhost:6379`
  - If unset or unreachable, the API falls back seamlessly to direct database queries.

---

### 7. Stellar / Soroban Network Configuration

#### `STELLAR_NETWORK`
- **Required**: No (default: `testnet`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Set to `testnet` for testnet development or `mainnet` for live deployments.

#### `STELLAR_HORIZON_URL`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Testnet: `https://horizon-testnet.stellar.org`
  - Mainnet: `https://horizon.stellar.org`

#### `STELLAR_RPC_URL`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Testnet: `https://soroban-testnet.stellar.org`
  - Mainnet: `https://soroban.stellar.org`

#### `STELLAR_NETWORK_PASSPHRASE`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Testnet: `Test SDF Network ; September 2015`
  - Mainnet: `Public Global Stellar Network ; September 2015`
  - Local Quickstart: `Standalone Network ; February 2017`
  **Note**: Mind the exact string spacing, including the space before the semicolon.

---

### 8. Stellar / Soroban Admin Identity

> **SECURITY WARNING - STELLAR_ADMIN_SECRET**
> The admin secret key controls on-chain protocol permissions (minting shares, pool creation, role grants). Never share or commit this key.

#### `STELLAR_ADMIN_PUBLIC_KEY`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Option A (Stellar CLI):
    ```bash
    stellar keys generate --network testnet --fund admin
    stellar keys address admin
    ```
  - Option B (Stellar Laboratory):
    Visit https://laboratory.stellar.org/#account-creator?network=testnet and click **Generate keypair**, then click **Fund with Friendbot**. Copy the generated Public Key (starts with `G`, 56 characters).

#### `STELLAR_ADMIN_SECRET`
- **Required**: Yes
- **Consumer**: `apps/api`
- **Where to get a value for local development**:
  - Option A (Stellar CLI):
    ```bash
    stellar keys show admin
    ```
  - Option B (Stellar Laboratory):
    Copy the Secret Key (starts with `S`, 56 characters) generated alongside your public key from https://laboratory.stellar.org/#account-creator?network=testnet.

---

### 9. Stellar / Soroban Contract IDs

#### `REAL_ESTATE_TOKEN_CONTRACT_ID`
- **Required**: Optional override (defaults to `apps/shared/src/contracts.testnet.json`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Leave unset to use the standard testnet deployment in `@akkuea/shared`. If deploying custom contracts locally, copy the contract ID (starts with `C`, 56 characters) output from:
  ```bash
  bun run deploy:contracts
  ```
  See `docs/deployment/deploy-contracts.md` for full deployment instructions.

#### `DEFI_RWA_CONTRACT_ID`
- **Required**: Optional override (defaults to `apps/shared/src/contracts.testnet.json`)
- **Consumer**: `apps/api`
- **Where to get a value for local development**: Leave unset to use default shared contract ID, or insert your custom deployed contract ID.

---

### 10. WebApp Frontend Variables

#### `NEXT_PUBLIC_API_URL`
- **Required**: Yes
- **Consumer**: `apps/webapp` (browser client)
- **Where to get a value for local development**: `http://localhost:3001`

#### `API_URL`
- **Required**: Yes
- **Consumer**: `apps/webapp` (Next.js server side)
- **Where to get a value for local development**: `http://localhost:3001`

#### `NEXT_PUBLIC_PRIVY_APP_ID`
- **Required**: No
- **Consumer**: `apps/webapp`
- **Where to get a value for local development**:
  - Visit https://dashboard.privy.io to create a free developer app.
  - Copy the App ID from your Privy dashboard settings.
  - If left empty, Privy embedded login is disabled and only browser extension wallets (e.g. Freighter) are active.

#### `PRIVY_APP_SECRET`
- **Required**: No (server side only)
- **Consumer**: `apps/webapp`
- **Where to get a value for local development**:
  - Copy from https://dashboard.privy.io under App Settings > App Secret.
  - Keep this key server-side only; never expose it in client bundles.

#### `NEXT_PUBLIC_POLLAR_KEY`
- **Required**: No
- **Consumer**: `apps/webapp`
- **Where to get a value for local development**: Obtain an API key from the Pollar dashboard if social authentication testing is required, or leave empty to disable.

#### `NEXT_PUBLIC_USE_MOCK`
- **Required**: No (default: `false`)
- **Consumer**: `apps/webapp`
- **Where to get a value for local development**: Set to `true` to enable Mock Service Worker (MSW) for offline frontend development without running the API server. Set to `false` when connecting to a live local API server.

#### `NEXT_PUBLIC_LENDING_SSE_URL`
- **Required**: No
- **Consumer**: `apps/webapp`
- **Where to get a value for local development**: Leave empty to use HTTP polling, or set to `http://localhost:3001/lending/sse` if testing real-time events.
