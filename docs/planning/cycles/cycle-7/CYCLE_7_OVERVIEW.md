# Cycle 7: Pilot Hardening and Verification

## Overview

| Attribute     | Value                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle Number  | 7                                                                                                                                              |
| Total Issues  | 10                                                                                                                                             |
| Focus Areas   | Pilot contract completeness, contract-level fuzz testing, pilot DX/tooling, pilot API hardening, end-to-end verification                       |
| Prerequisites | Cycle 6 (`docs/planning/cycles/cycle-6/`) merged: pilot contracts (C6-001), whitelist onboarding (C6-008), KYC/dependency remediation (C6-006) |

## Objective

Cycle 6 took Akkuea from "strategy documented" to "pilot contracts and onboarding shipped." Cycle 7 exists because shipping the v1 pilot surface left a specific, verified set of gaps behind it: a fast-follow the product brief explicitly named but never built (EURC settlement), a named open risk with no on-chain answer (ally exit), the highest-stakes contract in the repository tested only against hand-picked cases, a typed-client gap that every other contract system in this monorepo already closed, an API surface with real security and consistency gaps, two engineering success criteria from `docs/strategy/product-brief.md` that are still unmet (SLA tracking, full end-to-end testnet verification), and zero end-to-end test coverage anywhere in the repository, browser or backend.

Every issue in this cycle was found by reading the actual current code against what `docs/strategy/product-brief.md`, `docs/strategy/roadmap.md`, and the merged Cycle 6 issues already commit to - not by inventing new scope. None of this cycle touches `defi-rwa`/lending (not the pilot's critical path) or anything `docs/strategy/roadmap.md` marks as Phase 2 (token transferability, jurisdiction formalization, multi-tenancy, oracle automation).

## Application Structure (new/changed by this cycle)

```
apps/
  contracts/contracts/
    pilot-payout-split/       ← changed: EURC swap (C7-001), exit state (C7-002), proptest suite (C7-003)
  shared/src/
    contracts/pilot/generated/  ← new: typed clients for the 3 pilot contracts (C7-004)
  api/src/
    routes/whitelist.ts               ← changed: rate limiting (C7-005)
    services/WhitelistService.ts      ← changed: audit trail hook (C7-008)
    services/ (new metrics path)      ← new: review-turnaround metrics (C7-006)
    workers/                           ← new: ally-escalation job (C7-007)
    tests/pilot-e2e/ or scripts/smoke/ ← new: full-lifecycle testnet suite (C7-009)
  webapp/
    e2e/ (or tests/e2e/)               ← new: Playwright harness (C7-010)
docs/
  strategy/decision-log.md    ← new entries: swap-venue verification (C7-001), exit reason design (C7-002)
  operations/                  ← new: pilot review SLA target (C7-006)
```

## Issue Distribution by Area

| Area     | Count | Issues                         |
| -------- | ----- | ------------------------------ |
| CONTRACT | 3     | C7-001, C7-002, C7-003         |
| SHARED   | 1     | C7-004                         |
| API      | 4     | C7-005, C7-006, C7-007, C7-008 |
| DX       | 1     | C7-009                         |
| WEBAPP   | 1     | C7-010                         |

## Issue Distribution by Difficulty

| Difficulty | Count | Issues                                                                 |
| ---------- | ----- | ---------------------------------------------------------------------- |
| High       | 9     | C7-001, C7-002, C7-003, C7-004, C7-005, C7-006, C7-007, C7-009, C7-010 |
| Medium     | 1     | C7-008                                                                 |

C7-008 is deliberately scoped smaller: the audit-log infrastructure it wires into already exists and is proven elsewhere in this API, so the honest classification is Medium, not an inflated High. Every other issue involves cross-module changes, a real design decision, or a new integration/tool, matching this repository's own High-tier criteria in `docs/planning/ISSUE_CREATION_GUIDE.md`.

## Issues Summary

| ID     | Title                                                                                 | Area     | Difficulty | Dependencies   |
| ------ | ------------------------------------------------------------------------------------- | -------- | ---------- | -------------- |
| C7-001 | Implement the real USDC-to-EURC settlement path in the pilot payout-split contract    | CONTRACT | High       | C6-001         |
| C7-002 | Add an on-chain ally/property exit state to the pilot contract suite                  | CONTRACT | High       | C6-001         |
| C7-003 | Property-based and fuzz testing for the payout-split fee and pro-rata math            | CONTRACT | High       | C6-001         |
| C7-004 | Generate typed Soroban TypeScript client bindings for the pilot contract suite        | SHARED   | High       | C6-001         |
| C7-005 | Harden the pilot whitelist API: rate limiting, abuse protection, on-chain consistency | API      | High       | C6-006, C6-008 |
| C7-006 | Track and report whitelist and evidence review turnaround time (SLA)                  | API      | High       | C6-001, C6-008 |
| C7-007 | Proactive escalation job for allies who miss two consecutive reporting cycles         | API      | High       | C6-001         |
| C7-008 | Wire pilot whitelist operator actions into the existing audit trail                   | API      | Medium     | C6-008         |
| C7-009 | End-to-end testnet integration suite for the full pilot lifecycle                     | DX       | High       | C6-001, C6-008 |
| C7-010 | Playwright e2e test harness for the whitelist onboarding and review flow              | WEBAPP   | High       | C6-008         |

## Acceptance Criteria for Cycle Completion

| Criteria                                      | Description                                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| EURC settlement is real                       | A holder who opts into EURC receives EURC from a real, verified swap venue, not a stub                                                  |
| Ally-exit signal exists on-chain              | `pilot-payout-split` can record and expose a permanent, two-signer-gated exit state with a reason and timestamp                         |
| Payout-split math is fuzzed                   | Property-based tests cover the fee/pro-rata invariants across generated holder sets, beyond the existing fixed cases                    |
| Pilot contracts have typed clients            | `@akkuea/shared` exposes generated TypeScript bindings for all three pilot contracts, matching the existing pattern                     |
| Whitelist API is hardened                     | `/pilot/whitelist/request` is rate-limited; database and on-chain approval state are proven to agree by a real test                     |
| Review SLA is tracked                         | A defined turnaround target exists and is measurable via an endpoint for both whitelist and evidence review                             |
| Ally silence triggers a proactive alert       | A scheduled job notifies an operator when two consecutive reporting cycles are missed, without requiring dashboard use                  |
| Pilot operator actions are auditable          | Whitelist approve/reject actions appear in this project's existing audit trail                                                          |
| The full pilot lifecycle is proven end to end | A testnet integration suite exercises whitelist approval, minting, evidence recording, and distribution against real deployed contracts |
| A first e2e browser harness exists            | Playwright specs cover the merged whitelist onboarding and review-queue flow, wired into CI                                             |
| All five required workflows pass              | `monorepo-ci.yml`, `api-ci.yml`, `webapp-ci.yml`, `shared-ci.yml`, `contracts-ci.yml` all green on every PR from this cycle             |

## Dependencies Between Issues

No issue in Cycle 7 depends on another issue in Cycle 7, per this project's dependency rule against same-cycle dependencies. Every dependency listed points back to already-merged Cycle 6 work:

| Issue  | Depends On     |
| ------ | -------------- |
| C7-001 | C6-001         |
| C7-002 | C6-001         |
| C7-003 | C6-001         |
| C7-004 | C6-001         |
| C7-005 | C6-006, C6-008 |
| C7-006 | C6-001, C6-008 |
| C7-007 | C6-001         |
| C7-008 | C6-008         |
| C7-009 | C6-001, C6-008 |
| C7-010 | C6-008         |

All ten issues are independently startable and fully parallelizable across contributors.

## Parallel Workstreams

| Contributor Focus     | Recommended Issues             |
| --------------------- | ------------------------------ |
| Soroban / Rust        | C7-001, C7-002, C7-003         |
| Backend / API         | C7-005, C7-006, C7-007, C7-008 |
| Shared / DX / tooling | C7-004, C7-009                 |
| Frontend              | C7-010                         |

## Notes

- Every issue in this cycle must comply with `CLAUDE.md`: no em dash, no emojis (icons via `lucide-react` are fine), follow `docs/design-system/` for any UI work, and all five CI workflows must pass before the work is considered done.
- C7-001 and C7-002 both add new contract-level state to `pilot-payout-split`; coordinate branch order between contributors picking up both to avoid a painful late-cycle merge conflict, even though the two are functionally independent.
- C7-001's swap-venue choice and C7-002's exit-reason representation are both genuine third-party/design decisions in this project's sense of the term - both must be recorded in `docs/strategy/decision-log.md`, not just implemented silently.
- C7-009 and C7-010 are this repository's first genuine end-to-end suites, backend and browser respectively. Get their foundations right; future cycles will extend both rather than replace them.
- C7-008 is intentionally Medium, not High - resist the temptation to pad its scope just to match the rest of the cycle's difficulty profile. Honest sizing is part of this project's own quality bar.
- None of this cycle's scope touches `defi-rwa`/lending or anything `docs/strategy/roadmap.md` marks as Phase 2.
