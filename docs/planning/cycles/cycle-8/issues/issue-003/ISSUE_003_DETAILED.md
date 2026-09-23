# C8-003: Pilot Contract Admin Safety and Recoverability: Key Succession, Pause Parity, and an Upgrade Decision

## Issue Metadata

| Attribute       | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Issue ID        | C8-003                                                                 |
| Area            | CONTRACT                                                               |
| Difficulty      | High                                                                   |
| Labels          | smart-contract, contracts, soroban, security, high                     |
| Dependencies    | C6-001, C7-002                                                         |
| Estimated Lines | 3,000-4,000 (three contracts, tests, client regen, runbooks, decision) |

**Description**

Give all three pilot contracts a way to recover from a lost or compromised admin key, a circuit breaker on every contract, and an explicit, implemented answer to whether they can be upgraded. The full context is in `ISSUE_003.md`.

**Requirements and context**

- Current admin checks:
  - `apps/contracts/contracts/pilot-income-token/src/lib.rs:232-238` (`require_admin`), admin set only in `initialize` at line 53 via `storage.rs:27`.
  - `apps/contracts/contracts/pilot-whitelist/src/lib.rs:64-69`, admin set only at line 24 via `storage.rs:17`.
  - `apps/contracts/contracts/pilot-payout-split/src/lib.rs:905-911`, plus `require_admin_or_operator` at 913. Admin set at line 251.
- Reference pattern: `defi-rwa`'s two-step transfer, documented in `docs/operations/runbook-role-management.md` (the `transfer_admin_start`, `transfer_admin_accept`, and cancel sections around lines 97-127). Read the implementation for behavior only, and do not import `defi-rwa` code into the pilot crates. The pilot contracts are intentionally independent (`docs/deployment/deploy-pilot-contracts.md:24`).
- Pause reference: `pilot-payout-split/src/lib.rs:817-835` (`pause`, `unpause`, `is_paused`), with `require_not_paused` at the top of state-changing functions and `emit_paused`/`emit_unpaused` in `events.rs:84-90`. Mirror this in the other two contracts.
- Which calls pause gates: on the income token, `mint_fixed_supply`, `transfer` (already restricted), and `mark_wound_down` (decide and document whether wind-down should stay possible while paused; recommended: yes). On the whitelist, `approve` and `revoke`. Never gate `balance`, `holders`, `is_approved`, `admin`, or the status reads.
- Cross-contract impact: `pilot-payout-split` reads the token and whitelist during `execute_distribution`. Confirm that a paused token or whitelist does not break those reads, since only writes are gated.
- Upgrade options for `docs/strategy/decision-log.md`: (a) `upgrade(new_wasm_hash)` calling `env.deployer().update_current_contract_wasm`, gated by admin plus ally (or operator plus ally) co-signature, with an event, or (b) immutability plus a written migration procedure (deploy new contracts, snapshot the holder set from `holders()`, re-mint, point the dashboard at the new IDs). Name the trade-off for investors in the entry.

Example: two-step transfer shape:

```rust
pub fn transfer_admin_start(env: Env, admin: Address, new_admin: Address) {
    admin.require_auth();
    Self::require_admin(&env, &admin);
    if new_admin == admin { panic_with_error!(&env, IncomeTokenError::InvalidAdmin); }
    Storage::set_pending_admin(&env, &new_admin);
    events::emit_admin_transfer_started(&env, admin, new_admin);
}

pub fn transfer_admin_accept(env: Env, new_admin: Address) {
    new_admin.require_auth();
    let pending = Storage::pending_admin(&env)
        .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NoPendingAdmin));
    if pending != new_admin { panic_with_error!(&env, IncomeTokenError::Unauthorized); }
    Storage::set_admin(&env, &new_admin);
    Storage::clear_pending_admin(&env);
    events::emit_admin_transferred(&env, new_admin);
}
```

**Suggested execution**

1. `git checkout -b feature/pilot-admin-safety`
2. Write the decision-log entry for the upgrade question and the admin-transfer co-signature question first.
3. Implement admin transfer in `pilot-whitelist` (smallest, 228 lines), then `pilot-income-token`, then `pilot-payout-split`.
4. Add pause to the token and the whitelist.
5. Implement the chosen upgrade path, or write and rehearse the migration procedure on testnet.
6. Regenerate the clients in `apps/shared/src/contracts/pilot/`.
7. Write `docs/operations/runbook-pilot-role-management.md` and `docs/operations/runbook-pilot-emergency-pause.md`, and update `deploy-pilot-contracts.md`.

**Test and commit**

- [ ] Per contract: transfer happy path, cancel, unauthorized accept, non-admin start, old admin locked out, events emitted
- [ ] Token and whitelist: every gated function rejected while paused, reads succeed while paused, unpause restores
- [ ] Payout-split `execute_distribution` still succeeds while the token or whitelist is paused (reads only), or the chosen behavior is documented and tested
- [ ] Upgrade tests (single signer rejected, co-signed upgrade succeeds on a test WASM), or a rehearsal with testnet transaction hashes
- [ ] Budget test for `execute_distribution` does not regress
- [ ] `cargo fmt --all -- --check`, `cargo clippy -- -D warnings`, `stellar contract build`, and all five CI workflows green

Example commit:
`git commit -m "feat(contracts): add admin succession and pause parity to pilot contracts"`

**Guidelines**

- Use the typed-error pattern already in each crate's `errors.rs`. Never add a bare `panic!`.
- Keep behavior faithful to the proven `defi-rwa` pattern unless the decision log records why it differs.
- Every runbook command must be copied from a command actually run against testnet.
