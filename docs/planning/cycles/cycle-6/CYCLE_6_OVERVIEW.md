# Cycle 6: Pilot Launch Readiness

## Overview

| Attribute     | Value                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Cycle Number  | 6                                                                                                                    |
| Total Issues  | 8                                                                                                                    |
| Focus Areas   | Pilot smart contracts, pilot UX, treasury track, design system parity, security, developer experience                |
| Prerequisites | `docs/strategy/product-brief.md`, `docs/strategy/roadmap.md`, `docs/design-system/` (all shipped in the prior cycle) |

## Objective

Cycle 6 takes Akkuea from "strategy documented" to "pilot launchable." Every issue in this cycle exists because `docs/strategy/product-brief.md` names it as required Phase 1 scope, `docs/strategy/roadmap.md` names it as Phase 1a, or the founder named it directly: professional diagramming, Akkuea Land's visual parity with the main design system, and a proper environment-variable guide for contributors.

This cycle deliberately does **not** touch anything `docs/strategy/roadmap.md` marks as Phase 2 (token transferability, jurisdiction formalization, multi-tenancy, oracle automation). Building any of that now would repeat the exact premature-platformization mistake this project's own research already rejected once.

Each issue in this cycle is scoped to be large and complete rather than split into artificially small slices: every pull request produced from this cycle is expected to add on the order of 4,000+ lines (implementation plus the test coverage this project's own CI already requires), because that is what it actually takes to ship a Soroban contract suite, a production frontend surface, or a real third-party integration to the quality bar this project holds itself to.

## Application Structure (new/changed by this cycle)

```
apps/
  contracts/contracts/
    pilot-income-token/       ← new (C6-001)
    pilot-whitelist/          ← new (C6-001)
    pilot-payout-split/       ← new (C6-001)
  webapp/src/
    app/[locale]/pilot/       ← new: dashboard + onboarding routes (C6-002, C6-008)
    components/pilot/         ← new: evidence, cycle-status, onboarding components (C6-002, C6-008)
    components/treasury/      ← new: DeFindex/EtherFuse panel (C6-003)
  akkuea-land/src/            ← migrated onto shared design tokens (C6-005)
  api/src/
    services/TreasuryService.ts        ← new (C6-003)
    routes/whitelist.ts, routes/evidence.ts  ← new (C6-008, C6-002)
  shared/src/
    env/                      ← new: env schema + validator (C6-007)
scripts/
  diagrams/                   ← new: Python + Graphviz pipeline (C6-004)
docs/
  ENV_SETUP.md                ← new (C6-007)
  diagrams/                   ← new: generated SVG/PNG output, vertical + horizontal (C6-004)
```

## Issue Distribution by Area

| Area     | Count | Issues                 |
| -------- | ----- | ---------------------- |
| CONTRACT | 1     | C6-001                 |
| WEBAPP   | 3     | C6-002, C6-005, C6-008 |
| API      | 2     | C6-003, C6-006         |
| TOOLING  | 2     | C6-004, C6-007         |

## Issue Distribution by Difficulty

All eight issues are High: every one spans multiple modules, requires design decisions, and carries real architectural weight. None of this cycle's scope is Trivial or Medium work.

## Issues Summary

| ID     | Title                                                                          | Area     | Difficulty | Dependencies |
| ------ | ------------------------------------------------------------------------------ | -------- | ---------- | ------------ |
| C6-001 | Implement the pilot's income token, whitelist, and payout-split contracts      | CONTRACT | High       | None         |
| C6-002 | Build the pilot's read-only dashboard for allies and investors                 | WEBAPP   | High       | C6-001       |
| C6-003 | Integrate the Phase 1a treasury track (DeFindex + EtherFuse)                   | API      | High       | None         |
| C6-004 | Build the professional diagram generation pipeline                             | TOOLING  | High       | None         |
| C6-005 | Align Akkuea Land with the webapp design system                                | WEBAPP   | High       | None         |
| C6-006 | Close the KYC enforcement gaps and remediate dependency vulnerabilities        | API      | High       | None         |
| C6-007 | Ship an environment variable guide, boot-time validation, and CI quality gates | TOOLING  | High       | None         |
| C6-008 | Build the self-serve whitelist and investor onboarding flow                    | WEBAPP   | High       | C6-001       |

## Acceptance Criteria for Cycle Completion

| Criteria                             | Description                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Pilot contracts deployed to testnet  | Income token, whitelist, and payout-split contracts live and verified on Stellar testnet                                                   |
| Pilot dashboard functional           | An ally can submit evidence and an investor can see holdings, distributions, and cycle status, end to end on testnet                       |
| Treasury visible on-chain            | The accumulated platform fee balance is verifiably deposited in DeFindex and/or EtherFuse, checkable on stellar.expert                     |
| Diagrams shipped                     | Every diagram in `docs/strategy/`, `docs/architecture/`, and the README has both a vertical and a horizontal rendering                     |
| Akkuea Land visually matches webapp  | Akkuea Land uses the same color tokens, typography, and (where applicable) shared components as `apps/webapp`                              |
| No open known-gap in KYC enforcement | `POST /kyc/verify/:documentId` requires authentication; `buyShares` enforces `kycStatus === 'approved'`                                    |
| Dependency audit shrinks             | `audit-allowlist.txt` no longer lists any advisory with an available non-breaking patch                                                    |
| Env guide exists and is enforced     | `docs/ENV_SETUP.md` documents every variable's source; the API and webapp fail fast with a clear message if a required variable is missing |
| Onboarding flow functional           | A new investor can request whitelist approval, and an operator can approve or reject it, without touching `curl`                           |
| All five required workflows pass     | `monorepo-ci.yml`, `api-ci.yml`, `webapp-ci.yml`, `shared-ci.yml`, `contracts-ci.yml` all green on every PR from this cycle                |

## Dependencies Between Issues

| Issue          | Depends On |
| -------------- | ---------- |
| C6-002, C6-008 | C6-001     |

Everything else is independently startable and parallelizable across contributors.

## Parallel Workstreams

| Contributor Focus       | Recommended Issues                    |
| ----------------------- | ------------------------------------- |
| Soroban / Rust          | C6-001 (then unblocks C6-002, C6-008) |
| Frontend, pilot surface | C6-002, C6-008 (after C6-001 lands)   |
| Backend / integrations  | C6-003, C6-006                        |
| Tooling / documentation | C6-004, C6-007                        |
| Frontend, Akkuea Land   | C6-005                                |

## Notes

- Every issue in this cycle must comply with `CLAUDE.md`: no em dash, no emojis (icons via `lucide-react` are fine), follow `docs/design-system/` for any UI work, and all five CI workflows must pass before the work is considered done.
- C6-001's three contracts are a new, independent system. They are not a modification of the existing `defi-rwa` contract, per the separation decision recorded in `docs/strategy/product-brief.md`.
- C6-002 and C6-008 both consume the whitelist and payout-split contracts from C6-001; coordinate the contract interface early so frontend work isn't blocked on the full contract implementation.
- C6-004's diagrams are not decoration. They are the primary way this project explains itself to real estate allies, investors, and grant reviewers who will not read Rust or TypeScript.
- C6-005 must not introduce a second component library. Reuse `apps/webapp/src/components/ui` where the two apps' needs genuinely overlap; only build Akkuea Land-specific components where they don't.
- Never commit an actual `.env` file or a real secret value in any issue from this cycle, including C6-007, whose entire point is explaining where secrets come from without ever containing one.
