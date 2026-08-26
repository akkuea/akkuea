# C7-006: Track and Report Whitelist and Evidence Review Turnaround Time

## Issue Metadata

| Attribute       | Value                                            |
| --------------- | ------------------------------------------------ |
| Issue ID        | C7-006                                           |
| Area            | API                                              |
| Difficulty      | High                                             |
| Labels          | api, backend, documentation, high                |
| Dependencies    | C6-001, C6-008                                   |
| Estimated Lines | 300-450 (endpoint, RPC read helper, docs, tests) |

**Description**

Compute and expose the whitelist- and evidence-review turnaround-time SLA that `docs/strategy/product-brief.md` names as a required engineering success criterion, using data that already exists but is never aggregated or surfaced today.

**Requirements and context**

- `apps/api/src/db/schema/pilotWhitelist.ts` has `createdAt` and `reviewedAt` (nullable until reviewed) on `pilotWhitelistRequests`. Turnaround = `reviewedAt - createdAt` for reviewed requests; pending requests older than the SLA target are themselves a breach signal worth surfacing.
- No SLA target exists anywhere today - this issue is where it gets decided and written down, not inferred. A reasonable starting point (documented as provisional, revisable once a real ally's actual needs are known) is in scope to propose; the important part is that it is explicit and recorded, in `docs/operations/` alongside this project's other operational runbooks (see `docs/operations/runbook-oracle-failure.md` for the sibling pattern of a concrete, documented operational commitment).
- Evidence-cycle timestamps live on-chain in `pilot-payout-split` (via `record_evidence`); reading them requires a Soroban RPC call, not a database query. If C7-004's typed client bindings have landed, use them; if not, use whatever RPC-calling convention `apps/api/src/services/StellarService.ts` already establishes.
- Follow this API's existing route/controller/service layering (see `WhitelistController`/`WhitelistService`/`routes/whitelist.ts` as the closest sibling) rather than introducing a new architectural pattern for one endpoint.

**Suggested execution**

1. `git checkout -b feature/pilot-review-sla-tracking`
2. Write the SLA-target decision into `docs/operations/` (new file, e.g. `docs/operations/pilot-review-sla.md`), stating the target and its rationale.
3. Add a `getTurnaroundMetrics()` method to `WhitelistService` (or a new `WhitelistMetricsService`, if that keeps the existing service focused) computing count/mean/median/p95/breach-count from the existing schema.
4. Add the `GET /pilot/whitelist/metrics` route, gated by whatever operator-only auth pattern this API already uses elsewhere (check `routes/admin.ts` for the established convention).
5. Add the evidence-review turnaround read path via Soroban RPC, following the same metrics shape.
6. Seed test fixtures with known, deterministic timestamps to make the statistical assertions exact rather than approximate.
7. Cross-link the new endpoint's response shape in the PR description with C7-007's planned consumption, if that issue is being worked in parallel, so the two don't diverge on format.

**Test and commit**

- [ ] Unit tests cover the metrics computation against seeded, deterministic timestamp fixtures (exact mean/median/p95 assertions, not just "returns a number")
- [ ] Endpoint requires operator authorization; unauthorized calls return 401/403
- [ ] Evidence-review turnaround is read from on-chain state, not a new database table
- [ ] `docs/operations/` gains the documented SLA target
- [ ] All five required CI workflows pass

Example commit:
`git commit -m "feat(api): track and report whitelist and evidence review turnaround time"`

**Guidelines**

- Do not introduce a new database table to cache on-chain evidence timestamps; read them live via RPC, consistent with this project's stated principle for anything already available on-chain.
- Keep the SLA target changeable without a code change if practical (a config value, not a magic number buried in the metrics computation).
