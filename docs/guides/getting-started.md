# Getting Started

Welcome to the Real Estate DeFi Platform! This guide will help you get up and running quickly.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Tools

- **Bun** (v1.0.0+) - Package manager and runtime
- **Node.js** (v18.0.0+) - For frontend development
- **Rust** (latest) - For contract development
- **Stellar CLI** (latest) - For blockchain operations
- **Git** - Version control

### Optional but Recommended

- **VS Code** with extensions:
  - Rust Analyzer
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - Elysia.js (for API development)

## Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/real-estate-defi-platform.git
cd real-estate-defi-platform
```

### 2. Install Dependencies

```bash
# Install all dependencies for all workspaces
bun install:all

# Alternatively, install step by step
bun install
bun install --workspaces
```

### 3. Set Up Stellar CLI

```bash
# Install Stellar CLI (if not already installed)
curl -sSf https://raw.githubusercontent.com/stellar/stellar-cli/main/install.sh | sh

# Configure your identity (for testnet)
stellar keys generate --network testnet

# Verify setup
stellar keys address
```

### 4. Start Development Environment

```bash
# Start all services
bun run dev

# Or start individually
bun run dev:webapp  # Frontend on http://localhost:3000
bun run dev:api     # Backend API on http://localhost:3001
```

## Verification Steps

### 1. Check Frontend

Visit http://localhost:3000 - You should see the landing page.

### 2. Check API

Visit http://localhost:3001/health - You should see:

```json
{
  "status": "ok",
  "timestamp": "2026-01-06T...",
  "version": "1.0.0"
}
```

### 3. Check API Documentation

Visit http://localhost:3001/swagger - You should see the API documentation.

### 4. Test Smart Contracts

```bash
cd apps/contracts
cargo build --target wasm32-unknown-unknown --release
```

## Next Steps

1. **Read Architecture Documentation**: Understand the system design
2. **Configure Environment**: Set up your testnet/mainnet environment
3. **Deploy Contracts**: Deploy smart contracts to your preferred network
4. **Integrate Frontend**: Connect the frontend to your deployed contracts
5. **Set Up KYC**: Configure KYC provider for compliance

## Common Issues

### Port Conflicts

If ports 3000 or 3001 are already in use:

```bash
# Kill existing processes
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Or use different ports
PORT=3002 bun run dev:api
```

### Stellar CLI Issues

If Stellar CLI commands fail:

```bash
# Ensure you're on the correct network
stellar network info

# Reset configuration if needed
stellar config reset
```

### Dependency Issues

If you encounter dependency conflicts:

```bash
# Clean and reinstall
bun run clean
bun install:all
```

## Need Help?

- Check our [FAQ](./faq.md)
- Review [Common Issues](../deployment/troubleshooting.md)
- Create an issue on GitHub
- Join our Discord community

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# API Configuration
API_PORT=3001
API_HOST=localhost

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=testnet

# Optional: KYC Provider
KYC_PROVIDER_API_KEY=your_api_key_here
KYC_WEBHOOK_SECRET=your_webhook_secret
```

Congratulations! You're now ready to start developing with the Real Estate DeFi Platform. 🎉
