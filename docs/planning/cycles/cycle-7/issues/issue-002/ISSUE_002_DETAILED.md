# C7-002: Add an On-Chain Ally/Property Exit State to the Pilot Contract Suite

## Issue Metadata

| Attribute       | Value                                               |
| --------------- | --------------------------------------------------- |
| Issue ID        | C7-002                                              |
| Area            | CONTRACT                                            |
| Difficulty      | High                                                |
| Labels          | smart-contract, contracts, soroban, high            |
| Dependencies    | C6-001                                              |
| Estimated Lines | 250-450 (implementation, tests, decision-log entry) |

**Description**

Add a one-way, two-signer-gated `exit` state to `pilot-payout-split` (and a mirrored read-only marker on `pilot-income-token`), closing the on-chain half of Known Risk #5 in `docs/strategy/product-brief.md` without attempting to answer the still-open legal/fund-recovery question.

**Requirements and context**

- The two-signer pattern to mirror already exists: `execute_distribution` requires `operator.require_auth()` and `ally.require_auth()` (around lines 141-142 of `pilot-payout-split/src/lib.rs`). Reuse the same both-signatures-in-one-invocation approach for `exit`.
- The existing pause mechanism (admin-gated, reversible, tested via `paused_contract_blocks_record_and_execute` / `unpause_restores_execution` / `only_admin_can_pause`) must remain untouched and independent. `exit` is a new, separate, one-way gate layered on top - do not conflate the two or repurpose the pause flag for this.
- Add a new `DataKey` (see `storage.rs`) for exit state: an `Option<ExitRecord { reason: String, at: u64 }>` or equivalent, following the existing storage module's conventions.
- Add a new error variant in `errors.rs` (e.g. `ContractExited`) distinct from whatever error the pause gate already returns, so a client can tell the two states apart programmatically, not just by a shared generic "blocked" error.
- Emit an `ExitRecorded` event (see `events.rs` for the existing event-emission pattern used by other state-changing functions) carrying the reason and timestamp.
- Decide and document (in the PR description and `docs/strategy/decision-log.md`) whether the reason is a free-text string, a bounded enum, or a hash-plus-off-chain-link (matching the evidence-record pattern already used elsewhere in this contract) - this is a real design choice with consequences for what a dashboard can render, so make it deliberately, not by default.

**Suggested execution**

1. `git checkout -b feature/pilot-payout-split-exit-state`
2. Add the `ExitRecord` storage key and accessor functions to `storage.rs`.
3. Add the `ContractExited` (or equivalent) error variant to `errors.rs`.
4. Implement `exit(operator: Address, ally: Address, reason: String)` (or your chosen reason representation) requiring both signatures, writing the `ExitRecord`, and emitting the event.
5. Guard `record_evidence` and `execute_distribution` with an early exit-state check that returns the new typed error.
6. Implement `exit_status()` as a public read.
7. Mirror a minimal `is_wound_down()`-style read on `pilot-income-token` if it doesn't introduce a hard cross-contract dependency at read time (a simple independent flag set via an admin call from the payout-split contract's `exit`, or a documented reason why this is deferred).
8. Extend `#[cfg(test)] mod tests`: single-signer rejection, post-exit rejection of both guarded entrypoints, double-exit rejection, `exit_status()` before/after, and a test proving pause/unpause still work independently of exit state.
9. Record the reason-representation decision in `docs/strategy/decision-log.md`.

**Test and commit**

- [ ] All unit tests pass (`cargo test`)
- [ ] New exit-state logic has explicit test coverage for every acceptance criterion above
- [ ] `stellar contract build` succeeds (target `wasm32v1-none`)
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `docs/strategy/decision-log.md` gains an entry for the reason-representation decision

Example commit:
`git commit -m "feat(contracts): add two-signer exit state to pilot payout-split"`

**Guidelines**

- Do not implement any refund, fund-recovery, or unwind logic in this issue. If reviewers push for it, point back to Known Risk #5 in the product brief: that decision has not been made yet.
- Keep the exit gate and the pause gate fully independent in code, not just in tests - a reviewer should be able to read the guard clauses on `record_evidence`/`execute_distribution` and see two clearly separate checks.
