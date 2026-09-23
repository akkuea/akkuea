# Cycle 8: Pilot Operability and Mainnet Readiness

## Overview

| Attribute     | Value                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cycle Number  | 8                                                                                                                                                                                          |
| Total Issues  | 8                                                                                                                                                                                          |
| Focus Areas   | Two-party signing, investor settlement, contract admin safety, identity data handling, mainnet cutover, production reliability, Akkuea Land parity, dashboard quality gates                |
| Prerequisites | Cycle 7 (`docs/planning/cycles/cycle-7/`) merged: EURC swap path (C7-001), exit state (C7-002), typed pilot clients (C7-004), whitelist hardening (C7-005), e2e harnesses (C7-009, C7-010) |

## Objective

Cycles 6 and 7 built and hardened the pilot at the contract level. Cycle 8 exists because a pilot that is correct on-chain is still not one a real ally, operator, and investor can use on mainnet. Reading the current code against `docs/strategy/product-brief.md` turns up four kinds of gap:

- **The core flow cannot run from the product.** `execute_distribution`, `record_evidence`, and `exit` require both the operator's and the ally's authorization, and no code anywhere in the monorepo builds or signs Soroban auth entries. The step that moves investor money is currently CLI-only.
- **Shipped capabilities are unreachable, and one strands funds.** EURC opt-in, exit state, and swap-failure records exist on-chain with no UI. USDC withheld after a failed EURC swap is "reserved for the affected holder" with no function that ever releases it.
- **Named risks have no answer.** There is no admin-key succession on any pilot contract, pause exists on only one of three, the upgrade and recovery question is unrecorded (Known Risks #5 and #7), a public default JWT secret is live in production code, and government-ID PII is stored in plaintext.
- **The operational bar is below mainnet.** There is one RPC endpoint with no retry, zero error tracking, no database recovery, a go-live checklist that covers only `defi-rwa`, no measured fee per payout (an explicit success criterion), an English-only onboarding game with no error handling, and no browser coverage of the evidence lifecycle.

Every issue in this cycle was found in the current code and cross-checked against all seven prior cycles' Issues Summary tables and the GitHub issue history. None of it touches `defi-rwa` or lending, and nothing `docs/strategy/roadmap.md` marks as Phase 2: the token stays non-transferable, there is no jurisdiction work, no multi-tenancy, and evidence review stays human rather than oracle-automated.

Each issue is scoped as one coherent whole feature, sized against this project's real merged PR history (Cycle 6's PRs ranged from 595 to 5,618 lines). Where a single gap was too small to stand alone, it was grouped only with work on the same data path or the same operational moment, and each issue states that shared theme explicitly.

## Application Structure (new/changed by this cycle)

```
apps/
  contracts/contracts/
    pilot-payout-split/       ← changed: persisted distribution records, withheld-fund release (C8-002); admin succession, upgrade decision (C8-003)
    pilot-income-token/       ← changed: admin succession, pause (C8-003)
    pilot-whitelist/          ← changed: admin succession, pause (C8-003)
  shared/src/
    contracts/pilot/          ← regenerated clients (C8-002, C8-003)
    contracts/clientConfig.ts ← changed: multi-endpoint RPC, retry policy (C8-006)
    env/schemas.ts            ← changed: JWT_SECRET (C8-005), storage/encryption/telemetry vars (C8-004, C8-006)
  api/src/
    services/StorageService.ts        ← changed: provider abstraction, S3-compatible backend (C8-004)
    db/schema/pilotWhitelist.ts       ← changed: attachment reference, encrypted PII (C8-004)
    workers/                           ← new: whitelist data retention job (C8-004); escalation RPC-unknown handling (C8-006)
    middleware/auth.ts, routes/auth.ts ← changed: no default secret (C8-005)
    (co-sign relay, if chosen)         ← new (C8-001)
  webapp/
    src/components/pilot/     ← new: co-sign flow, dispute action (C8-001); settlement, history, verification, banners (C8-002)
    src/components/auth/hooks/useWallet.hook.ts ← changed: auth-entry signing capability (C8-001)
    e2e/                      ← new: Soroban RPC mock layer, evidence-lifecycle specs, visual regression (C8-008)
  akkuea-land/
    messages/, src/i18n/      ← new: en/es internationalization (C8-007)
    src/app/**/error.tsx      ← new: error and not-found routes (C8-007)
scripts/
  preflight/ (or similar)     ← new: mainnet preflight tool (C8-005)
  db/ (or similar)            ← new: backup and restore (C8-006)
docs/
  architecture/               ← new: threat model and trust assumptions (C8-005)
  deployment/                 ← new: pilot Day-0 checklist (C8-005); updated pilot deploy guide (C8-001, C8-003)
  operations/                 ← new: pilot admin-rotation and pause runbooks (C8-003), data handling (C8-004), fee-per-payout figures (C8-005), backup/restore and incident response (C8-006)
  strategy/decision-log.md    ← new entries: co-sign transport (C8-001), withheld-fund release design (C8-002), upgrade decision (C8-003), storage provider (C8-004), error-tracking provider (C8-006)
```

## Issue Distribution by Area

| Area        | Count | Issues                 |
| ----------- | ----- | ---------------------- |
| WEBAPP      | 3     | C8-001, C8-002, C8-008 |
| CONTRACT    | 1     | C8-003                 |
| API         | 2     | C8-004, C8-006         |
| DX          | 1     | C8-005                 |
| AKKUEA-LAND | 1     | C8-007                 |

## Issue Distribution by Difficulty

| Difficulty | Count | Issues                                                         |
| ---------- | ----- | -------------------------------------------------------------- |
| High       | 8     | C8-001, C8-002, C8-003, C8-004, C8-005, C8-006, C8-007, C8-008 |

Every issue spans multiple modules, requires at least one real design decision recorded in `docs/strategy/decision-log.md` or an equivalent written artifact, and carries the test coverage this project's CI already requires. C8-003 and C8-008 are honestly estimated at the lower end (3,000-4,000 lines). Their scope was not padded to match the others.

## Issues Summary

| ID     | Title                                                                                                            | Area        | Difficulty | Dependencies                           |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ----------- | ---------- | -------------------------------------- |
| C8-001 | Build the two-party co-signing flow for distribution, co-signed evidence, and exit                               | WEBAPP      | High       | C6-001, C6-002, C7-001, C7-002, C7-004 |
| C8-002 | Investor settlement, end to end: EURC opt-in, payout history, withheld-fund release, verifiable evidence         | WEBAPP      | High       | C6-002, C7-001, C7-002, C7-004         |
| C8-003 | Pilot contract admin safety and recoverability: key succession, pause parity, and an upgrade decision            | CONTRACT    | High       | C6-001, C7-002                         |
| C8-004 | Production-grade whitelist identity evidence: document upload, durable encrypted storage, data retention         | API         | High       | C6-008, C7-005                         |
| C8-005 | Mainnet cutover gate: automated preflight, secret hardening, measured payout cost, Day-0 checklist, threat model | DX          | High       | C6-001, C6-007, C7-009                 |
| C8-006 | Pilot production reliability: Soroban RPC resilience, error tracking, and database recovery                      | API         | High       | C6-002, C7-004, C7-007                 |
| C8-007 | Bring Akkuea Land to the webapp's production bar: internationalization, error handling, accessibility            | AKKUEA-LAND | High       | C5-007, C6-005                         |
| C8-008 | Quality gates for the pilot dashboard: browser e2e for the evidence lifecycle, accessibility, visual regression  | WEBAPP      | High       | C6-002, C7-010                         |

## Acceptance Criteria for Cycle Completion

| Criteria                                    | Description                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money moves from the product, not the CLI   | Operator and ally can co-sign `execute_distribution`, `record_evidence`, and `exit` from the webapp, with a decoded summary and a live EURC price floor |
| No investor funds are stranded              | Withheld USDC from failed EURC swaps has an on-chain, holder-authorized release path, proven by tests                                                   |
| Investors can see and verify their money    | EURC opt-in, durable per-cycle payout history, terminal-state banners, and in-browser evidence hash verification all work                               |
| Admin keys are recoverable                  | All three pilot contracts support two-step admin transfer, all three can be paused, and the upgrade decision is recorded and implemented                |
| Identity data is production-grade           | ID documents are uploaded, stored durably and encrypted, PII is encrypted at rest, and retention is enforced                                            |
| Mainnet cutover is gated                    | The preflight tool fails on every known misconfiguration, no default secret exists, and fee per payout is measured and published                        |
| The pilot survives routine failures         | RPC fallback and retry work, stale data is labeled, errors reach a tracker, and a database restore has been rehearsed                                   |
| Akkuea Land matches the webapp's bar        | en/es i18n, error and not-found routes, and zero axe violations                                                                                         |
| The evidence lifecycle is regression-tested | Browser e2e, axe, and visual regression cover the pilot dashboard in CI                                                                                 |
| All five required workflows pass            | `monorepo-ci.yml`, `api-ci.yml`, `webapp-ci.yml`, `shared-ci.yml`, `contracts-ci.yml` all green on every PR from this cycle                             |

## Dependencies Between Issues

No issue in Cycle 8 depends on another issue in Cycle 8, per this project's rule against same-cycle dependencies. Every dependency points back to already-merged earlier-cycle work:

| Issue  | Depends On                             |
| ------ | -------------------------------------- |
| C8-001 | C6-001, C6-002, C7-001, C7-002, C7-004 |
| C8-002 | C6-002, C7-001, C7-002, C7-004         |
| C8-003 | C6-001, C7-002                         |
| C8-004 | C6-008, C7-005                         |
| C8-005 | C6-001, C6-007, C7-009                 |
| C8-006 | C6-002, C7-004, C7-007                 |
| C8-007 | C5-007, C6-005                         |
| C8-008 | C6-002, C7-010                         |

All eight issues can be started independently and worked in parallel.

## Parallel Workstreams

| Contributor Focus          | Recommended Issues     |
| -------------------------- | ---------------------- |
| Soroban / Rust             | C8-003, C8-002         |
| Frontend, pilot surface    | C8-001, C8-002, C8-008 |
| Backend / infrastructure   | C8-004, C8-006         |
| DX / security / operations | C8-005                 |
| Frontend, Akkuea Land      | C8-007                 |

## Notes

- Every issue in this cycle must comply with `CLAUDE.md`: no em dash, no emojis (icons via `lucide-react` are fine), follow `docs/design-system/` for any UI work, and all five CI workflows must pass before the work is considered done.
- C8-002 and C8-003 both change `pilot-payout-split` storage and regenerate the same typed clients. The two changes are functionally independent, but contributors picking up both should agree on branch order early to avoid a late-cycle merge conflict, the same coordination Cycle 7 needed for C7-001 and C7-002.
- C8-001, C8-002, and C8-008 all touch `components/pilot/`. C8-008 tests the flows that exist today. The new flows from C8-001 and C8-002 carry their own tests, and a later cycle extends C8-008's RPC mock layer to cover them.
- C8-001 must not weaken the rule in `writes.ts` that no key material passes through the API. If a relay is built, it carries only the invocation and collected auth entries, and the decision log says so explicitly.
- C8-002's withheld-fund release is a fund-safety fix, not a feature nicety. Treat its contract tests with the same rigor as C7-003's payout math.
- C8-005 deliberately does not duplicate C8-003's runbooks or C8-006's incident runbook. It links to them from the Day-0 checklist.
- None of this cycle's scope touches `defi-rwa`/lending or anything `docs/strategy/roadmap.md` marks as Phase 2.
- This cycle is published under the `Stellar Wave` label for Drips Wave 9.
