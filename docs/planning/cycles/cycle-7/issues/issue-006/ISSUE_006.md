# Track and Report Whitelist and Evidence Review Turnaround Time

## Context

`docs/strategy/product-brief.md` lists, as an explicit Engineering/output Success Criterion independent of whether an ally is signed yet: "Whitelist-review and evidence-review turnaround time (SLA) defined and tracked." The raw data already exists for half of this - `apps/api/src/db/schema/pilotWhitelist.ts` stores `createdAt` and `reviewedAt` on every whitelist request - but nothing computes a turnaround duration from them, no SLA target is defined anywhere in this repository's documentation, and there is no endpoint or report exposing this to an operator. The evidence-review half has no tracking at all yet.

## What Needs to Be Done

- Define a concrete SLA target for whitelist review (e.g., reviewed within N business hours of submission) and record it in `docs/operations/` or `docs/strategy/`, following this project's standing practice of writing decisions down rather than leaving them implicit.
- Add a metrics endpoint (for example `GET /pilot/whitelist/metrics`) that computes turnaround statistics - count, mean, median/p95, and the count/percentage currently breaching the defined SLA - from the existing `createdAt`/`reviewedAt` columns over a queryable time window.
- Extend the same measurement to evidence-review turnaround. Evidence cycles are recorded on-chain by `pilot-payout-split`'s `record_evidence`, already timestamped; read this via Soroban RPC rather than introducing a new database table, consistent with this project's "no new database table for anything already on-chain" principle established for the read-only dashboard.
- Structure the output so it can be consumed by both a human (a simple report/log) and, if C7-007 (the proactive escalation job) lands, by that job's breach-detection logic, without building either as a one-off.

## Acceptance Criteria

- A defined whitelist-review SLA target exists in the documentation, with a stated rationale (even a provisional one, explicitly marked as revisable once a real ally's expectations are known).
- `GET /pilot/whitelist/metrics` (or equivalently named endpoint) returns count, mean, median/p95, and SLA-breach count for whitelist review turnaround over a configurable window, verified by tests using seeded request records with known timestamps.
- Evidence-review turnaround is computed from on-chain evidence-cycle timestamps (via RPC), not a new database table, and is exposed through the same or a parallel endpoint.
- The endpoint(s) require the same authorization already applied to other operator-only surfaces in this API (not public).
- All five required CI workflows pass on the pull request.

## Quality Standard

An SLA that is "tracked" only in the sense that the raw timestamps happen to exist in a database column, with no one ever computing or looking at the derived number, is not actually tracked. This issue's job is to make the number real, visible, and comparable against an actual stated target - not just to prove the underlying data was always technically present.
