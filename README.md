<div align="center">

# Akkuea

**Tokenized real estate income, one allied agency at a time - on Stellar**

[![Monorepo CI](https://github.com/akkuea/akkuea/actions/workflows/monorepo-ci.yml/badge.svg)](https://github.com/akkuea/akkuea/actions/workflows/monorepo-ci.yml)
[![API CI](https://github.com/akkuea/akkuea/actions/workflows/api-ci.yml/badge.svg)](https://github.com/akkuea/akkuea/actions/workflows/api-ci.yml)
[![Webapp CI](https://github.com/akkuea/akkuea/actions/workflows/webapp-ci.yml/badge.svg)](https://github.com/akkuea/akkuea/actions/workflows/webapp-ci.yml)
[![Contracts CI](https://github.com/akkuea/akkuea/actions/workflows/contracts-ci.yml/badge.svg)](https://github.com/akkuea/akkuea/actions/workflows/contracts-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Someone priced out of buying a house outright can invest a smaller amount through Akkuea and earn proportionally to what they put in - with an on-chain record of what was collected and distributed. Akkuea is a tokenization-as-a-service pilot: one allied real estate agency issues a tokenized right to a share of a specific property's rental income, investors buy in at whatever size they choose, and distribution runs through Akkuea's own payout-split contract on Stellar.

[Strategy](docs/strategy/product-brief.md) · [Getting Started](#getting-started) · [Architecture](#architecture) · [Tech Stack](#tech-stack) · [Contributing](CONTRIBUTING.md) · [Docs](docs/)

</div>

---

## Overview

**Read [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md) first.** It is this project's canonical source of product direction - where anything below describes the product differently, the strategy docs win.

In short: Akkuea's near-term product is a single-ally pilot, not a general platform. An allied real estate agency's rental-income right for one property is issued as a **non-transferable revenue-participation token** (not fractional equity or title - a deliberately lighter legal category). Investors buy in, hold their tokens in their own Stellar wallet, and receive a pro-rata share of each monthly income distribution after a transparent 10% platform fee. Income evidence is human-reviewed and referenced on-chain as a link plus a cryptographic hash, so the product is honestly described as **verifiable/auditable, not "trustless."** See [`docs/strategy/`](docs/strategy/) for the full brief, roadmap (including the parallel treasury track using DeFindex and EtherFuse), integration-verification matrix, and decision log.

This repository also contains a **substantially larger platform build that predates that pilot scoping**: a `defi-rwa` contract with fractional property-share tokenization and a full collateralized DeFi lending protocol (pools, oracle valuation, liquidation), a general KYC engine, and a tile-based property game (`apps/akkuea-land`). That work is real and documented in detail below and under `docs/api/`, `docs/architecture/`, `docs/deployment/`, and `docs/operations/` - it just isn't the pilot's critical path. `apps/akkuea-land` is the one piece kept front-and-center: it's repositioned as the pilot's visual, playable companion, letting someone feel the buy-property → earn-income → claim-income loop before real capital is involved.

---

## Features

> The features below describe the **existing platform build** (fractional shares + DeFi lending), not the pilot's own, smaller contract surface (income-participation token + whitelist + payout-split). See [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md#relationship-to-the-existing-platform-build) for how the two relate.

### Real Estate Tokenization (existing platform build)

- Fractional share ownership of individual properties, tracked entirely on-chain
- KYC/AML compliance enforced at the smart contract level
- Minting and burning controls with role-gated admin operations
- Property metadata storage with immutable audit history

### DeFi Lending Protocol (existing platform build)

- Collateralized borrowing using tokenized real estate shares
- Privacy-configurable lending pools for institutional participants
- Automated interest calculation and liquidation mechanisms
- Oracle-integrated asset valuation for accurate collateral ratios

### Akkuea Land - the pilot's visual companion

- Tile-based property simulation (`apps/akkuea-land`) mirroring the pilot's real mechanics: buy a property, earn income over time, claim it, trade on a marketplace
- Fully on-chain on Stellar testnet (four Soroban contracts) - see [`docs/game/`](docs/game/)
- Built to make the pilot's flow tangible before real capital is involved, not a separate product line

### Compliance & Security

- Wallet-based authentication via Stellar signatures - no passwords, no centralized auth
- Role-based access control across admin, operator, and user tiers
- Webhook signature verification for all external integrations
- Rate limiting, input sanitization, and structured audit logging throughout the API

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Akkuea Platform                          │
│                                                                  │
│  ┌─────────────────┐   ┌─────────────────┐   ┌───────────────┐  │
│  │   Web Frontend  │   │   Backend API   │   │Smart Contracts│  │
│  │  Next.js + React│◄──►│  Elysia / Bun  │◄──►│  Soroban/Rust │  │
│  │  localhost:3000 │   │  localhost:3001 │   │Stellar Network│  │
│  └────────┬────────┘   └────────┬────────┘   └───────────────┘  │
│           │                     │                                │
│           └──────────┬──────────┘                               │
│                      ▼                                           │
│            ┌──────────────────┐                                  │
│            │  Shared Library  │                                  │
│            │ Types · Utils    │                                  │
│            │ Validation · SDK │                                  │
│            └──────────────────┘                                  │
└──────────────────────────────────────────────────────────────────┘
```

The repository is a **Bun monorepo** with four `bun` workspaces, plus the Rust contracts workspace built separately:

| Workspace                         | Path               | Role                                                                                                            |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `@akkuea/webapp`                  | `apps/webapp`      | Next.js 16 frontend with React 19 - the existing platform build                                                 |
| `@akkuea/api`                     | `apps/api`         | Elysia REST API running on Bun                                                                                  |
| `@akkuea/shared`                  | `apps/shared`      | Types, utilities, and Stellar SDK helpers shared across workspaces                                              |
| `@akkuea/akkuea-land`             | `apps/akkuea-land` | Next.js frontend for the tile-based game - the pilot's visual companion                                         |
| Contracts (not a `bun` workspace) | `apps/contracts`   | Soroban smart contracts written in Rust - both the existing `defi-rwa` contract and the four `game-*` contracts |

The pilot's own contract surface (income-participation token, whitelist, payout-split) is being built inside `apps/contracts` alongside the existing `defi-rwa` contract - see [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md) for why they're kept separate rather than reusing `defi-rwa`.

### Data Flows

The flows below describe the **existing platform build** (`defi-rwa` contract). The pilot's own flow (evidence submission → review → payout-split distribution) is diagrammed in [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md).

**Property Tokenization**

```
User submits property → Frontend validates → API verifies KYC
→ Soroban contract mints shares → Event emitted → API indexes
→ Frontend reflects updated portfolio
```

**DeFi Borrowing**

```
User requests loan → Frontend calculates available collateral
→ API checks on-chain share balance → Contract validates collateral ratio
→ Contract disburses funds → Frontend updates lending position
```

---

## Tech Stack

| Layer                  | Technology                                                      |
| ---------------------- | --------------------------------------------------------------- |
| **Frontend**           | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, Zod  |
| **Backend API**        | Elysia, Bun runtime, TypeScript, Drizzle ORM, Zod               |
| **Database**           | PostgreSQL (Drizzle migrations), Redis (optional caching layer) |
| **Smart Contracts**    | Rust, Soroban SDK 25, WASM compilation target                   |
| **Blockchain**         | Stellar (Testnet / Mainnet), Horizon REST API, Soroban RPC      |
| **Wallet Integration** | `@creit.tech/stellar-wallets-kit`                               |
| **Testing**            | `bun test`, `@testing-library/react`                            |
| **CI/CD**              | GitHub Actions (5 independent workflow files)                   |
| **Tooling**            | Bun 1.2+, ESLint 9, Prettier, Concurrently                      |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- Docker (for PostgreSQL + Redis)

### Install

```bash
git clone https://github.com/akkuea/akkuea.git
cd akkuea
bun install
```

### Run

```bash
# Copy environment variables
cp apps/api/.env.example apps/api/.env
cp apps/webapp/.env.example apps/webapp/.env.local

# Start services
docker compose -f docker-compose.dev.yml up -d

# Start all apps
bun run dev
```

See [docs/local-setup.md](docs/local-setup.md) for full setup instructions.

---

## Available Scripts

Run from the repository root:

| Script                     | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `bun run dev`              | Start frontend and API concurrently            |
| `bun run build`            | Build all workspaces                           |
| `bun run test`             | Run all workspace test suites                  |
| `bun run lint`             | Lint all workspaces                            |
| `bun run typecheck`        | Type-check all workspaces                      |
| `bun run format`           | Format all files with Prettier                 |
| `bun run clean`            | Remove all build artifacts and `node_modules`  |
| `bun run build:contracts`  | Build Soroban contracts via `scripts/build.sh` |
| `bun run deploy:contracts` | Deploy contracts via `scripts/deploy.sh`       |

---

## Environment Variables

All required environment variables are documented in [`docs/deployment/environment-variables.md`](docs/deployment/environment-variables.md). The source of truth is `apps/api/.env.example`.

Key categories:

- **Database** - PostgreSQL connection string and pool settings
- **API Server** - Port, environment, log level
- **Security** - Webhook secret, operations credential, allowed admin wallets
- **Stellar / Soroban** - Horizon URL, RPC URL, network passphrase, admin keypair, contract IDs
- **KYC** - Upload directory for compliance documents

> **Security note:** Never commit `.env` files. `STELLAR_ADMIN_SECRET` is a root credential - treat it like a private key and load it from a secrets manager in production.

---

## CI/CD

Akkuea runs five independent GitHub Actions workflows on every push and pull request to `main` and `develop`:

| Workflow  | File               | Checks                                                                                                |
| --------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| Monorepo  | `monorepo-ci.yml`  | Workspace integrity, dependency audit, bundle sizes, cross-workspace integration, security compliance |
| API       | `api-ci.yml`       | Lint, type-check, unit tests, build                                                                   |
| Webapp    | `webapp-ci.yml`    | Lint, type-check, unit tests, build                                                                   |
| Shared    | `shared-ci.yml`    | Lint, type-check, build                                                                               |
| Contracts | `contracts-ci.yml` | Rust format, Clippy, unit tests, WASM build                                                           |

All five workflows must pass before any pull request can be merged.

---

## Project Structure

```
akkuea/
├── apps/
│   ├── api/              # Elysia/Bun backend API
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── db/
│   │   │   └── workers/
│   │   └── drizzle/      # Database migrations
│   ├── webapp/           # Next.js frontend - existing platform build
│   │   └── src/
│   │       ├── app/      # App Router pages and layouts
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types/
│   ├── akkuea-land/      # Next.js frontend - the pilot's visual companion (game)
│   ├── contracts/        # Soroban smart contracts (Rust)
│   │   └── contracts/
│   │       ├── defi-rwa/          # Existing platform build (fractional shares + lending)
│   │       ├── game-property-nft/ # Akkuea Land
│   │       ├── game-land-token/
│   │       ├── game-engine/
│   │       └── game-marketplace/
│   └── shared/           # Shared TypeScript library
├── docs/
│   ├── strategy/         # Canonical product direction - read this first
│   ├── design-system/    # Visual/interaction system
│   ├── api/              # API endpoint documentation (existing platform build)
│   ├── architecture/     # System design documents
│   ├── deployment/       # Deployment and environment guides
│   ├── game/             # Akkuea Land rules, economy, and setup
│   ├── operations/       # Runbooks for production operations
│   └── testing/          # Testing strategy and smoke tests
├── scripts/              # Build and deployment shell scripts
└── .github/
    └── workflows/        # GitHub Actions CI definitions
```

---

## Documentation

| Document                                                                               | Description                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md)                     | Canonical product direction - read first          |
| [`docs/strategy/roadmap.md`](docs/strategy/roadmap.md)                                 | Phase 1a/1b/2 roadmap, jurisdiction, partnerships |
| [`docs/design-system/README.md`](docs/design-system/README.md)                         | Visual/interaction system                         |
| [`docs/local-setup.md`](docs/local-setup.md)                                           | Full local setup walkthrough                      |
| [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) | System design and component breakdown             |
| [`docs/deployment/environment-variables.md`](docs/deployment/environment-variables.md) | Complete environment variable reference           |
| [`docs/deployment/deploy-contracts.md`](docs/deployment/deploy-contracts.md)           | Contract deployment to Stellar networks           |
| [`docs/api/overview.md`](docs/api/overview.md)                                         | API overview and authentication                   |
| [`docs/api/minting-workflow.md`](docs/api/minting-workflow.md)                         | Property tokenization API flow                    |
| [`docs/api/kyc-workflow.md`](docs/api/kyc-workflow.md)                                 | KYC verification API flow                         |
| [`docs/game/GAME_RULES.md`](docs/game/GAME_RULES.md)                                   | Akkuea Land rules                                 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                                   | Contribution workflow and standards               |

---

## Contributing

We welcome contributions. Akkuea uses a **fork-based workflow** - all changes must come through a fork and pull request. No direct pushes to `main` or `develop`.

Read the full contribution guide before submitting your first pull request: **[CONTRIBUTING.md](CONTRIBUTING.md)**

---

## License

[MIT](LICENSE) - Acachete Labs
