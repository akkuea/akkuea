# Akkuea Developer Setup & Testing Guide

Complete developer setup instructions for the Real Estate Tokenization & DeFi Lending platform on Stellar.

---

## Table of Contents

1. [Prerequisites & Versions](#prerequisites--versions)
2. [Initial Setup](#initial-setup)
3. [Building Soroban Contracts Locally](#building-soroban-contracts-locally)
4. [Environment Configuration](#environment-configuration)
5. [Running Services (Local Development)](#running-services-local-development)
6. [Running Against Testnet Contracts](#running-against-testnet-contracts)
7. [Full Test Suite](#full-test-suite)
8. [Build Scripts & CI Workflows](#build-scripts--ci-workflows)

---

## Prerequisites & Versions

| Tool                  | Version | Required For     | Download Link                                   |
| --------------------- | ------- | ---------------- | ----------------------------------------------- |
| **Bun**               | 1.2.23+ | API, webapp      | https://bun.sh                                  |
| **Node.js**           | 18.0.0+ | Build tooling    | https://nodejs.org                              |
| **Rust**              | latest  | Contracts only   | https://rustup.rs                               |
| **Stellar CLI**       | 21.0.0+ | Deployment only  | (see instructions below)                        |
| **Git**               | any     | Version control  | https://git-scm.com                             |
| **PostgreSQL**        | 16      | API database     | https://www.postgresql.org/download/            |
| **Docker** (optional) | any     | Database testing | https://www.docker.com/products/docker-desktop/ |

### Installation Commands

```bash
# Bun (macOS/Linux with curl)
curl -fsSL https://bun.sh/install | bash

# Bun (Windows with PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Stellar CLI (requires Rust; can take 5+ minutes to compile)
cargo install --locked stellar-cli --features opt
stellar --version  # verify: should be 21.x.x or higher

# Verify all installations
bun --version
node --version
rustc --version
stellar --version
```

### WASM Target for Rust (Contract Development Only)

```bash
# Add the WASM compilation target
rustup target add wasm32-unknown-unknown

# Verify
rustup target list --installed | grep wasm32
```

---

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository (use your fork per CONTRIBUTING.md)
git clone https://github.com/<your-username>/akkuea.git
cd akkuea

# Install all workspace dependencies (Bun monorepo)
bun run install:all
# OR do it step-by-step:
# bun install
# bun install --workspaces
```

### 2. Verify Monorepo Structure

```bash
# Check that all workspaces are properly configured
ls -la apps/{api,webapp,shared,contracts}

# Verify package.json files exist
find apps -name "package.json" | head -10
```

### 3. Configure Environment Files

**For API (required for local development):**

```bash
# Copy the example environment
cp apps/api/.env.example apps/api/.env.local

# Edit and configure the values (see Environment Configuration section below)
# Minimum required for local dev with mocked contracts:
# - DATABASE_URL
# - STELLAR_ADMIN_SECRET (use a testnet account)
# - STELLAR_ADMIN_PUBLIC_KEY
# - REAL_ESTATE_TOKEN_CONTRACT_ID
# - STELLAR_NETWORK_PASSPHRASE
# - STELLAR_HORIZON_URL
# - STELLAR_RPC_URL
```

**For Webapp (optional, has defaults):**

```bash
# Webapp has built-in defaults for local development
# Only copy if you need to override:
# cp apps/webapp/.env.local.example apps/webapp/.env.local
```

---

## Building Soroban Contracts Locally

### Overview

- **Single WASM binary** containing both property tokenization and DeFi lending logic
- **Architecture:** One contract, one contract ID, one deployment
- **Output:** `apps/contracts/target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm`
- **Size limit:** 1 MB (checked in CI)

### Build Steps

```bash
# Navigate to contracts directory
cd apps/contracts

# Check WASM target is installed
rustup target list --installed | grep wasm32

# Build the contract (optimized release build)
cargo build --target wasm32-unknown-unknown --release

# Verify output
ls -lh target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm
# Expected: ~100-500 KB file

# Check for size limit compliance
file_size=$(stat -f%z "target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm" 2>/dev/null || stat -c%s "target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm")
if [ $file_size -gt 1048576 ]; then
  echo "Error: Contract exceeds 1MB limit ($file_size bytes)"
  exit 1
fi
echo "✅ Contract size OK: $file_size bytes"
```

### Build Optimization Details

From `Cargo.toml`:

```toml
[profile.release]
opt-level = "z"              # Optimize for size
overflow-checks = true       # Security: check for overflows
debug = 0                    # Strip all debug info
strip = "symbols"            # Remove symbol table
debug-assertions = false
panic = "abort"              # Minimal panic handling
codegen-units = 1            # Better optimizations
lto = true                   # Link-time optimization
```

### Cargo Workspace Setup

```toml
# apps/contracts/Cargo.toml
[workspace]
resolver = "2"
members = ["contracts/*"]

[workspace.dependencies]
soroban-sdk = { version = "25.3.0", features = ["alloc"] }
```

All contract crates inherit dependencies from the workspace root.

### Contract Files Structure

```
apps/contracts/
├── Cargo.toml (workspace root)
├── Cargo.lock
├── contracts/
│   └── defi-rwa/           # Main contract crate
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs      # Contract logic
└── target/wasm32-unknown-unknown/release/
    └── real_estate_defi_contracts.wasm  (compiled output)
```

---

## Environment Configuration

### Database Setup

**For local development (PostgreSQL 16):**

```bash
# Using Docker (recommended for testing)
docker run -d --name akkuea-pg-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=akkuea_test \
  -p 5432:5432 \
  postgres:16

# Verify connection
psql -U test -h localhost -d akkuea_test -c "SELECT version();"
```

**Or install PostgreSQL locally:**

```bash
# macOS
brew install postgresql@16

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql-16

# Start service
sudo systemctl start postgresql
```

### API Environment Variables

**Required variables (for ANY deployment):**

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/akkuea_defi
DATABASE_POOL_MAX=10
DATABASE_SSL=false  # true in production

# API Server
PORT=3001
NODE_ENV=development  # or "production"
LOG_LEVEL=info        # debug|info|warn|error

# Security
WEBHOOK_SECRET=your-32-character-random-secret-string
OPERATIONS_BACKEND_CREDENTIAL=generate-with-openssl-rand-hex-32
OPERATIONS_ALLOWED_WALLETS=GXXX...,GYYY...  # production only

# Stellar / Soroban Network
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Stellar Admin Account (use testnet account for development)
STELLAR_ADMIN_PUBLIC_KEY=GXXX...  # 56 chars, starts with G
STELLAR_ADMIN_SECRET=SXXX...      # 56 chars, starts with S (KEEP SECRET!)

# Contracts
REAL_ESTATE_TOKEN_CONTRACT_ID=CXXX...  # 56 chars, starts with C
DEFI_RWA_CONTRACT_ID=CXXX...

# KYC
KYC_UPLOAD_DIR=/var/akkuea/kyc-uploads
# (or create locally: mkdir -p ./kyc-uploads && export KYC_UPLOAD_DIR=$(pwd)/kyc-uploads)

# Liquidation (optional)
LIQUIDATOR_API_KEY=generate-a-long-random-secret

# Notifications (optional)
NOTIFICATIONS_ENABLED=true
# NOTIFICATION_WEBHOOK_URL=https://your-delivery-endpoint.example.com/notifications
# NOTIFICATION_WEBHOOK_SECRET=change-me
# NOTIFICATION_POLL_INTERVAL_MS=5000
# NOTIFICATION_REQUEST_TIMEOUT_MS=10000

# Redis Caching (optional)
# REDIS_URL=redis://localhost:6379
```

**Network Passphrase Reference:**

| Network    | Passphrase                                       |
| ---------- | ------------------------------------------------ |
| Testnet    | `Test SDF Network ; September 2015`              |
| Mainnet    | `Public Global Stellar Network ; September 2015` |
| Standalone | `Standalone Network ; February 2017`             |

⚠️ **Note:** Exact spacing (including spaces before semicolons) is mandatory.

### Stellar Account Setup

```bash
# Generate a testnet account
stellar keys generate --network testnet --fund

# Get your public key
stellar keys address

# Get your secret key (use ONLY for development)
stellar keys show --network testnet

# Export for use in .env:
# STELLAR_ADMIN_PUBLIC_KEY=<output from "address">
# STELLAR_ADMIN_SECRET=<your secret key>
```

### Generate Random Secrets

```bash
# For WEBHOOK_SECRET, OPERATIONS_BACKEND_CREDENTIAL, etc.
# macOS
openssl rand -hex 32

# Linux
openssl rand -hex 32

# Or use a password manager / online tool
# Minimum: 32 characters of random alphanumeric data
```

---

## Running Services (Local Development)

### All Services Together

```bash
# Terminal 1: Start all services concurrently
bun run dev
# This runs:
#   - Frontend (Next.js) on http://localhost:3000
#   - Backend API (Elysia) on http://localhost:3001
```

### Individual Services

```bash
# Terminal 1: Frontend (Next.js)
cd apps/webapp
bun run dev
# Browser: http://localhost:3000

# Terminal 2: Backend API (Elysia)
cd apps/api
bun run dev
# Health check: curl http://localhost:3001/health
# API docs: http://localhost:3001/swagger
```

### Verification Checks

```bash
# 1. Frontend
curl http://localhost:3000
# Should return HTML for the landing page

# 2. API Health
curl http://localhost:3001/health
# Should return:
# {
#   "status": "ok",
#   "timestamp": "2026-01-06T...",
#   "version": "1.0.0"
# }

# 3. API Swagger Docs
open http://localhost:3001/swagger
# Interactive API documentation

# 4. Contract Compilation
cd apps/contracts
cargo build --target wasm32-unknown-unknown --release
ls -lh target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm
```

### Port Conflicts

```bash
# If ports 3000 or 3001 are in use, kill existing processes:

# macOS/Linux
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process

# Or use different ports:
PORT=3002 cd apps/api && bun run dev
PORT=3002 cd apps/webapp && bun run dev
```

---

## Running Against Testnet Contracts

### Prerequisites

1. **Deployed contracts on Testnet**
   - Requires running: `./scripts/deploy.sh testnet`
   - Requires funded Stellar account (see "Stellar Account Setup")

2. **Contract ID from deployment**
   - Save the `CONTRACT_ID` from deployment output
   - Set as `REAL_ESTATE_TOKEN_CONTRACT_ID` in `.env`

### Step 1: Deploy Contracts (One-Time Setup)

```bash
cd apps/contracts

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
ADMIN_ADDRESS=$(stellar keys address)
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  --admin $ADMIN_ADDRESS)

echo "Contract ID: $CONTRACT_ID"
# Copy this ID for .env configuration
```

### Step 2: Configure Environment for Testnet

Update `apps/api/.env` (or `.env.local`):

```env
# Network
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Admin account (testnet funded key)
STELLAR_ADMIN_PUBLIC_KEY=GXXX...
STELLAR_ADMIN_SECRET=SXXX...

# Contract from Step 1
REAL_ESTATE_TOKEN_CONTRACT_ID=CXXX...

# Database (still local)
DATABASE_URL=postgresql://test:test@localhost:5432/akkuea_test

# Other required vars remain the same
```

### Step 3: Set Up Oracle (MANDATORY)

⚠️ **Critical:** The oracle must be configured BEFORE any borrowing operations.

```bash
# From contract deployment output, run:
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function set_oracle \
  --arg '$ADMIN_ADDRESS'
```

If skipped, borrow attempts will fail with: `Oracle address not configured`.

### Step 4: Start Services

```bash
# Terminal 1: API
cd apps/api
bun run dev

# Terminal 2: Webapp
cd apps/webapp
bun run dev

# Terminal 3: Monitor contract calls
stellar contract invoke --help  # reference
```

### Monitoring Testnet Transactions

```bash
# Check account balance
stellar account get $ADMIN_ADDRESS --network testnet

# View recent transactions
stellar transaction list --account $ADMIN_ADDRESS --network testnet

# Check contract state
stellar contract inspect --contract-id $CONTRACT_ID --network testnet

# View contract events
stellar contract logs --contract-id $CONTRACT_ID --network testnet
```

---

## Full Test Suite

### Unit & Integration Tests - API

```bash
# Navigate to API workspace
cd apps/api

# Run all tests (default mode)
bun run test

# Run tests in CI mode (max-concurrency=1, for database isolation)
bun run test:ci

# Run specific test file
bun test src/__tests__/auth.test.ts
bun test src/__tests__/kyc.test.ts
bun test src/__tests__/lending.test.ts

# Run tests matching a pattern
bun test --match "*auth*"
bun test --match "*lending*"

# Run with coverage (if enabled)
bun test --coverage

# Watch mode (re-run on file changes)
bun test --watch
```

### Test Files Available

Located in `apps/api/src/__tests__/`:

- `auth.test.ts` - Authentication & wallet verification
- `CacheService.test.ts` - Redis caching layer
- `errors.test.ts` - Error handling
- `kyc.test.ts` - KYC workflow
- `lending.test.ts` - Lending pool operations
- `NotificationService.test.ts` - Notification delivery
- `notificationWorker.test.ts` - Background notification worker
- `positions.test.ts` - Lending position tracking
- `properties.test.ts` - Property tokenization
- `PropertyController.buyShares.test.ts` - Share purchase logic
- `PropertyController.getProperties.queries.test.ts` - Query validation
- `tokenization.test.ts` - Share minting/burning
- `webhooks.test.ts` - Webhook verification

### Test Database Setup for CI

```bash
# Option 1: Docker (automated)
docker run -d --name akkuea-pg-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=akkuea_test \
  -p 5432:5432 \
  postgres:16

# Option 2: PostgreSQL locally (if installed)
createdb -U postgres akkuea_test

# Run database migrations
cd apps/api
DATABASE_URL=postgresql://test:test@localhost:5432/akkuea_test bun run db:migrate

# Run tests
bun run test:ci
```

### Unit & Integration Tests - Webapp

```bash
cd apps/webapp

# Run all tests
bun test

# Watch mode
bun test --watch

# With coverage
bun test --coverage

# Specific test file
bun test src/components/__tests__/MyComponent.test.tsx
```

### Unit & Integration Tests - Shared

```bash
cd apps/shared

# Run tests for shared utilities
bun test

# Type coverage
bun run type-check
```

### Lint & Format Checks

```bash
# From root workspace
# Lint all workspaces
bun run lint
# Equivalent to:
# - cd apps/api && bun run lint
# - cd apps/webapp && bun run lint
# - cd apps/shared && bun run lint

# Type checking (all workspaces)
bun run typecheck

# Format checking (root only, via prettier)
bun run format

# Auto-fix formatting
bun run format
```

### Contract Tests (Rust)

```bash
cd apps/contracts

# Format check
cargo fmt --all -- --check

# Linting
cargo clippy --all-targets --all-features -- -D warnings

# Build (includes testing)
cargo build --target wasm32-unknown-unknown --release

# Run unit tests in contracts (if present)
cargo test
```

### Full Monorepo Test Suite

```bash
# Run all tests across all workspaces
bun test --workspaces

# Run all lints
bun run lint

# Run all type checks
bun run typecheck

# Format everything
bun run format

# Clean everything and reinstall
bun run clean
bun run install:all
```

---

## Build Scripts & CI Workflows

### Local Build Commands

```bash
# Build everything (API, webapp, shared)
bun run build
# Equivalent to:
# - cd apps/api && bun run build
# - cd apps/webapp && bun run build
# - cd apps/shared && bun run build

# Build individual workspaces
bun run build:api      # API to dist/
bun run build:webapp   # Webapp with Next.js
bun run build:shared   # Shared types to dist/

# Build contracts (Rust)
bun run build:contracts
# (runs ./scripts/build.sh)
```

### Build Artifacts

| Workspace | Input                 | Output                                         | Notes         |
| --------- | --------------------- | ---------------------------------------------- | ------------- |
| API       | `src/index.ts`        | `dist/index.js`                                | Bun bundle    |
| Webapp    | `src/app/`            | `.next/`                                       | Next.js build |
| Shared    | `src/index.ts`        | `dist/index.d.ts`, `dist/index.js`             | TS types + JS |
| Contracts | `contracts/defi-rwa/` | `target/wasm32-unknown-unknown/release/*.wasm` | WASM binary   |

### CI/CD Workflows

Located in `.github/workflows/`:

#### 1. **api-ci.yml** - API Quality & Security

Triggers: Push/PR to `main`/`develop` affecting `apps/api/**`

Steps:

- Setup Bun
- Install dependencies
- Type checking (`bun run type-check`)
- Linting (ESLint)
- Format check (Prettier)
- Build application
- Database migrations
- Integration tests (`bun run test:ci`)

Services: PostgreSQL 16

```bash
# Run locally to match CI
cd apps/api
bun run type-check
bun run lint
bun run format:check
bun run build
bun run test:ci
```

#### 2. **webapp-ci.yml** - WebApp Quality & Security

Triggers: Push/PR to `main`/`develop` affecting `apps/webapp/**`

Steps:

- Setup Bun
- Install dependencies
- Type checking
- ESLint linting
- Prettier format check
- Build application
- (Unit tests commented out)

```bash
# Run locally to match CI
cd apps/webapp
bun run type-check
bun run lint
bun run build
```

#### 3. **contracts-ci.yml** - Smart Contracts

Triggers: Push/PR to `main`/`develop` affecting `apps/contracts/**`

Runs on: macOS (for Homebrew Stellar CLI)

Steps:

- Install Rust (stable)
- Add WASM target
- Install Stellar CLI via Homebrew
- Cache Cargo registry
- Rust format check (`cargo fmt`)
- Clippy lints (`cargo clippy`)
- Build WASM (`cargo build --target wasm32-unknown-unknown --release`)
- Contract size check (must be ≤ 1 MB)

```bash
# Run locally to match CI
cd apps/contracts
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --target wasm32-unknown-unknown --release
# Check size
file_size=$(stat -c%s "target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm")
[ $file_size -le 1048576 ] && echo "✅ Size OK" || echo "❌ Exceeds 1 MB"
```

#### 4. **monorepo-ci.yml** - Monorepo Integrity

Triggers: Push/PR affecting any `apps/**`

Checks:

- Workspace consistency (all workspaces have `package.json`)
- Dependency consistency (cross-workspace references)
- TypeScript configuration validation

#### 5. **shared-ci.yml** - Shared Library

Steps:

- Type checking
- Linting
- Format checking
- Build

---

## Deployment & Production

### Pre-Deployment Checklist

```bash
# From docs/deployment/post-deploy-checklist.md
- [ ] NODE_ENV=production
- [ ] DATABASE_SSL=true (if using Postgres over network)
- [ ] STELLAR_NETWORK_PASSPHRASE matches target network exactly
- [ ] STELLAR_ADMIN_SECRET loaded from secrets manager, not hardcoded
- [ ] OPERATIONS_ALLOWED_WALLETS set with authorized admin addresses
- [ ] KYC_UPLOAD_DIR exists and is not publicly accessible
- [ ] .env file in .gitignore (verify: git check-ignore -v apps/api/.env)
- [ ] All services pass CI/CD workflows
- [ ] Contracts deployed to mainnet and verified on-chain
```

### Contract Deployment

```bash
# Testnet
./scripts/deploy.sh testnet

# Mainnet
./scripts/deploy.sh mainnet

# Specific contract (testnet)
./scripts/deploy.sh testnet real-estate-token
./scripts/deploy.sh testnet defi-lending
```

---

## Troubleshooting

### Common Issues

**Port 3000/3001 already in use:**

```bash
lsof -ti:3000 | xargs kill -9
# or
PORT=3002 bun run dev:api
```

**Database connection errors:**

```bash
# Check PostgreSQL is running
psql -U test -h localhost -d akkuea_test -c "SELECT 1"

# Verify DATABASE_URL in .env
# Format: postgresql://user:password@host:port/database
```

**Stellar CLI not found:**

```bash
# Re-install (takes time)
cargo install --locked stellar-cli --features opt

# Verify
stellar --version
```

**WASM target missing:**

```bash
rustup target add wasm32-unknown-unknown
rustup target list --installed
```

**Test failures with database:**

```bash
# Reset test database
docker rm -f akkuea-pg-test
docker run -d --name akkuea-pg-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=akkuea_test \
  -p 5432:5432 \
  postgres:16

# Re-migrate
cd apps/api
bun run db:migrate
```

### Stellar CLI Setup Issues

```bash
# Reset configuration
stellar config reset

# Verify network
stellar network info

# Import existing key
stellar keys import --name my-key

# Generate testnet account (with funding)
stellar keys generate --network testnet --fund
```

---

## References

- [Getting Started Guide](docs/guides/getting-started.md)
- [System Architecture](docs/architecture/system-architecture.md)
- [Contract Deployment](docs/deployment/deploy-contracts.md)
- [Environment Variables Reference](docs/deployment/environment-variables.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Stellar Developer Docs](https://developers.stellar.org)
- [Soroban Documentation](https://soroban.stellar.org)

---

## Summary

| Task              | Command                                              | Time      | Notes                        |
| ----------------- | ---------------------------------------------------- | --------- | ---------------------------- |
| Install tools     | See [Prerequisites](#prerequisites--versions)        | 10-30 min | Stellar CLI may take 5+ min  |
| Initial setup     | `bun run install:all`                                | 2-5 min   | First run only               |
| Build contracts   | `./scripts/build.sh`                                 | 1-2 min   | Requires WASM target         |
| Build all         | `bun run build`                                      | 2-3 min   | API, webapp, shared          |
| Run locally       | `bun run dev`                                        | N/A       | Runs API + webapp            |
| Full test suite   | `bun test --workspaces`                              | 5-10 min  | All unit & integration tests |
| Deploy to testnet | `./scripts/deploy.sh testnet`                        | 3-5 min   | Requires funded account      |
| CI checks locally | `bun run lint && bun run typecheck && bun run build` | 2-3 min   | Matches GitHub Actions       |
