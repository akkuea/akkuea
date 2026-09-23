# Mainnet Cutover Gate: Automated Preflight, Secret Hardening, Measured Payout Cost, Day-0 Checklist, and Threat Model

| Attribute       | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| Issue ID        | C8-005                                                                         |
| Area            | DX                                                                             |
| Difficulty      | High                                                                           |
| Labels          | security, ci, dx, documentation, backend, high                                 |
| Dependencies    | C6-001, C6-007, C7-009                                                         |
| Estimated Lines | 3,500-4,500 (preflight tool and tests, CI changes, auth fix, operational docs) |

## Context

The roadmap sequences the pilot as "build and harden on testnet first, then take verified integrations and real capital to mainnet." Nothing in the repository currently enforces that the move to mainnet is safe. The gaps below all sit at that cutover point and share one theme: nothing should reach mainnet without passing a check that does not depend on someone remembering.

- **A forgeable-session default secret is live in production code.** `apps/api/src/middleware/auth.ts:5` and `apps/api/src/routes/auth.ts:22` both use `process.env.JWT_SECRET || 'super-secret-default-key-for-dev'`. `JWT_SECRET` is missing from `.env.example`, from `docs/deployment/environment-variables.md`, and from the boot-time schema in `apps/shared/src/env/schemas.ts`. A deployment that forgets it starts cleanly and signs sessions with a string that is public in this repository. `api-ci.yml`'s `security-audit` job (line 91) has no secret-scanning step, unlike `webapp-ci.yml:137` and `contracts-ci.yml:138`, so nothing catches this class of bug.
- **Production appropriateness is checked by eye.** C6-007's validator checks that variables are present and well-formed. A testnet passphrase, a testnet RPC URL, or `DATABASE_SSL=false` all pass it. The "Production checklist" at the end of `environment-variables.md` is a list of unchecked markdown boxes. No script under `scripts/` performs a preflight.
- **There is no go-live gate for the pilot contracts.** `docs/deployment/post-deploy-checklist.md` is entirely about `defi-rwa`: oracle, lending pool, `EmergencyGuard`. Nothing verifies, before users are let in, that the deployed pilot contracts are initialized with the intended production operator, ally, admin, and fee-recipient addresses, that operator and ally are distinct production keys, or that the deployed WASM matches the audited build.
- **A named success criterion is unmet.** The product brief requires a "defined gas/fee cost per payout transaction, measured on testnet." `contracts-ci.yml`'s `invocation-budget` job (line 208) runs only `cargo test --package rwa-defi-contract budget_check` (line 235). The pilot's own `budget_check_execute_distribution_for_ten_holders` (`pilot-payout-split/src/lib.rs:2138`) is never surfaced there, and no measured fee figure is documented anywhere.
- **No threat model exists.** The brief's central differentiator is "honesty about the trust model," but no document lists, for each actor (admin, operator, ally, whitelisted holder, applicant, API operator), what each one can and cannot do, and which protections are contract-enforced versus human-mediated. That is the first document an auditor or an ally's legal counsel would ask for.

## What Needs to Be Done

- Remove the JWT fallback. Fail fast at boot when `JWT_SECRET` is missing or weak, add it to `.env.example`, the environment-variables doc, and the shared env schema, and update the tests that rely on the literal. Add a secret-scanning step to `api-ci.yml` that would have caught this literal.
- Build a mainnet preflight tool under `scripts/` that runs in two parts. The environment part checks production appropriateness: mainnet passphrase and RPC and Horizon URLs, `DATABASE_SSL`, non-placeholder credentials, `OPERATIONS_ALLOWED_WALLETS` matching the intended operator, and no dev defaults. The on-chain part reads the deployed pilot contracts: initialized, admin, operator, ally, and fee-recipient addresses match a reviewed manifest, operator and ally are distinct, the payout contract is wired to the intended token, whitelist, USDC, EURC, and router, and deployed WASM hashes match the release build. It exits non-zero with a precise report, and CI runs it in a dry-run mode.
- Extend the `invocation-budget` job to run and print the pilot contract budget tests. Measure the real fee of `execute_distribution` on testnet at several holder counts (including mixed USDC and EURC sets), and publish the figures and method under `docs/operations/`.
- Write a pilot Day-0 checklist under `docs/deployment/`, mirroring the format of the existing checklist, that uses the preflight tool as its gate.
- Write a threat model and trust-assumptions document under `docs/architecture/` covering the three pilot contracts, the API, and the webapp. Link it from the product brief's Known Risks.

## Acceptance Criteria

- The API refuses to start without a valid `JWT_SECRET`, a test covers this, and no production code path contains a default secret literal. `api-ci.yml` fails on a planted test secret, as a test or fixture demonstrates.
- The preflight tool fails with a specific message on each of: a testnet passphrase, a testnet RPC URL, `DATABASE_SSL=false`, a placeholder credential, operator equal to ally, an address that does not match the manifest, and a WASM hash mismatch. Each case has a test, and a correct configuration passes.
- The on-chain part of the preflight has been run against the current testnet deployment, with its output included in the PR.
- The `invocation-budget` job prints pilot budget figures, and `docs/operations/` contains measured testnet fee-per-payout figures with the holder counts and transaction hashes used.
- The pilot Day-0 checklist and the threat model exist, reference real function names and roles, and are linked from `docs/deployment/deploy-pilot-contracts.md` and `docs/strategy/product-brief.md`.
- All five required CI workflows pass on the pull request.

## Quality Standard

The point of this issue is that a mistake which is harmless on testnet cannot silently become a mainnet incident. Every check must be executable and every failure message must say exactly what is wrong. The threat model must describe the system as it actually is, including its weak points (single admin keys, human-reviewed evidence), because that honesty is the product's stated differentiator. It is not a marketing document.
