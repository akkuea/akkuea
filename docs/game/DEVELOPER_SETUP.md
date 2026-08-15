# Akkuea Land: Developer Setup Guide

This guide walks you through setting up Akkuea Land for local development. All commands are copy-pasteable and tested.

## Prerequisites

Install these tools in order:

### 1. Git

```bash
git --version  # Verify you have it
```

### 2. Node.js and Bun

```bash
# Install Node.js 18.0.0 or later
node --version  # Check your version

# Install Bun (package manager and runtime)
curl -fsSL https://bun.sh/install | bash
bun --version  # Should be 1.2.23 or higher
```

### 3. Rust (for contracts)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WebAssembly compilation target
rustup target add wasm32-unknown-unknown

# Verify installation
rustc --version && cargo --version
```

### 4. PostgreSQL 16 (for database)

```bash
# On Windows with Chocolatey:
choco install postgresql16

# Or download from https://www.postgresql.org/download/windows/

# Start the server and create test database:
psql -U postgres -c "CREATE DATABASE akkuea_dev;"
psql -U postgres -c "CREATE DATABASE akkuea_test;"
```

### 5. Stellar CLI (for contract deployment)

```bash
# This takes ~5 minutes
cargo install --locked stellar-cli --features opt

# Verify
stellar --version
```

## Clone and Setup the Project

```bash
# Clone the repository
git clone https://github.com/akkuea/akkuea.git
cd akkuea

# Install all dependencies
bun install
```

## Environment Configuration

Create `.env.local` in the root:

```bash
# Database (required for API)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/akkuea_dev

# Stellar testnet account (generate with `stellar keys generate`)
STELLAR_ADMIN_SECRET=your_secret_key_here
STELLAR_ADMIN_PUBLIC_KEY=your_public_key_here

# Network
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# API port (default shown)
PORT=3001
```

> Game contract IDs go in `apps/akkuea-land/.env.local`, not the root `.env.local` above - see [Game Contracts Deployment](../deployment/deploy-game-contracts.md). All four (`NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID`, `NEXT_PUBLIC_PROPERTY_NFT_CONTRACT_ID`, `NEXT_PUBLIC_LAND_TOKEN_CONTRACT_ID`, `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID`) are optional - unset values fall back to the checked-in `apps/shared/src/contracts/game-contracts.testnet.json` deployment.

### Generate a Stellar Testnet Account

```bash
# Create a new keypair
stellar keys generate --name test-account

# Fund it from the Stellar testnet faucet
# Go to https://laboratory.stellar.org/#account-creator
# Or use the faucet API:
curl "https://friendbot.stellar.org?addr=$(stellar keys show test-account --public-key)"

# Show your keys
stellar keys show test-account --private-key
stellar keys show test-account --public-key
```

## Development Workflows

### Option 1: API + Webapp with Mock Data (Fastest)

Run the frontend and API with mock data-no contracts needed.

```bash
# Install dependencies (one time)
bun install

# Start both services
bun run dev

# In your browser:
# - Webapp: http://localhost:3000
# - API: http://localhost:3001
# - API Docs: http://localhost:3001/swagger
```

Health check:

```bash
curl http://localhost:3001/health
```

### Option 2: Run Contracts Locally in Tests

Test the Soroban contracts without deployment.

```bash
cd apps/contracts

# Build the contracts
cargo build --target wasm32-unknown-unknown --release

# Run the contract test suite
cargo test --target wasm32-unknown-unknown

# Full output
cargo test -- --nocapture
```

Contract binaries output to: `target/wasm32-unknown-unknown/release/`

### Option 3: Deploy Akkuea Land's contracts to Stellar Testnet

Deploy the four game contracts to testnet for full integration testing. Full walkthrough: [Game Contracts Deployment](../deployment/deploy-game-contracts.md).

```bash
# From the repo root - generates and funds a game-deployer identity automatically
./scripts/deploy-game-contracts.sh testnet game-deployer

# The script prints a ready-to-paste apps/akkuea-land/.env.local block
# with all four NEXT_PUBLIC_*_CONTRACT_ID values.
```

The existing `defi-rwa` platform contract (fractional shares + lending) has its own, separate deployment guide: [`docs/deployment/deploy-contracts.md`](../deployment/deploy-contracts.md). Its oracle setup step does not apply to the game contracts.

**After deployment**, contract IDs are also recorded in `apps/shared/src/contracts/game-contracts.testnet.json` - the frontend falls back to that file automatically if the env vars are unset.

### Option 4: Run the Full Test Suite

Run all tests across the monorepo with CI-like database setup.

```bash
# Start a fresh test database (Docker recommended)
docker run -d \
  --name akkuea-pg-test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=akkuea_test \
  -p 5432:5432 \
  postgres:16

# Set test database URL
export DATABASE_URL=postgres://test:test@localhost:5432/akkuea_test

# Run all tests
bun test --workspaces

# Or test a specific package
cd apps/api && bun run test:ci

# Stop the test database
docker stop akkuea-pg-test && docker rm akkuea-pg-test
```

Test suite covers:

- Authentication & KYC
- Lending & positions
- Properties & marketplace
- Notifications
- Cache service

### Option 5: Run Linting and Type Checking

```bash
# Type check all workspaces
bun run typecheck

# Lint all code
bun run lint

# Format code
bun run format

# Check contracts code quality
cd apps/contracts && cargo fmt --check && cargo clippy
```

## Project Structure

```
akkuea/
├── apps/
│   ├── api/              # Elysia/Bun backend API
│   ├── contracts/        # Soroban smart contracts (Rust)
│   ├── shared/           # Shared types and schemas
│   ├── webapp/           # Next.js frontend - existing platform build
│   └── akkuea-land/      # Next.js frontend - this game
├── docs/
│   ├── strategy/         # Canonical product direction
│   ├── local-setup.md    # General local setup guide
│   └── game/             # This guide + game rules
├── scripts/              # Build and deployment scripts
└── package.json          # Monorepo root
```

## Common Commands

| Command                           | What it does             |
| --------------------------------- | ------------------------ |
| `bun install`                     | Install all dependencies |
| `bun run dev`                     | Start API and webapp     |
| `bun run dev:api`                 | Start API only           |
| `bun run dev:webapp`              | Start webapp only        |
| `bun test --workspaces`           | Run all tests            |
| `bun run lint`                    | Check code style         |
| `bun run typecheck`               | Type-check TypeScript    |
| `bun run format`                  | Auto-format code         |
| `cd apps/contracts && cargo test` | Test contracts           |

## Troubleshooting

### "Cannot find module '@akkuea/shared'"

```bash
# Rebuild the shared package
cd apps/shared && bun run build
bun install
```

### Database connection error

```bash
# Check PostgreSQL is running and database exists
psql -U postgres -c "\l" | grep akkuea_dev

# If missing, create it:
psql -U postgres -c "CREATE DATABASE akkuea_dev;"

# Reset the database (warning: deletes all data)
cd apps/api && bun run db:reset
```

### Contract build fails

```bash
# Update Rust
rustup update

# Add WebAssembly target
rustup target add wasm32-unknown-unknown

# Clean and rebuild
cd apps/contracts && cargo clean && cargo build --target wasm32-unknown-unknown --release
```

### "Stellar CLI not found"

```bash
# Install Stellar CLI (takes ~5 minutes)
cargo install --locked stellar-cli --features opt
```

### Game contract errors (`NothingToClaim`, `NotOwner`, `NotListed`, ...)

The game contracts don't use an oracle - that's specific to the separate `defi-rwa` platform contract. For game-contract error codes and fixes (income not yet accrued, wrong signing wallet, marketplace listing state), see the troubleshooting table in [Game Contracts Deployment](../deployment/deploy-game-contracts.md).

## Next Steps

1. **Explore the API**: Open http://localhost:3001/swagger to see available endpoints
2. **Check the codebase**: Start with `apps/shared/src/types/` to understand the data models
3. **Read the architecture**: See `docs/architecture/system-architecture.md`
4. **Submit a PR**: See `CONTRIBUTING.md` for the workflow

---

**Stuck?** Check the [local setup guide](../local-setup.md) or open an issue on GitHub.
