# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Akkuea is a Bun monorepo on Stellar/Soroban. **The canonical source of product direction is [`docs/strategy/product-brief.md`](docs/strategy/product-brief.md): read it before making any product, scope, or architecture decision.** Where anything else in this repo (README, older docs, code comments) describes the product differently, `docs/strategy/` wins.

In short, three things coexist in this codebase and must not be conflated:

1. **The pilot** (current priority, `docs/strategy/`): a single-ally tokenization-as-a-service pilot. One allied real estate agency issues a non-transferable revenue-participation token for one property's rental income. Distribution runs through Akkuea's own payout-split contract, gated by human-reviewed evidence and a minimum-defensible whitelist. Explicitly **not** fractional equity, **not** a DeFi lending product, **not** a general compliance engine. See the roadmap for the parallel treasury track (DeFindex, EtherFuse) and the Phase 2 expansion plan.
2. **The existing platform build** (`apps/webapp`, the `defi-rwa` contract): a larger, earlier system with fractional property-share tokenization and a full collateralized DeFi lending protocol. It's real, deployed to testnet, and documented in detail (`docs/api/`, `docs/architecture/`, `docs/deployment/`, `docs/operations/`), but it predates the pilot's scoping and is not the pilot's critical path.
3. **Akkuea Land** (`apps/akkuea-land`): a tile-based property game, kept and positioned as the pilot's visual and educational companion, not a separate product. See `docs/game/`.

## Non-negotiables

These apply to every piece of output from this repository (code, comments, commit messages, pull requests, and documentation), with no exceptions:

- **Quality and professionalism come first.** This project is pitched to real estate agencies, investors, and grant reviewers. Every artifact must read as something a skeptical, non-technical operational partner could be handed directly.
- **Never use an em dash, anywhere.** Use a comma, a period, a colon, or parentheses instead. This is enforced repo-wide (see the `style: remove em dashes from comments across the codebase` commit); do not reintroduce one in new code, comments, commits, or docs.
- **No emojis, ever.** Not in code, commit messages, PR descriptions, or documentation. **Icons are fine and encouraged** in the UI: `apps/webapp` uses `lucide-react` exclusively for iconography (see [`docs/design-system/components.md`](docs/design-system/components.md)). Don't introduce a second icon library, and don't substitute an emoji where an icon component belongs.
- **Follow the documentation, don't improvise around it.** Before building or changing anything, check whether `docs/strategy/`, `docs/design-system/`, or the relevant `docs/api/`, `docs/architecture/`, `docs/deployment/`, or `docs/operations/` file already answers the question. If a change contradicts what's documented, update the documentation in the same change rather than leaving it stale.
- **Follow the design system for any `apps/webapp` UI work.** Colors, typography, and effects are CSS custom properties defined in `apps/webapp/src/app/globals.css` and documented in [`docs/design-system/foundations.md`](docs/design-system/foundations.md); components live in `apps/webapp/src/components/ui` and are documented in [`docs/design-system/components.md`](docs/design-system/components.md). Use the existing tokens and components before adding new ones. Note the known inconsistency flagged in `components.md` (some components hardcode colors instead of using tokens); don't add more of that pattern.
- **CI must pass before any work is considered done.** See "Before considering a task complete" below. Do not tell the user something is finished, fixed, or ready if you have not actually run the relevant checks and seen them pass.

## Commands

Run from the repository root unless noted.

```bash
bun install                 # install all workspace dependencies

bun run dev                 # start webapp + api + akkuea-land concurrently
bun run dev:webapp          # webapp only (localhost:3000)
bun run dev:api             # api only (localhost:3001)
bun run dev:land            # akkuea-land only

bun run build                # build all workspaces
bun run build:contracts      # build Soroban contracts (./scripts/build.sh)

bun run test                 # bun test --workspaces (all TS workspaces)
bun run lint                 # eslint across all workspaces
bun run typecheck            # tsc --noEmit across all workspaces
bun run format                # prettier --write across the repo (excludes apps/contracts)

bun run smoke                 # ./scripts/smoke/run-smoke-tests.sh, post-deploy happy-path checks
bun run storybook              # apps/webapp component storybook
```

Per-workspace (when iterating on one app, from that app's directory):

```bash
cd apps/api && bun test                       # run a single API test file: bun test src/path/to.test.ts
cd apps/webapp && bun test                    # webapp unit tests
cd apps/akkuea-land && bun test               # akkuea-land unit tests
cd apps/shared && bun run build                # rebuild @akkuea/shared after changing shared types
```

Smart contracts (`apps/contracts`, Rust/Soroban, not a `bun` workspace):

```bash
cd apps/contracts/contracts/defi-rwa   # or any game-* contract dir
cargo fmt --check
cargo clippy -- -D warnings
cargo test
stellar contract build                  # target wasm32v1-none; do NOT use plain `cargo build --target wasm32-unknown-unknown` on recent toolchains, it emits reference-types the Soroban VM rejects
```

Deployment: [`docs/deployment/deploy-contracts.md`](docs/deployment/deploy-contracts.md) (existing `defi-rwa` platform contract) and [`docs/deployment/deploy-game-contracts.md`](docs/deployment/deploy-game-contracts.md) (Akkuea Land's four contracts) are separate guides with separate scripts. Do not mix them up.

## Architecture

Five applications in one Bun monorepo (four `bun` workspaces plus the Rust contracts workspace, built separately):

| Path               | Role                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/webapp`      | Next.js 16 / React 19 frontend for the existing platform build                                                                                                                                                                                                                                                                                                                              |
| `apps/akkuea-land` | Next.js frontend for the game, the pilot's visual companion                                                                                                                                                                                                                                                                                                                                 |
| `apps/api`         | Elysia REST API on Bun, admin-signs transactions against `defi-rwa`, orchestrates KYC review                                                                                                                                                                                                                                                                                                |
| `apps/shared`      | `@akkuea/shared`: types, validation, Stellar SDK helpers, contract-ID resolution, test factories, imported identically by all three TypeScript workspaces                                                                                                                                                                                                                                   |
| `apps/contracts`   | Rust/Soroban. Two independent contract systems today: `defi-rwa` (fractional shares + lending, existing platform) and `game-property-nft` / `game-land-token` / `game-engine` / `game-marketplace` (Akkuea Land). The pilot's own contract surface (income-participation token, whitelist, payout-split) is being built here as a third, independent system, not as a change to `defi-rwa`. |

Contract IDs are data, not code: `apps/shared/src/contracts.testnet.json`, `apps/shared/src/contracts.mainnet.json`, and `apps/shared/src/contracts/game-contracts.testnet.json` are the source of truth, read by both the API and both frontends. Recording a new deployment means updating one of these JSON files, not editing application code.

Both frontends talk to the same API and share `@akkuea/shared`, but each also talks to its own contract system directly from the browser via a connected Stellar wallet for user-signed actions (Freighter or equivalent via `@creit.tech/stellar-wallets-kit`), while the API holds the admin key for admin-signed actions (minting, oracle configuration, role grants).

Full breakdown, diagrams, and data flows: [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md).

## Before considering a task complete

This repo runs five required GitHub Actions workflows on every pull request (`monorepo-ci.yml`, `api-ci.yml`, `webapp-ci.yml`, `shared-ci.yml`, `contracts-ci.yml`). **All five must pass, no exceptions** (see [`CONTRIBUTING.md`](CONTRIBUTING.md#cicd-workflows-must-pass)). Before saying a change is done, reproduce what each relevant workflow checks, locally:

```bash
bun run typecheck
bun run lint
bun run test
bun run build

# only if apps/contracts changed:
cd apps/contracts/contracts/<changed-contract>
cargo fmt --all -- --check
cargo clippy -- -D warnings
cargo test
stellar contract build
```

If a check fails, fix the root cause and re-run it, don't suppress or skip it. If a workflow failure looks unrelated to the change (flaky test, transient network error), say so explicitly rather than silently ignoring it.

## Commit conventions

Conventional Commits, one atomic logical change per commit (see [`CONTRIBUTING.md`](CONTRIBUTING.md#commit-standards) for the full standard): `<type>(<scope>): <short, lowercase, no trailing punctuation>`. Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `style`. All changes go through a fork-based workflow; no direct pushes to `main` or `develop`.
