# Escalation job looks for cycle-N ids while evidence is recorded as YYYY-MM, so every cycle looks missed

| Field           | Value   |
| --------------- | ------- |
| ID              | C9-006  |
| Area            | API     |
| Difficulty      | Medium  |
| Dependencies    | C7-007  |
| Estimated Lines | 150-300 |

## Context

`buildExpectedCycles` in `apps/api/src/workers/pilotEscalation/expectedCycles.ts` names the cycles it expects `cycle-1`, `cycle-2`, and so on, one every `cadenceDays` (30 by default) after the agreement start. `pilotEscalationJob.ts` then calls `get_evidence` for each of those ids.

The ally submits evidence from the dashboard, where a cycle is one calendar month named `YYYY-MM` (`apps/webapp/src/services/pilot/cycles.ts`, `currentCycle.ts`). The two never match. An ally who reports every month on time still has zero matching evidence records, so the job reports a breach and notifies the operator after the second month, and keeps re-notifying.

## What Needs to Be Done

- Make the job derive expected cycles as calendar months in `YYYY-MM`, from the agreement start month up to the last month whose payment day has passed.
- Take the payment day from configuration, with the same default and bounds the webapp uses (day 5, 1 to 28).
- Remove the `cycle-` prefix and the day-based cadence, or keep `PILOT_ESCALATION_CADENCE_DAYS` only if it still has a defined meaning. Update `docs/deployment/environment-variables.md` and `.env.example` either way.
- Update the tests for `expectedCycles`, `detectMissedCycles` and the job.

## Scope

In scope: `apps/api/src/workers/pilotEscalation/`, `pilotEscalationJob.ts`, their tests, env docs.

Out of scope: the notification content, the contract, the webapp.

## Acceptance Criteria

- [ ] With an agreement starting in January and evidence recorded for `2026-01` and `2026-02`, the job reports no breach in March.
- [ ] With no evidence for two consecutive months whose payment day has passed, the job reports a breach and notifies once.
- [ ] A month whose payment day has not passed yet is not counted as missed.
- [ ] Year boundaries are covered: December to January produces `2026-12` then `2027-01`.
- [ ] `bun test` passes in `apps/api`.

## How to Verify

```bash
cd apps/api
bun test src/workers
bun run lint && bun run type-check
```

## Files and Locations

| File                                                        | What is there today                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/api/src/workers/pilotEscalation/expectedCycles.ts:33` | Default `cycleIdPrefix = 'cycle-'`                           |
| `apps/api/src/workers/pilotEscalation/expectedCycles.ts:47` | Loop that builds `cycle-<index>` every `cadenceDays`         |
| `apps/api/src/workers/pilotEscalationJob.ts:181`            | Call to `buildExpectedCycles`                                |
| `apps/webapp/src/services/pilot/cycles.ts`                  | `enumerateCycles` and `expectedAtFor`, the behavior to match |
| `apps/webapp/src/services/pilot/config.ts:97`               | `pilotPaymentDay()`, default 5, bounds 1 to 28               |

## Implementation Steps

1. Rewrite `buildExpectedCycles` to take `agreementStartAt` and `paymentDay` and return months in `YYYY-MM`.
2. A cycle is expected once `now` is at or after the payment day of the following month, in UTC.
3. Add `PILOT_ESCALATION_PAYMENT_DAY` to the job configuration and the env docs.
4. Update the tests.

## Code Example

```typescript
export function buildExpectedCycles(
  config: ExpectedCyclesConfig,
  now = new Date(),
): ExpectedCycle[] {
  const cycles: ExpectedCycle[] = [];
  let year = config.agreementStartAt.getUTCFullYear();
  let month = config.agreementStartAt.getUTCMonth() + 1;
  for (;;) {
    // Month is 1-based here and 0-based in Date.UTC, so this is the following month.
    const dueAt = new Date(Date.UTC(year, month, config.paymentDay));
    if (dueAt.getTime() > now.getTime()) break;
    cycles.push({
      cycleId: `${year}-${String(month).padStart(2, "0")}`,
      dueAt,
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return cycles;
}
```

## Testing Guidance

- Fix `now` in every test. Do not depend on the real clock.
- Cover the day before and the day of the payment date, and the December to January boundary.
