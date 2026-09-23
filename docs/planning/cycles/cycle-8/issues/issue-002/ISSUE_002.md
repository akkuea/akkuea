# Investor Settlement, End to End: EURC Opt-In, Payout History, Withheld-Fund Release, and Verifiable Evidence

| Attribute       | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Issue ID        | C8-002                                                                    |
| Area            | WEBAPP                                                                    |
| Difficulty      | High                                                                      |
| Labels          | frontend, smart-contract, contracts, soroban, tokenization, high          |
| Dependencies    | C6-002, C7-001, C7-002, C7-004                                            |
| Estimated Lines | 4,500-5,500 (contract additions, client regen, dashboard features, tests) |

## Context

Cycle 7 shipped several investor-facing capabilities at the contract level that no investor can reach, and it left one fund-safety gap. They share one theme: what an investor can see, control, and verify about their own money.

- **EURC opt-in has no UI.** `set_currency_preference` and `get_currency_preference` (`pilot-payout-split/src/lib.rs:791-810`) are implemented, tested, and exposed through the generated client, but nothing in `apps/webapp/src` calls them. The product brief's "Investors may opt into EURC" is currently impossible for an investor to do.
- **Withheld USDC can never be released.** When a holder's EURC swap leg fails, the contract records a `SwapFailureRecord` and, per its own doc comment (`lib.rs:72-74`), "the corresponding USDC stays in this contract, reserved for the affected holder." No function releases it. `DataKey` (`storage.rs:7-23`) has no reserved-balance key, and there is no claim, retry, or release entry point. A holder whose swap fails loses access to that cycle's payout permanently.
- **Payout history is not durable.** `DistributionSummary` (`lib.rs:141-160`) is only returned and emitted as an event (`lib.rs:706-719`). It is never stored. The codebase already follows the rule that facts investors rely on must outlive the RPC event retention window (`EvidenceRecord.distributed_at`'s own comment says exactly this), but the fee, EURC total, and failed-leg totals for each cycle, and which currency each holder was actually paid in, do not.
- **The dashboard never shows terminal state.** `InvestorDashboard.tsx` is 68 lines and reads neither `exit_status` nor `wound_down_status` (C7-002), nor `is_paused`. An investor in a wound-down pilot sees stale "pending" cycles with no explanation.
- **"Auditable" is not verifiable from the dashboard.** `EvidenceReviewQueue.tsx:115-118` only shortens and displays the recorded hash next to a link. Nothing re-fetches the linked document and re-hashes it, even though `services/pilot/evidenceHash.ts` already says "anyone can re-hash the document later and check it against the chain."

## What Needs to Be Done

- **Contract (`pilot-payout-split`), additive only:** persist each cycle's `DistributionSummary` and each holder's settlement outcome for that cycle (currency paid, amount, or withheld), readable after the event retention window. Track withheld USDC per holder, and add a holder-authorized release path, for example `claim_withheld(holder)` paying the reserved USDC in USDC. Decide whether a retry-as-EURC option is worth its complexity and record the choice. Regenerate the typed client in `apps/shared/src/contracts/pilot/`.
- **EURC opt-in:** an investor settings control that reads the current preference and signs `set_currency_preference` with the connected wallet, with an explanation of swap and price-floor risk before opting in.
- **Payout history:** a per-cycle view of what this investor actually received, the currency, and a link to the transaction on stellar.expert, read from the persisted on-chain records rather than recomputed.
- **Withheld funds:** a clear withheld-balance state with a one-click claim action.
- **Terminal and paused state:** a banner in both the investor and ally dashboards for exited or wound-down pilots (reason and timestamp from chain) and for a paused payout contract.
- **Evidence verification:** a "verify this evidence" action, in the investor view and the operator review queue, that fetches the linked document, re-computes SHA-256 in the browser, and shows match, mismatch, or unreachable. Unreachable includes CORS-blocked sources, and in that case the user can hash a file they downloaded themselves instead.

## Acceptance Criteria

- A test drives an investor through opting into EURC, and the contract preference changes on testnet.
- After a distribution, the investor view shows the amount and currency actually paid for that cycle, read from new persisted contract state, and still does so when no events are available. A test mocks an empty event response to prove this.
- A holder with a failed EURC swap leg sees the withheld amount and can claim it. A contract test asserts exact balances before and after the claim, a double claim is rejected with a typed error, and nobody can claim another holder's funds.
- A contract test proves that withheld funds are never included in any other holder's distribution or in the platform fee.
- Exited, wound-down, and paused states each render a distinct, design-system-consistent banner with the on-chain reason and timestamp where one exists. Each has a test.
- Evidence verification reports match, mismatch, and unreachable correctly. Unit tests cover all three, including a tampered-document fixture.
- `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass, and the existing proptest suite (`proptests.rs`) still passes after the storage changes.
- All new UI follows `docs/design-system/`, has Storybook stories, and ships English and Spanish strings.
- All five required CI workflows pass on the pull request.

## Quality Standard

This issue closes the gap between what the contract does and what an investor can prove. Two rules are non-negotiable. First, no investor funds may be stranded by design: every unit of USDC the contract withholds must have an owner and a release path, enforced and tested on-chain. Second, every number the investor view shows must come from stored contract state, never from client-side recomputation that could drift from what was actually transferred.
