# Proactive Escalation Job for Allies Who Miss Two Consecutive Reporting Cycles

## Context

`docs/strategy/product-brief.md` requires the investor dashboard to show "an explicit escalation state if the ally goes two cycles without reporting" - but as specified, that is a passive, pull-based signal: someone has to open the dashboard to see it, and the dashboard itself (#1061 / C6-002) is still in progress. This API already has the exact pattern needed to make this proactive instead of passive: `apps/api/src/workers/kycExpiryJob.ts` is a scheduled job that checks a time-based condition and acts on it, and `apps/api/src/workers/notificationWorker.ts` plus `NotificationService` already deliver notifications through a working, tested pipeline. Nothing today connects the two for the pilot's payout cycle.

## What Needs to Be Done

- Add a scheduled job, structured like `kycExpiryJob.ts`, that reads the pilot's on-chain evidence-cycle history from `pilot-payout-split` via Soroban RPC (no new database table - the source of truth is already on-chain) and determines whether the ally has gone two or more expected cycles without a recorded evidence submission.
- When the two-cycle threshold is first crossed, enqueue a notification through the existing `NotificationService`/`notificationWorker` pipeline to the operator. Deduplicate so the same escalation isn't re-sent on every poll interval - only when the breach is first detected, or on a clearly documented re-notification cadence if the condition persists.
- Make the expected reporting cadence and the "two cycles" threshold configurable rather than hardcoded, since both are properties of a specific ally's agreement that doesn't exist yet.

## Acceptance Criteria

- The job runs on a schedule (matching this codebase's existing worker/job invocation pattern) and correctly identifies the two-consecutive-missed-cycles condition from on-chain evidence timestamps, verified by tests using a mocked/stubbed RPC response with controlled cycle histories.
- A notification is enqueued exactly once when the threshold is first crossed for a given cycle gap, and not repeated on every subsequent poll while the same gap persists, verified by a test.
- The cadence and threshold are configurable (environment variable or equivalent), not hardcoded, and documented.
- The job degrades gracefully (logs and retries or backs off, does not crash the process) if the RPC read fails transiently, consistent with `notificationWorker.ts`'s existing retry/backoff conventions.
- All five required CI workflows pass on the pull request.

## Quality Standard

An ally going dark for two months without anyone at Akkuea noticing until an investor complains is a real business risk this product brief names explicitly - it should not depend on an operator remembering to check a dashboard. The job must be reliable and boringly correct: no false escalations from a transient RPC hiccup, and no missed escalations from an off-by-one in the cycle-counting logic.
