# Cycle 9: Pilot Consistency and Operator Gaps

## Overview

| Attribute     | Value                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cycle Number  | 9                                                                                                                                                                               |
| Total Issues  | 14                                                                                                                                                                              |
| Focus Areas   | Pilot contract operability, cycle identity consistency, whitelist operations, pilot UI reachability and localization, pilot configuration safety, Akkuea Land event pipeline    |
| Prerequisites | Cycles 6 to 8 merged: pilot contracts (C6-001), dashboard (C6-002), whitelist onboarding (C6-008), escalation job (C7-007), co-signing flow (C8-001), admin succession (C8-003) |

## Objective

Cycles 6 to 8 built the pilot and took it to a mainnet-ready bar. Cycle 9 exists because reading the current code end to end shows places where the pieces do not agree with each other, or where an operator has no way to do something the contracts already allow:

- **The pieces disagree on what a cycle is.** The dashboard identifies a cycle as `YYYY-MM`, the escalation job looks for `cycle-1`, `cycle-2`, and the contract accepts any string at all.
- **Key roles are frozen at deployment.** The admin can be rotated (C8-003), but the operator, the ally and the fee recipient cannot, and the contract does not even expose them as reads, so the webapp needs the ally address in an environment variable.
- **Operators cannot undo an approval.** `pilot-whitelist` has `revoke`, and nothing in the API or the webapp can call it.
- **Parts of the pilot UI are unfinished.** The whitelist screens are English-only in a bilingual app, no navigation leads to any pilot page, and an evidence link is rendered and fetched without checking what it is.
- **Akkuea Land's event pipeline has untested and duplicated paths.**

Every issue was found in the current code and checked against all eight prior cycles' Issues Summary tables and the open and closed GitHub issues. Nothing here touches `defi-rwa` or lending, and nothing `docs/strategy/roadmap.md` marks as Phase 2.

This cycle is sized for a Drips Wave: each issue is one coherent slice that a contributor can finish and a maintainer can review in a few days. Fourteen issues is the honest count. The codebase is in good shape after the previous Wave, and fifteen earlier Wave issues are still open, so the list was not padded to reach a higher number.

## Application Structure (new/changed by this cycle)

```
apps/
  contracts/contracts/
    pilot-payout-split/     <- changed: role rotation (C9-001), config reads (C9-002), input validation (C9-003), dust release (C9-005)
    pilot-income-token/     <- changed: wind-down guard (C9-004)
  api/src/
    workers/pilotEscalation/  <- changed: calendar-month cycle ids (C9-006)
    routes/internalOperations.ts, services/WhitelistService.ts, db/schema/pilotWhitelist.ts <- changed: revoke (C9-007)
    controllers/WhitelistController.ts, routes/whitelist.ts <- changed: typed errors, address validation (C9-008)
  webapp/
    src/components/pilot/   <- changed: whitelist i18n (C9-009), evidence link safety (C9-011)
    src/components/layout/  <- changed: pilot navigation (C9-010)
    messages/               <- changed: en/es keys (C9-009, C9-010)
  shared/src/env/           <- changed: pilot variables in the schema (C9-012)
  akkuea-land/src/          <- changed: single event stream (C9-013), tests (C9-014)
docs/
  deployment/environment-variables.md <- changed (C9-012)
  operations/               <- new: role rotation runbook (C9-001)
  strategy/decision-log.md  <- new entries: role rotation authority (C9-001), dust policy (C9-005)
```

## Issue Distribution by Area

| Area        | Count | Issues                                 |
| ----------- | ----- | -------------------------------------- |
| CONTRACTS   | 5     | C9-001, C9-002, C9-003, C9-004, C9-005 |
| API         | 3     | C9-006, C9-007, C9-008                 |
| WEBAPP      | 3     | C9-009, C9-010, C9-011                 |
| DX          | 1     | C9-012                                 |
| AKKUEA-LAND | 2     | C9-013, C9-014                         |

## Issue Distribution by Difficulty

| Difficulty | Count | Issues                                                                                 |
| ---------- | ----- | -------------------------------------------------------------------------------------- |
| High       | 3     | C9-001, C9-005, C9-007                                                                 |
| Medium     | 11    | C9-002, C9-003, C9-004, C9-006, C9-008, C9-009, C9-010, C9-011, C9-012, C9-013, C9-014 |

Size and difficulty are separate. The three High issues are still small, but each needs a design decision on a contract or an operator action that touches investor money or access.

## Issues Summary

| ID     | Title                                                                                           | Area        | Difficulty | Dependencies   |
| ------ | ----------------------------------------------------------------------------------------------- | ----------- | ---------- | -------------- |
| C9-001 | pilot-payout-split: the operator, the ally and the fee recipient can never be rotated           | CONTRACTS   | High       | C6-001, C8-003 |
| C9-002 | pilot-payout-split exposes none of its configuration as reads                                   | CONTRACTS   | Medium     | C6-001         |
| C9-003 | pilot-payout-split accepts any cycle id and unbounded strings                                   | CONTRACTS   | Medium     | C6-001         |
| C9-004 | pilot-income-token still mints and moves balances after mark_wound_down                         | CONTRACTS   | Medium     | C7-002         |
| C9-005 | pilot-payout-split: rounding dust accumulates with no release path                              | CONTRACTS   | High       | C6-001, C8-002 |
| C9-006 | Escalation job looks for cycle-N ids while evidence is recorded as YYYY-MM                      | API         | Medium     | C7-007         |
| C9-007 | Operators cannot revoke a whitelisted investor                                                  | API         | High       | C6-008         |
| C9-008 | Whitelist request failures return a generic 500, and any 56-character string passes as a wallet | API         | Medium     | C6-008         |
| C9-009 | Whitelist onboarding and review screens are English-only                                        | WEBAPP      | Medium     | C6-008         |
| C9-010 | No navigation leads to the pilot pages                                                          | WEBAPP      | Medium     | C6-002         |
| C9-011 | Evidence links are stored, rendered and fetched without validation                              | WEBAPP      | Medium     | C6-002, C8-002 |
| C9-012 | Pilot environment variables are outside the shared env schema, and one is undocumented          | DX          | Medium     | C6-007         |
| C9-013 | Akkuea Land dashboard opens a second event stream next to GameEventContext                      | AKKUEA-LAND | Medium     | C5-007         |
| C9-014 | Akkuea Land: test the untested event hooks and the onboarding helper                            | AKKUEA-LAND | Medium     | C5-007         |

## Acceptance Criteria for Cycle Completion

| Criteria                                      | Description                                                        |
| --------------------------------------------- | ------------------------------------------------------------------ |
| One definition of a cycle                     | Contract, dashboard and escalation job all use `YYYY-MM`           |
| Roles are recoverable and visible             | Operator, ally and fee recipient can be rotated and read on-chain  |
| Terminal states are terminal                  | No mint or correction transfer after wind-down                     |
| No silent balances                            | Dust is accounted for and has a documented release path            |
| Operators can undo an approval                | Revoke works end to end and is audited                             |
| Clear errors                                  | Whitelist intake returns typed 4xx responses                       |
| The pilot UI is reachable, bilingual and safe | Navigation, en/es whitelist screens, https-only evidence links     |
| Configuration fails fast                      | Pilot variables are validated and documented                       |
| One event stream, tested                      | Akkuea Land uses a single SSE connection and its hooks are covered |
| All workflows pass                            | Every workflow that runs on each PR is green                       |

## Dependencies Between Issues

No issue in Cycle 9 depends on another issue in Cycle 9. Every dependency points back to merged earlier-cycle work, and all fourteen can be worked in parallel.

## Parallel Workstreams

| Contributor Focus       | Recommended Issues                     |
| ----------------------- | -------------------------------------- |
| Soroban / Rust          | C9-001, C9-002, C9-003, C9-004, C9-005 |
| Backend / API           | C9-006, C9-007, C9-008                 |
| Frontend, pilot surface | C9-009, C9-010, C9-011                 |
| DX                      | C9-012                                 |
| Frontend, Akkuea Land   | C9-013, C9-014                         |

## Notes

- Every issue must comply with `CLAUDE.md`: no em dash, no emojis, `docs/design-system/` for any UI work.
- C9-001, C9-002, C9-003 and C9-005 all change `pilot-payout-split` and regenerate the same typed clients. They are functionally independent. Whoever merges second regenerates the bindings on top of `develop`.
- C9-002 makes `NEXT_PUBLIC_PILOT_ALLY_ADDRESS` unnecessary in the long run. Removing it from the webapp is left to a later cycle, so C9-012 still documents and validates it.
- C9-007 is API-only. The revoke button in the review queue is a later-cycle issue.
- This cycle is published under the `Stellar Wave` label for Drips Wave 11. New issues carry `applications-open` and a notice that applicants are only considered once the Wave opens on November 18, 2026.
