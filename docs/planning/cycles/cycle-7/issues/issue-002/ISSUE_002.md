# Add an On-Chain Ally/Property Exit State to the Pilot Contract Suite

## Context

`docs/strategy/product-brief.md` names this directly under Known Risks: "Exit mechanism undefined. What happens if the ally exits or stops operating the property mid-cycle, with investors already holding tokens, has no answer yet." That legal/fund-recovery question genuinely has no answer yet and is out of this issue's scope. But there is a narrower, purely engineering gap underneath it: today, nothing in `pilot-payout-split` or `pilot-income-token` can represent "this ally/property relationship has permanently ended" as a durable, on-chain fact. The contract has a `pause`/`unpause` gate (see the existing `paused_contract_blocks_record_and_execute` and `unpause_restores_execution` tests), which is reversible and operational - it says nothing about a terminal state, and there is no way for the future dashboard to distinguish "temporarily paused" from "this pilot is over."

## What Needs to Be Done

- Add a one-way `exit` transition to `pilot-payout-split`, gated by the same two-signer authorization already used for `execute_distribution` (both operator and ally must sign), since ending the relationship is at least as consequential as approving a distribution.
- Once exited, `record_evidence` and `execute_distribution` must both permanently reject further calls with a specific, typed error - never a panic - distinct from the existing pause error.
- Store and expose a reason and timestamp (`exit_status()` read function) so a client can render why and when the exit happened without any off-chain state.
- Consider a matching, read-only terminal marker on `pilot-income-token` so a client reading either contract independently sees a consistent picture, without depending on a cross-contract call succeeding at read time.
- Explicitly out of scope for this issue: any fund-recovery, refund, pro-rata unwind, or legal wind-down logic. This issue makes the fact of exit and its stated reason durable and queryable on-chain - it does not attempt to answer the unresolved question of what happens to already-collected or future funds.

## Acceptance Criteria

- `exit()` requires both the operator's and the ally's signatures; a test proves a single-signer call is rejected, symmetric to the existing `single_signer_attempt_is_rejected` test for `execute_distribution`.
- After `exit()` succeeds, both `record_evidence` and `execute_distribution` reject with a specific typed error on every subsequent call, verified by tests for each entrypoint.
- `exit()` is one-way: a second call is rejected, and no `un-exit`/reversal function is added.
- `exit_status()` returns "not exited" before the transition and the recorded reason plus timestamp after, verified by a test.
- The existing `pause`/`unpause` behavior is unaffected and remains an independent, reversible gate from the new terminal state.
- `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass with zero warnings.
- All five required CI workflows pass on the pull request.

## Quality Standard

This closes a named, open risk in the product brief - it does not paper over it. The issue and its PR description must be explicit that the unresolved question (what happens to funds and legal obligations on exit) is still open; this contract change only ensures the dashboard and any future operator tooling never have to guess or silently misrepresent whether an ally relationship is still active. Do not let the scope creep into fund-recovery logic; that requires a product/legal decision this issue does not have the authority to make.
