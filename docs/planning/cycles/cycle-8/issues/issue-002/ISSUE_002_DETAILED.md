# C8-002: Investor Settlement, End to End: EURC Opt-In, Payout History, Withheld-Fund Release, and Verifiable Evidence

## Issue Metadata

| Attribute       | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Issue ID        | C8-002                                                                    |
| Area            | WEBAPP                                                                    |
| Difficulty      | High                                                                      |
| Labels          | frontend, smart-contract, contracts, soroban, tokenization, high          |
| Dependencies    | C6-002, C7-001, C7-002, C7-004                                            |
| Estimated Lines | 4,500-5,500 (contract additions, client regen, dashboard features, tests) |

**Description**

Make what the contract already does for investors reachable and verifiable, and close the one gap that strands investor funds. The full context is in `ISSUE_002.md`.

**Requirements and context**

- Contract, `apps/contracts/contracts/pilot-payout-split/`:
  - `DataKey` (`src/storage.rs:7-23`) has `SwapFailures(String)` but no per-holder reserved balance and no stored summary. Add, for example, `Distribution(String)` for a stored `DistributionSummary`, `HolderSettlement(String, Address)` for the per-cycle outcome, and `Withheld(Address)` for the running reserved USDC.
  - `DistributionSummary` is built at `src/lib.rs:706-717` and only emitted (`events::emit_distribution_executed`, `src/events.rs:79`). Persist it at the same point.
  - The swap-failure branch records a `SwapFailureRecord` (`src/lib.rs:72-82`). Increment the holder's withheld balance there, in the same code path, so the two can never diverge.
  - Add `claim_withheld(holder)`: `holder.require_auth()`, pay the full reserved USDC, zero it, emit an event, and use the typed error `NothingToClaim` on zero. Decide whether claims stay allowed after `exit` (recommended: yes, since exit must never trap funds) and record the reasoning.
  - Follow the existing storage TTL conventions in `storage.rs` so the persisted records outlive the event retention window.
- Typed clients: regenerate `apps/shared/src/contracts/pilot/payout-split.ts` using the C7-004 generation script.
- Webapp:
  - `services/pilot/reads.ts:147-215`: add `fetchCurrencyPreference`, `fetchHolderSettlement(cycleId, address)`, `fetchDistributionSummary(cycleId)`, `fetchWithheld(address)`, `fetchExitStatus`, and `fetchWoundDownStatus` (the income token's `wound_down_status`, `pilot-income-token/src/lib.rs:228`).
  - `services/pilot/writes.ts`: add `setCurrencyPreference` and `claimWithheld`, following the existing `payoutClient` and `send` helpers (`writes.ts:33-66`).
  - `InvestorDashboard.tsx` (68 lines) and `AllyDashboard.tsx`: add a settings card, a payout history table, a withheld-funds card, and a `PilotStatusBanner` for exited, wound-down, and paused states. `usePayoutPaused` already exists in `hooks/usePilotContract.ts`.
  - Evidence verification: reuse the SHA-256 helpers in `services/pilot/evidenceHash.ts`, respect `MAX_EVIDENCE_FILE_BYTES`, and wire the action into `EvidenceReviewQueue.tsx:115-118` and the investor cycle detail.

Example: persisting the outcome in the same branch that decides it:

```rust
// Inside execute_distribution's per-holder loop, on a rejected swap leg:
failures.push_back(SwapFailureRecord { holder: holder.clone(), amount_usdc: share, reason_code });
Storage::add_withheld(&env, &holder, share)?;           // checked add, typed error on overflow
Storage::set_holder_settlement(&env, &cycle_id, &holder,
    &HolderSettlement::Withheld { amount_usdc: share, reason_code });
```

```ts
// Browser-side verification against the on-chain hash.
const res = await fetch(evidenceLink, { mode: "cors" });
if (!res.ok) return { state: "unreachable" as const };
const digest = await digestBlob(await res.blob()); // from evidenceHash.ts
return { state: digest.hex === onChainHashHex ? "match" : "mismatch" } as const;
```

**Suggested execution**

1. `git checkout -b feature/pilot-investor-settlement`
2. Contract first: storage keys, persistence in `execute_distribution`, withheld accounting, `claim_withheld`, errors and events, then tests. Re-run `proptests.rs` and extend it with the invariant "sum of withheld equals sum of undistributed failed swaps across cycles minus claims."
3. Measure `execute_distribution`'s budget with the extra writes against `budget_check_execute_distribution_for_ten_holders` (`lib.rs:2138`) and report it in the PR.
4. Regenerate the clients and deploy to testnet.
5. Build the reads and writes, then the components with stories, then wire them into both dashboards.
6. Add the `docs/strategy/decision-log.md` entry on the withheld-release design.

**Test and commit**

- [ ] Contract tests: persisted summary equals the returned summary, per-holder settlement for USDC, EURC, and withheld outcomes, exact balances around `claim_withheld`, double-claim rejection, cross-holder claim rejection, claim after exit, and withheld funds excluded from later cycles and from the fee
- [ ] Proptest invariant added and passing
- [ ] Webapp unit and component tests for every new read, write, and component, including verification match, mismatch, and unreachable with a tampered fixture
- [ ] Storybook stories for every new component in all relevant states
- [ ] English and Spanish strings with parity
- [ ] `cargo fmt --all -- --check`, `cargo clippy -- -D warnings`, and all five CI workflows green

Example commit:
`git commit -m "feat(pilot): persist settlement records and add withheld-fund release"`

**Guidelines**

- Every amount shown to an investor must come from stored contract state.
- The withheld balance must be updated in the same code path that records the failure, never reconstructed later.
- Keep contract changes additive. Do not alter existing function signatures that C7-004 clients and the C7-009 suite already depend on.
- Follow `docs/design-system/` for every new component.
