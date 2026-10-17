# Pilot Review SLA: Whitelist and Evidence Turnaround

**Status:** Provisional. Revisable once a real allied agency's review expectations are known.
**Audience:** Operators with the internal operations API key
**Related source:** `apps/api/src/services/reviewTurnaround.ts`, `apps/api/src/services/ReviewTurnaroundService.ts`, `apps/api/src/config/pilotReviewSla.ts`

This document is the recorded SLA that `docs/strategy/product-brief.md` requires as an engineering success criterion: whitelist-review and evidence-review turnaround time defined and tracked. The timestamps already existed; this is the target they are compared against, and the operator surface that makes the comparison visible.

---

## Target

| Surface            | Clock starts                         | Clock stops                                      | Provisional target      |
| ------------------ | ------------------------------------ | ------------------------------------------------ | ----------------------- |
| Whitelist review   | `createdAt` on the request row       | `reviewedAt` (approve or reject)                 | **48 hours**            |
| Evidence review    | Cycle due date (`buildExpectedCycles`) | On-chain `recorded_at` from `record_evidence` | **48 hours**            |

A review that completes in exactly 48 hours meets the SLA. Completing later, or remaining pending after 48 hours, is a breach.

### Why 48 hours

The pilot is a single-ally, single-operator flow. Identity review and income-evidence review are both human, weekday work. Two calendar days is a conservative stand-in for two business days of operator coverage, including the case where a request arrives late on a Friday.

This number is **not** a negotiated ally commitment. No ally is under contract yet. Treat 48 hours as the engineering default so the metric is real and comparable, then replace it when a signed agreement states a different expectation.

A true business-hours clock (for example Mon-Fri 09:00-17:00 in an ally's timezone, skipping holidays) is deliberately not implemented. There is no ally timezone or holiday calendar to apply. Changing the number of hours does not require a code change (see [Changing the target](#changing-the-target)). Changing the clock itself (calendar hours to business hours) would.

---

## How it is measured

**Whitelist.** `pilot_whitelist_requests.createdAt` and `reviewedAt`. Turnaround for a reviewed request is `max(0, reviewedAt - createdAt)`. A still-pending request whose age exceeds the SLA is counted as a pending breach. No new columns.

**Evidence.** There is no off-chain submission table, and this project does not add one for data that is already on-chain. `pilot-payout-split.record_evidence` writes `recorded_at` (ledger timestamp). Expected cycle due dates reuse the same agreement start and cadence as the ally-escalation job (`PILOT_ESCALATION_AGREEMENT_START`, `PILOT_ESCALATION_CADENCE_DAYS`). Turnaround for a recorded cycle is `max(0, recorded_at - dueAt)`: on or before the due date counts as 0. An expected cycle with no `record_evidence` whose age past `dueAt` exceeds the SLA is a pending breach. Reads go through Soroban RPC (`PilotPayoutEvidenceReader.get_evidence`), never a cache table.

If the agreement start is unset, evidence metrics are returned as `available: false` with reason `agreement_start_not_configured`. Whitelist metrics still compute. An RPC failure on the evidence read does the same with reason `rpc_error`; it does not fail the whitelist half.

---

## Operator endpoint

```
GET /pilot/whitelist/metrics
```

Same authorization as other operator-only surfaces: header `x-internal-api-key` must match `OPERATIONS_BACKEND_CREDENTIAL`. Missing or wrong key returns 403.

Query parameters (all optional):

| Param        | Meaning                                              | Default                         |
| ------------ | ---------------------------------------------------- | ------------------------------- |
| `from`       | Window start (ISO 8601 with offset)                  | `to` minus `windowDays`         |
| `to`         | Window end (ISO 8601 with offset)                    | now                             |
| `windowDays` | Lookback in days when `from` is omitted              | 30 (`PILOT_REVIEW_METRICS_WINDOW_DAYS`) |

Whitelist rows are selected by `createdAt` in the window. Evidence cycles are selected by `dueAt` in the window.

### Response shape

The JSON is the machine form. `data.report` is the human form (also written as a structured log line on each call). A scheduled job (C7-007 or a later SLA-escalation tick) should key off `breached` / `totalBreachCount` / the `*BreachIds` arrays, not parse `report`.

```json
{
  "success": true,
  "data": {
    "whitelist": {
      "kind": "whitelist",
      "slaTargetHours": 48,
      "slaTargetMs": 172800000,
      "window": { "from": "2026-03-01T00:00:00.000Z", "to": "2026-03-31T00:00:00.000Z" },
      "count": 5,
      "meanMs": 43200000,
      "medianMs": 10800000,
      "p95Ms": 146880000,
      "breachCount": 1,
      "breachPercent": 20,
      "pendingCount": 2,
      "pendingBreachCount": 1,
      "completedBreachIds": ["..."],
      "pendingBreachIds": ["..."],
      "totalBreachCount": 2,
      "breached": true,
      "report": "Whitelist review (...): 5 reviewed, mean 12.00h, ..."
    },
    "evidence": {
      "kind": "evidence",
      "available": true,
      "count": 2,
      "breached": true
    },
    "report": "Whitelist review (...)\nEvidence review (...)"
  }
}
```

`count`, `meanMs`, `medianMs`, and `p95Ms` describe **completed** reviews only. `pendingBreachCount` is the still-open overdue set. `totalBreachCount` is the sum, and `breached` is true when that sum is greater than zero.

Mean, median, and p95 are computed with linear interpolation on the sorted durations. Empty completed sets return `null` for those three fields, not zero.

In process, the same computation lives at `computeReviewTurnaround` / `isReviewSlaBreached` in `apps/api/src/services/reviewTurnaround.ts`. Import those. Do not re-implement breach detection next to the HTTP handler.

### Example

```bash
curl -sS "http://localhost:3001/pilot/whitelist/metrics?windowDays=30" \
  -H "x-internal-api-key: $OPERATIONS_BACKEND_CREDENTIAL"
```

---

## Changing the target

| Variable                            | Default | Effect                                      |
| ----------------------------------- | ------- | ------------------------------------------- |
| `PILOT_WHITELIST_REVIEW_SLA_HOURS`  | `48`    | Whitelist SLA, in calendar hours            |
| `PILOT_EVIDENCE_REVIEW_SLA_HOURS`   | `48`    | Evidence SLA, in calendar hours             |
| `PILOT_REVIEW_METRICS_WINDOW_DAYS`  | `30`    | Default metrics lookback                    |

Restart the API after changing these. No code change, no contract change.

When a signed ally agreement names a different review window, update the env values and replace the numbers in the table at the top of this file in the same change. Keep this document as the source of the stated target, not a comment in the metrics function.

---

## See also

- `docs/strategy/product-brief.md` - engineering success criterion this SLA satisfies
- `apps/api/src/workers/pilotEscalationJob.ts` - consecutive missed-cycle escalation (a different signal: silence, not slow review)
- `docs/deployment/environment-variables.md` - env reference
