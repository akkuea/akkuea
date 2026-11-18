# Test the untested event hooks and the onboarding helper

| Field           | Value       |
| --------------- | ----------- |
| ID              | C9-014      |
| Area            | AKKUEA-LAND |
| Difficulty      | Medium      |
| Dependencies    | C5-007      |
| Estimated Lines | 200-350     |

## Context

`apps/akkuea-land/src/hooks/` has four hooks and tests for two of them. `useGameEventStream.ts` and `useMapEvents.ts` (117 lines, the logic that turns contract events into map state) have none. In `apps/akkuea-land/src/lib/`, every module with logic has a test except `onboarding.ts`, the small helper that remembers per wallet whether onboarding was completed.

These files decide what a new player sees: whether the map reflects a purchase, and whether onboarding is shown again. Akkuea Land is the pilot's onboarding companion, so a regression here is the first thing a prospective investor meets.

## What Needs to Be Done

- Add `hooks/__tests__/useGameEventStream.test.ts`: connect, receive an event, reconnect after an error, and cleanup on unmount.
- Add `hooks/__tests__/useMapEvents.test.ts`: each event type the hook handles updates the map state as expected, and an unknown or malformed event is ignored.
- Add `lib/__tests__/onboarding.test.ts`: not complete by default, complete after `markComplete`, kept separate per wallet address, and `isComplete` returning false when `window` is undefined.
- Use the existing test setup in `apps/akkuea-land/src/test/` and the patterns in the tests that already exist.
- If a test exposes a bug, fix it in the same PR and describe it.

## Scope

In scope: the three new test files, and small fixes for bugs the tests expose.

Out of scope: refactoring the hooks (C9-013 covers the dashboard stream), component tests, e2e tests.

## Acceptance Criteria

- [ ] The three files have tests that cover the success path and at least one failure path each.
- [ ] No test is skipped and no real network connection is opened.
- [ ] `bun test` passes in `apps/akkuea-land`.
- [ ] Any bug fixed is listed in the PR description with the test that caught it.

## How to Verify

```bash
cd apps/akkuea-land
bun test
bun run lint && bun run type-check
```

## Files and Locations

| File                                                        | What is there today                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/akkuea-land/src/hooks/useGameEventStream.ts`          | 30 lines, no test                                                          |
| `apps/akkuea-land/src/hooks/useMapEvents.ts`                | 117 lines, no test                                                         |
| `apps/akkuea-land/src/lib/onboarding.ts`                    | 8 lines, no test                                                           |
| `apps/akkuea-land/src/hooks/__tests__/`                     | Tests for `useGameWallet` and `usePropertyActions`, the patterns to follow |
| `apps/akkuea-land/src/lib/__tests__/soroban-poller.test.ts` | Example of testing event handling                                          |

## Implementation Steps

1. Read the three files and list every branch.
2. Write the hook tests with `renderHook` and a stubbed `EventSource`.
3. Write the onboarding tests against `localStorage`.

## Code Example

```typescript
it("keeps onboarding state separate per wallet", () => {
  onboarding.markComplete("GAAA");
  expect(onboarding.isComplete("GAAA")).toBe(true);
  expect(onboarding.isComplete("GBBB")).toBe(false);
});
```

## Testing Guidance

- Clear `localStorage` between tests.
- Do not open a real connection: stub `EventSource` and `fetch`.
