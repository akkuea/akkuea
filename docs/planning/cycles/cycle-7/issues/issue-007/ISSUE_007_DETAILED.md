# C7-007: Proactive Escalation Job for Allies Who Miss Two Consecutive Reporting Cycles

## Issue Metadata

| Attribute       | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Issue ID        | C7-007                                                                |
| Area            | API                                                                   |
| Difficulty      | High                                                                  |
| Labels          | api, backend, high                                                    |
| Dependencies    | C6-001                                                                |
| Estimated Lines | 300-500 (worker, RPC read + dedupe logic, notification wiring, tests) |

**Description**

Add a scheduled backend job that proactively detects and notifies an operator when the pilot ally has missed two consecutive expected evidence-reporting cycles, instead of leaving this as a passive dashboard-only signal.

**Requirements and context**

- Structural template: `apps/api/src/workers/kycExpiryJob.ts` - read it fully first to match this codebase's existing job-scheduling convention (poll interval, error handling, how it's registered/started) rather than introducing a second, inconsistent pattern.
- Delivery mechanism: `apps/api/src/workers/notificationWorker.ts` and `NotificationService` already handle outbound notification delivery with retry/backoff (`retryBaseDelayMs`, `maxRetryDelayMs`, `requestTimeoutMs` are already config surface on `NotificationWorkerConfig`). Enqueue through this existing path; do not build a second delivery mechanism.
- On-chain read: evidence-cycle timestamps come from `pilot-payout-split`'s `record_evidence` history. Use the C7-004 generated client if it has landed; otherwise follow `StellarService`'s existing RPC-calling convention.
- Dedup state: since the source of truth is on-chain (no new database table for the evidence data itself), a small piece of job-local state is still needed to avoid re-notifying every poll - either a minimal new table recording "last escalation notified for cycle N" (acceptable, since this is genuinely new operational metadata, not a cache of on-chain data) or an idempotency check against the notification service's own history, whichever fits this codebase's existing conventions better. State the choice and why in the PR description.

**Suggested execution**

1. `git checkout -b feature/pilot-ally-escalation-job`
2. Read `kycExpiryJob.ts` and `notificationWorker.ts` end to end.
3. Implement the RPC read for evidence-cycle history and the two-cycle-gap detection logic as a pure, independently testable function first (input: cycle history + expected cadence; output: breach yes/no + which cycle).
4. Wrap that pure function in the scheduled job, wired to `NotificationService` for delivery.
5. Add the dedup/idempotency mechanism decided above.
6. Make cadence and threshold configurable via environment variables, with sane documented defaults.
7. Register the job's startup alongside the existing `kycExpiryJob`/`notificationWorker` bootstrapping, wherever that happens today (check the API's entrypoint).

**Test and commit**

- [ ] Pure breach-detection function has unit tests covering exact-boundary cases (exactly one cycle missed, exactly two, more than two, no gap)
- [ ] Job-level test proves a notification is enqueued exactly once per newly detected breach
- [ ] Job-level test proves no duplicate notification on a subsequent poll while the same breach persists
- [ ] Job degrades gracefully on a simulated RPC failure (logs, does not crash, retries per existing convention)
- [ ] All five required CI workflows pass

Example commit:
`git commit -m "feat(api): add proactive escalation job for missed ally reporting cycles"`

**Guidelines**

- Do not hardcode the reporting cadence or the two-cycle threshold; both are pilot-agreement-specific and will differ once a real ally is signed.
- Reuse the existing notification delivery and retry/backoff conventions exactly; do not introduce a second webhook or delivery mechanism for this one job.
