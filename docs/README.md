# Akkuea Documentation

Welcome to Akkuea's documentation. **Start with [`strategy/product-brief.md`](strategy/product-brief.md)** - it's the canonical source of product direction. Everything else in this folder either documents the existing platform build (real, working, but predating the pilot's scoping) or the pilot's own visual companion (Akkuea Land).

## 🧭 Strategy - read this first

- [Product Brief](strategy/product-brief.md) - the pilot: problem, solution, scope, success criteria
- [Roadmap](strategy/roadmap.md) - Phase 1a (treasury) / Phase 1b (core pilot) / Phase 2 (expansion)
- [Integration Decisions](strategy/integration-decisions.md) - verification matrix (DeFindex, EtherFuse, Trustless Work, Spydra)
- [Decision Log](strategy/decision-log.md) - chronological record of how the strategy was reached
- [Recommendations](strategy/recommendations.md) - independent follow-on analysis

## 🎨 Design System

- [Overview](design-system/README.md) - principles, what "auditable" looks like in the UI
- [Foundations](design-system/foundations.md) - color tokens, typography, effects
- [Components](design-system/components.md) - component inventory and conventions

## 🚀 Quick Start

- [Local Setup](local-setup.md) - clone, install, configure, run

## 🏗️ Architecture

- [System Architecture](architecture/system-architecture.md) - monorepo structure and component breakdown for the existing platform build

## 🚢 Deployment

> Start here for any production or testnet launch of the existing `defi-rwa` platform contract. Akkuea Land has its own deployment guide (below).

- [Environment Variables](deployment/environment-variables.md) (see also: [Environment Setup Guide](ENV_SETUP.md)) - complete `.env` reference, secret warnings, network passphrases
- [Deploy Contracts](deployment/deploy-contracts.md) - build, deploy, oracle setup, pool creation, role grants
- [Post-Deploy Checklist](deployment/post-deploy-checklist.md) - Day 0 action list: liveness, oracle, roles, pool, API verification
- [Deployment Records](contracts/deployment.md) - testnet/mainnet contract IDs and the mainnet approval checklist

## 🌐 API Workflows

> Step-by-step flows for the **existing platform build** (fractional shares + lending). The pilot's own API surface (evidence submission, whitelist review, payout-split) doesn't exist yet - see [`strategy/product-brief.md`](strategy/product-brief.md) for its intended shape.

- [API Overview](api/overview.md) - framework, authentication, rate limiting
- [Launch Workflows](api/launch-workflows.md) - end-to-end HTTP sequences with full payloads: KYC onboarding, property tokenization, share purchase
- [Minting Workflow](api/minting-workflow.md) - deep dive: tokenization path from HTTP request to on-chain `mint_shares`
- [KYC Workflow](api/kyc-workflow.md) - off-chain compliance state machine, admin verification procedure, known gaps

## 🎮 Akkuea Land - the pilot's visual companion

- [Game Rules](game/GAME_RULES.md) - player-facing rules
- [Economy Specification](game/ECONOMY.md) - the numeric constants and mechanics, canonically enforced on-chain
- [Developer Setup](game/DEVELOPER_SETUP.md) - local dev environment for `apps/akkuea-land`
- [Game Contracts Deployment](deployment/deploy-game-contracts.md) - deploying the four game contracts to testnet

## 🔥 Operations Runbooks

> Use these documents during incidents on the existing `defi-rwa` platform contract. Read them before an incident occurs.

- [Emergency Pause Runbook](operations/runbook-emergency-pause.md) - immediate pause, 24-hour timelock recovery, exact CLI commands
- [Oracle Failure Runbook](operations/runbook-oracle-failure.md) - price feed outage, stale data response, backup oracle switch
- [Role Management Runbook](operations/runbook-role-management.md) - grant/revoke EmergencyGuard, admin transfer procedure
- [Dividend Distribution](operations/runbook-dividends-placeholder.md) - placeholder pending Issue #722

## 🧪 Testing & Other Guides

- [Smoke Tests & Test Fixtures](testing/smoke-tests.md)
- [Accessibility Checklist](a11y-checklist.md) - marketplace and lending flows
- [3D Property Capture Guide](guides/property-3d-capture.md) - Gaussian Splatting property viewer

## 📋 Planning

- [Issue Creation Guide](planning/ISSUE_CREATION_GUIDE.md)
- [Completed Work Log](planning/completed/COMPLETED_WORK.md)
- [Development Cycles](planning/cycles/) - historical per-cycle issue records

## 🛠️ Technology Stack

- **Blockchain**: Stellar Network (Testnet / Mainnet)
- **Smart Contracts**: Soroban (Rust)
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Elysia (Bun), TypeScript, Drizzle ORM
- **Package Manager**: Bun
- **CI/CD**: GitHub Actions

## 🔗 Quick Links

- **GitHub Repository**: [akkuea/akkuea](https://github.com/akkuea/akkuea)
- **API Documentation** (local dev): `http://localhost:3001/swagger`
- **Stellar Documentation**: [Stellar Developers](https://developers.stellar.org/)
- **Soroban Documentation**: [Soroban Docs](https://developers.stellar.org/docs/build/smart-contracts)

## 📞 Support

- Create an issue in the [GitHub repository](https://github.com/akkuea/akkuea/issues)
- See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the contribution workflow
