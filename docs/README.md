# Real Estate DeFi Platform Documentation

Welcome to the comprehensive documentation for the Real Estate Tokenization and DeFi Lending Platform on Stellar.

## 🏗️ Platform Overview

This platform combines two powerful concepts:

1. **Real Estate Tokenization** - Fractional ownership of properties through blockchain tokens
2. **DeFi Lending** - Privacy-configurable lending pools using tokenized real estate as collateral

## 📚 Documentation Sections

### 🚀 Quick Start

- [Getting Started](./guides/getting-started.md)

### 🏗️ Architecture

- [System Architecture](./architecture/system-architecture.md)

### 🚢 Deployment

> Start here for any production or testnet launch.

- [Environment Variables](./deployment/environment-variables.md) — complete `.env` reference, secret warnings, network passphrases
- [Deploy Contracts](./deployment/deploy-contracts.md) — build, deploy, oracle setup, pool creation, role grants
- [Post-Deploy Checklist](./deployment/post-deploy-checklist.md) — Day 0 action list: liveness, oracle, roles, pool, API verification

### 🌐 API Workflows

> Step-by-step flows for platform integrators and operators.

- [API Overview](./api/overview.md) — framework, authentication, rate limiting
- [Launch Workflows](./api/launch-workflows.md) — end-to-end HTTP sequences with full payloads: KYC onboarding, property tokenization, share purchase
- [Minting Workflow](./api/minting-workflow.md) — deep dive: tokenization path from HTTP request to on-chain `mint_shares`
- [KYC Workflow](./api/kyc-workflow.md) — off-chain compliance state machine, admin verification procedure, known gaps

### 🔥 Operations Runbooks

> Use these documents during incidents. Read them before an incident occurs.

- [Emergency Pause Runbook](./operations/runbook-emergency-pause.md) — immediate pause, 24-hour timelock recovery, exact CLI commands
- [Oracle Failure Runbook](./operations/runbook-oracle-failure.md) — price feed outage, stale data response, backup oracle switch
- [Role Management Runbook](./operations/runbook-role-management.md) — grant/revoke EmergencyGuard, admin transfer procedure
- [Dividend Distribution](./operations/runbook-dividends-placeholder.md) — placeholder pending Issue #722

### 🔧 Legacy Contract Docs

> These documents predate the current codebase and contain outdated file paths. Kept for historical context only.

- [Contract Deployment (outdated)](./contracts/deployment.md) — superseded by `deployment/deploy-contracts.md`

## 🛠️ Technology Stack

- **Blockchain**: Stellar Network
- **Smart Contracts**: Soroban (Rust)
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Elysia (Bun), TypeScript
- **Package Manager**: Bun
- **CI/CD**: GitHub Actions

## 🔗 Quick Links

- **GitHub Repository**: [Platform Code](https://github.com/your-org/real-estate-defi-platform)
- **API Documentation**: [Live API Docs](http://localhost:3001/swagger)
- **Stellar Documentation**: [Stellar Developers](https://developers.stellar.org/)
- **Soroban Documentation**: [Soroban Docs](https://soroban.stellar.org/)

## 📞 Support

For technical support or questions:

- Create an issue in the GitHub repository
- Join our community Discord
- Check the FAQ section

## 🔄 Version History

- **v1.0.0**: Initial release with core functionality
  - Real estate tokenization
  - DeFi lending pools
  - KYC integration
  - Basic frontend and API

---

_This documentation is continuously updated. Last updated: March 2026_
