# Pilot Production Reliability: Soroban RPC Resilience, Error Tracking, and Database Recovery

| Attribute       | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Issue ID        | C8-006                                                                             |
| Area            | API                                                                                |
| Difficulty      | High                                                                               |
| Labels          | backend, frontend, shared, stellar, logging, performance, high                     |
| Dependencies    | C6-002, C7-004, C7-007                                                             |
| Estimated Lines | 3,500-4,500 (shared RPC layer, integrations in two apps, scripts, tests, runbooks) |

## Context

The product brief stakes the dashboard's credibility on a skeptical investor seeing "a pattern of reliability." Today the pilot has no defense against routine infrastructure failures and no way to notice when they happen. The gaps below share one theme: the pilot should survive routine failures, and operators should find out when it does not.

- **One RPC endpoint, no retry.** `resolveSorobanRpcUrl` (`apps/shared/src/contracts/clientConfig.ts:17-28`) returns exactly one URL. `services/pilot/reads.ts` calls the generated clients with no retry or timeout policy. `PilotPayoutEvidenceReader.hasEvidence` (`apps/api/src/services/PilotPayoutEvidenceReader.ts:67-79`), which the escalation job depends on, calls `simulateTransaction` once and throws. The only retry in the dashboard is `useAsyncState`'s `retry`, an alias for `execute` (`apps/webapp/src/hooks/useAsyncState.ts:93`), meaning a human clicking a button. When the public RPC rate-limits or goes down, the investor and ally dashboards go blank, and the escalation job can misread an RPC outage as an ally that did not report.
- **Zero error tracking.** `apps/api`, `apps/webapp`, and `apps/akkuea-land` have no error-tracking or APM dependency. `logger.ts` writes structured logs that go nowhere. The escalation job, notification worker, rate limiter, and webapp `ErrorBoundary` all fail silently from an operator's point of view.
- **No backup or recovery.** `docs/operations/` has no backup, restore, or incident document. The Postgres database holds whitelist requests, the audit trail, notifications, the DLQ, and escalation state, and there is no tested way to restore it.

## What Needs to Be Done

- **RPC resilience in `@akkuea/shared`:** support an ordered list of RPC endpoints per network (primary plus fallbacks, from configuration), with bounded exponential-backoff retry on transient errors only (timeouts, 429, 5xx). Never retry deterministic contract errors or submitted transactions. Add per-call timeouts. Wire it into `clientConfig.ts`, the webapp pilot reads, `PilotPayoutEvidenceReader`, and the escalation job.
- **Stale data in the dashboard:** keep the last successful read and show it with the existing `FreshnessIndicator` when live reads fail, instead of a blank error. The UI must say plainly that the data is stale and how old it is.
- **Escalation correctness:** the escalation job must treat "RPC unavailable" as unknown, never as "ally did not report," and must alert on repeated unknowns.
- **Error tracking:** integrate one error-tracking provider (record the choice in `docs/strategy/decision-log.md`, and prefer an option that can be self-hosted) into the API (the `errorHandler` middleware, workers, and uncaught errors) and the webapp (`ErrorBoundary`, `PageErrorFallback`, `SectionErrorFallback`, and global handlers). Scrub PII and wallet-signing payloads before sending. It must be a no-op when unconfigured.
- **Database recovery:** add backup and restore scripts, a documented schedule and retention, and a restore procedure that has actually been rehearsed. Add an incident-response runbook covering RPC outage, API outage, database loss, and suspected key compromise, cross-linked to the existing pause runbooks.

## Acceptance Criteria

- With the primary RPC endpoint returning errors in a test, pilot reads succeed through the fallback. Transient errors are retried within bounds, and contract errors are never retried. Tests cover each case.
- When every endpoint fails, the investor and ally dashboards show the last known data with a visible staleness indicator rather than a blank screen. A component test covers it.
- The escalation job does not escalate an ally when RPC is unavailable, and it records and alerts the unknown state. A test covers it.
- Errors thrown in the API handler, the workers, and a webapp error boundary reach the configured provider in tests, with PII and signing payloads scrubbed. With the provider unconfigured, nothing is sent and nothing fails.
- Backup and restore scripts exist, a restore has been rehearsed against a scratch database (steps and output in the PR), and the incident-response runbook exists under `docs/operations/`.
- New environment variables are documented in `docs/deployment/environment-variables.md` and validated in `apps/shared/src/env/schemas.ts`.
- All five required CI workflows pass on the pull request.

## Quality Standard

Resilience must never become dishonesty. A fallback may show older data, but it must always say that it is older, and a failure to read must never be reported as a fact about the ally. Retrying applies to reads only. Nothing in this issue may re-submit a transaction.
