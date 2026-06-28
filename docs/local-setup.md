# Local Development Setup Guide

This guide provides step-by-step instructions to set up the Akkuea development environment on your local machine.

## Prerequisites

Ensure you have the following installed:

### 1. Bun

Bun is the primary runtime and package manager used in this project.

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Docker

Docker is required to run the database and caching services locally.

- [Install Docker](https://docs.docker.com/get-docker/)

### 3. Rust & Soroban CLI (Optional)

Required only if you intend to work on smart contracts.

- [Install Rust](https://www.rust-lang.org/tools/install)
- [Install Soroban CLI](https://soroban.stellar.org/docs/install)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/akkuea/akkuea.git
cd akkuea
```

### 2. Install Dependencies

Install all dependencies across the monorepo:

```bash
bun install
```

### 3. Environment Configuration

You need to set up environment variables for the API and Webapp.

#### API Configuration

```bash
cp apps/api/.env.example apps/api/.env
```

**Key Variables in `apps/api/.env`:**

- `DATABASE_URL`: Connection string for PostgreSQL (default: `postgresql://user:password@localhost:5432/akkuea_defi`).
- `PORT`: The port on which the API will run (default: `3001`).
- `OPERATIONS_BACKEND_CREDENTIAL`: A secret key used for internal admin operations. **Must match the value in `apps/webapp/.env`**.
- `REDIS_URL`: (Optional) Connection string for Redis caching (`redis://localhost:6379`).
- `STELLAR_NETWORK`: Set to `testnet` or `mainnet`.
- `LIQUIDATOR_API_KEY` & `INTERNAL_API_KEY`: Secrets for restricted API endpoints.

#### Webapp Configuration

```bash
cp apps/webapp/.env.example apps/webapp/.env.local
```

**Key Variables in `apps/webapp/.env.local`:**

- `NEXT_PUBLIC_API_URL`: The public URL of your local API (e.g., `http://localhost:3001`).
- `API_URL`: The server-side URL of your local API (e.g., `http://localhost:3001`).
- `OPERATIONS_BACKEND_CREDENTIAL`: **Must match the value in `apps/api/.env`**.
- `OPERATIONS_ALLOWED_WALLETS`: Comma-separated list of Stellar addresses allowed to access admin operations.
- `NEXT_PUBLIC_USE_MOCK`: Set to `true` to use mock data instead of the actual API.

---

## Running the Project

### 1. Start Backend Services

Use Docker Compose to start PostgreSQL and Redis:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. Initialize Database

If this is your first time running the project, run the migrations:

```bash
cd apps/api
bun run db:migrate
cd ../..
```

### 3. Start the Applications

You will need to run each application in a separate terminal window or use a process manager.

**Run API:**

```bash
cd apps/api && bun run dev
```

**Run Webapp:**

```bash
cd apps/webapp && bun run dev
```

**Run Akkuea Land (Game):**

```bash
cd apps/akkuea-land && bun run dev
```

---

## Testing

To run the test suite across the entire project:

```bash
bun test
```
