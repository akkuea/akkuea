# C6-001: Implement the Pilot's Income Token, Whitelist, and Payout-Split Contracts

## Issue Metadata

| Attribute       | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Issue ID        | C6-001                                                      |
| Area            | CONTRACT                                                    |
| Difficulty      | High                                                        |
| Labels          | smart-contract, contracts, soroban, high                    |
| Dependencies    | None                                                        |
| Estimated Lines | 4500-6500 (implementation, tests, deployment scripts, docs) |

**Description**

Implement the pilot's own contract surface: `pilot-income-token`, `pilot-whitelist`, and `pilot-payout-split`, three independent Soroban contracts under `apps/contracts/contracts/`, replacing nothing in `defi-rwa`.

**Requirements and context**

- `pilot-income-token`: SEP-41-compatible read surface (`balance`, `name`, `symbol`, `decimals`, `total_supply`) but `transfer` restricted to admin-only (non-transferable in v1, per the product brief). Mint is a one-time, admin-only operation against the whitelist's approved set.
- `pilot-whitelist`: `approve(admin, address)`, `revoke(admin, address)`, `is_approved(address) -> bool`. Admin-gated writes, public reads.
- `pilot-payout-split`: `record_evidence(caller_1, caller_2, cycle_id, evidence_hash, evidence_link, total_income)` requiring both operator and ally signatures (two-signer, native Soroban multi-sig auth via `require_auth` on both addresses), `execute_distribution(cycle_id)` which computes `fee = total_income * 10 / 100`, `remaining = total_income - fee`, and transfers `remaining` pro-rata to every address the income-token contract reports as a current holder, in USDC (invoke the SEP-41 `transfer` on the USDC SAC).
- Enforce access control using role checks (operator address, ally address, both stored at contract init), consistent with the `defi-rwa` contract's `access/roles.rs` pattern.
- Include reentrancy protection where external calls are made (the USDC transfer in `execute_distribution`).
- Prevent panic on overflow/underflow; use checked arithmetic throughout the fee and pro-rata math.
- Include an admin-controlled pause function on `pilot-payout-split`, mirroring the `emergency_pause` pattern in `defi-rwa` (same 24-hour timelock philosophy is not required here since this is a smaller, lower-blast-radius contract, but a simple pause/unpause gate is).

**Suggested execution**

1. `git checkout -b feature/pilot-contracts-income-token-whitelist-payout-split`
2. Scaffold three new crates under `apps/contracts/contracts/pilot-income-token/`, `pilot-whitelist/`, `pilot-payout-split/`, each with its own `Cargo.toml`, following the existing `game-*` contracts as the structural template (they're the most recent addition to this workspace and already establish the multi-contract-per-workspace pattern).
3. Implement `pilot-whitelist` first (no dependencies on the other two).
4. Implement `pilot-income-token`, reading the whitelist contract's `is_approved` at mint time via cross-contract call.
5. Implement `pilot-payout-split`, reading both the whitelist and the income-token contract's holder set via cross-contract calls.
6. Add comprehensive contract-level and function-level doc comments to all three.
7. Write `apps/contracts/contracts/pilot-payout-split/tests/` covering the acceptance criteria's failure modes explicitly, plus a full happy-path integration test that mints, approves five holders with uneven balances, records evidence, and asserts exact per-holder payout amounts after the 10% fee.
8. Write a deployment script following `scripts/deploy-game-contracts.sh` as the template, and a corresponding `docs/deployment/deploy-pilot-contracts.md`.
9. Record the testnet deployment in `apps/shared/src/contracts.testnet.json` and `docs/contracts/deployment.md`, following the existing deployment-record format.

**Test and commit**

- [ ] All unit tests pass (`cargo test`)
- [ ] 100% branch coverage on new/changed logic
- [ ] Contracts compile with the current stable Soroban SDK version and `stellar contract build` (target `wasm32v1-none`)
- [ ] Soroban CLI simulation succeeds for every public function
- [ ] No high/medium severity issues from `cargo clippy`
- [ ] Invocation budget for `execute_distribution` stays within a reasonable bound for a holder set of realistic size (document the tested holder-count ceiling)
- [ ] Two-signer enforcement is proven by a test that submits only one signature and asserts rejection

Example commit:
`git commit -m "feat(contracts): implement pilot income token, whitelist, and payout-split contracts"`

**Guidelines**

- Use the current stable Soroban SDK version already pinned in `apps/contracts/Cargo.toml` / workspace lockfile.
- Never hardcode secret or private keys in source, tests, or deployment scripts.
- All public and external functions must have full doc comments.
- PR description must include simulation output and budget usage for `execute_distribution` and `mint`, the two functions most likely to be cost-sensitive.
- Tests must cover failure modes and edge cases, not only the happy path.
- Do not add a token-transferability path, even behind a flag. It is explicitly Phase 2 scope.
