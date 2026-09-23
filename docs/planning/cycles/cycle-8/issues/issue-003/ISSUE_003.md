# Pilot Contract Admin Safety and Recoverability: Key Succession, Pause Parity, and an Upgrade Decision

| Attribute       | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Issue ID        | C8-003                                                                 |
| Area            | CONTRACT                                                               |
| Difficulty      | High                                                                   |
| Labels          | smart-contract, contracts, soroban, security, high                     |
| Dependencies    | C6-001, C7-002                                                         |
| Estimated Lines | 3,000-4,000 (three contracts, tests, client regen, runbooks, decision) |

## Context

The three pilot contracts will hold and route real investor USDC on mainnet, but none of them has any answer to "what if the admin key is lost, compromised, or the contract has a bug."

- **No admin succession.** `pilot-income-token`, `pilot-whitelist`, and `pilot-payout-split` each store one admin address at `initialize` and compare against it on every privileged call (`pilot-income-token/src/lib.rs:232-238`, `pilot-whitelist/src/lib.rs:64-69`, `pilot-payout-split/src/lib.rs:905-911`). No function rotates, transfers, or recovers that address. The only `set_admin` calls are inside `initialize`. If the key is lost, `mint_fixed_supply`, `approve`/`revoke`, `pause`/`unpause`, and `mark_wound_down` become permanently uncallable. If it is compromised, they are permanently hijacked. This repository already built the fix once, for `defi-rwa`: a two-step `transfer_admin_start` / `transfer_admin_accept` / `transfer_admin_cancel` flow documented in `docs/operations/runbook-role-management.md`. The pilot contracts never received it.
- **Pause exists on one of three contracts.** `pilot-payout-split` has `pause`/`unpause`/`is_paused` (`lib.rs:817-835`). `pilot-income-token` and `pilot-whitelist` have no pause at all (zero matches for `pause`), so a wrongful `mint_fixed_supply` or `approve` has no on-chain circuit breaker. `docs/operations/runbook-emergency-pause.md` covers only `defi-rwa`.
- **No upgrade or recovery path, and no recorded decision about one.** None of the three contracts calls `update_current_contract_wasm`. `mark_wound_down`'s own doc comment (`pilot-income-token/src/lib.rs:200-205`) says "no fund-recovery, refund, or unwind logic is implemented here (that remains an open product/legal question, Known Risk #5 in the product brief)." Known Risk #7 also names the single admin key with no second-party check as an open risk.

## What Needs to Be Done

- Add a two-step admin transfer (start, accept, cancel) to all three pilot contracts, following the proven `defi-rwa` pattern, with events for every step. Decide whether admin transfer on these contracts should also require the ally's co-signature, since the operator-plus-ally model already gates evidence, distribution, and exit. Record the reasoning either way.
- Add `pause`/`unpause`/`is_paused` to `pilot-income-token` and `pilot-whitelist`, gating their state-changing functions consistently with `pilot-payout-split`. Read-only calls (`balance`, `is_approved`, `holders`) must keep working while paused so the dashboard stays truthful.
- Make and record the upgrade decision in `docs/strategy/decision-log.md`: either (a) a WASM-upgrade entry point gated by a two-signer rule, or (b) deliberate immutability plus a documented, rehearsed migration-and-recovery procedure. Implement whichever is chosen, including tests or a scripted testnet rehearsal.
- Regenerate the typed clients in `apps/shared/src/contracts/pilot/` and update `docs/deployment/deploy-pilot-contracts.md`.
- Write pilot-specific operational runbooks: admin rotation for each contract, and emergency pause for all three pilot contracts (when to pause, what exactly each pause blocks, what to tell the ally and investors, how to unpause). Follow the structure of the existing `defi-rwa` runbooks.

## Acceptance Criteria

- Each of the three contracts supports start, accept, and cancel admin transfer. Tests cover the happy path, cancel before accept, an unauthorized accept, a start by a non-admin, and confirm the old admin loses all privileges after accept.
- `pilot-income-token` and `pilot-whitelist` reject every state-changing call while paused with a typed error, and their read-only calls still succeed. Tests cover both.
- The upgrade decision is recorded in `docs/strategy/decision-log.md` and implemented. If upgradeable, tests prove a single signer cannot upgrade. If immutable, the migration procedure is written and has been rehearsed once on testnet, with the transaction hashes in the PR.
- Generated clients in `@akkuea/shared` expose every new function, and `shared-ci.yml` passes.
- Runbooks for pilot admin rotation and pilot emergency pause exist under `docs/operations/`, each command is verified against the real contract interface, and the deployment guide links to them.
- The invocation budget of `execute_distribution` (`budget_check_execute_distribution_for_ten_holders`) does not regress.
- `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass with zero warnings.
- All five required CI workflows pass on the pull request.

## Quality Standard

These contracts are the parts of the system investors cannot see and have to trust. Admin succession and pause parity are well-understood patterns this repository already implemented once, so the work is carrying them over faithfully, not inventing new designs. The upgrade question is a genuine design decision with real trade-offs between a mutable contract investors must trust and an immutable one that cannot be fixed. It must be decided explicitly and written down, not left open.
