# Dashboard opens a second event stream next to GameEventContext and silences the hook dependency lint

| Field           | Value       |
| --------------- | ----------- |
| ID              | C9-013      |
| Area            | AKKUEA-LAND |
| Difficulty      | Medium      |
| Dependencies    | C5-007      |
| Estimated Lines | 150-300     |

## Context

`apps/akkuea-land/src/context/GameEventContext.tsx` opens an `EventSource` on `/api/game/events` and shares the events with the app. `apps/akkuea-land/src/app/[locale]/dashboard/page.tsx` opens its own `EventSource` in an effect (around line 392), with its own retry timer and polling fallback, and ends that effect with `// eslint-disable-next-line react-hooks/exhaustive-deps`. A third path, `hooks/useGameEventStream.ts`, exists as well.

A player on the dashboard holds two connections to the same endpoint, with two reconnect policies that can drift apart.

## What Needs to Be Done

- Make the dashboard consume events from one shared source instead of opening its own connection.
- Keep what the dashboard needs today: the latest ledger, the polling fallback when the stream is down, and the accrued-income recalculation on each ledger tick.
- Remove the `eslint-disable` by giving the effect correct dependencies.
- Close the connection and clear every timer on unmount.
- Follow `docs/design-system/` if any markup changes.

## Scope

In scope: the dashboard page, the context or hook it uses, tests.

Out of scope: the server route `app/api/game/events`, the map page, game contract calls.

## Acceptance Criteria

- [ ] On the dashboard, exactly one `EventSource` is open, asserted in a test.
- [ ] When the stream fails, the polling fallback still updates the ledger.
- [ ] No `react-hooks/exhaustive-deps` suppression remains in the dashboard page.
- [ ] Unmounting closes the connection and clears timers, asserted in a test.
- [ ] Existing Akkuea Land tests pass.

## How to Verify

```bash
cd apps/akkuea-land
bun run lint && bun run type-check
bun test
```

## Files and Locations

| File                                                       | What is there today                                    |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `apps/akkuea-land/src/context/GameEventContext.tsx:53`     | `new EventSource("/api/game/events")`                  |
| `apps/akkuea-land/src/app/[locale]/dashboard/page.tsx:392` | A second `new EventSource(SSE_ENDPOINT)`               |
| `apps/akkuea-land/src/app/[locale]/dashboard/page.tsx:434` | `eslint-disable-next-line react-hooks/exhaustive-deps` |
| `apps/akkuea-land/src/hooks/useGameEventStream.ts`         | Existing stream hook                                   |
| `apps/akkuea-land/src/app/api/game/events/route.ts`        | The endpoint, not changed here                         |

## Implementation Steps

1. Confirm in the layout tree whether `GameEventContext` wraps the dashboard. If it does, consume it. If not, use `useGameEventStream`.
2. Move the ledger tracking and the polling fallback into the shared source or a small hook.
3. Remove the inline effect and the suppression.

## Code Example

```tsx
const { latestLedger, status } = useGameEvents();

useEffect(() => {
  if (status !== "open") {
    return startLedgerPolling(setLatestLedger);
  }
}, [status]);
```

## Testing Guidance

- Stub `EventSource` in the test and count constructions.
- Assert `close()` is called on unmount.
