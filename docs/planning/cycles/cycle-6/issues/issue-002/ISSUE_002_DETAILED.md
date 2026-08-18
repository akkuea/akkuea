# C6-002: Build the Pilot's Read-Only Dashboard for Allies and Investors

## Issue Metadata

| Attribute       | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Issue ID        | C6-002                                                         |
| Area            | WEBAPP                                                         |
| Difficulty      | High                                                           |
| Labels          | frontend, high                                                 |
| Dependencies    | C6-001                                                         |
| Estimated Lines | 4000-5500 (components, hooks, RPC integration, tests, stories) |

**Description**

Implement the ally evidence-submission flow, the operator review queue, and the investor holdings/cycle-status view, entirely on top of the C6-001 contracts, entirely off on-chain state.

**Requirements and context**

- New routes: `app/[locale]/pilot/ally/page.tsx`, `app/[locale]/pilot/review/page.tsx`, `app/[locale]/pilot/investor/page.tsx` (naming may be adjusted to match existing `[locale]` route conventions in `apps/webapp/src/app`).
- Data layer: a new `hooks/usePilotContract.ts` (or a small set of hooks) wrapping Soroban RPC reads and event subscriptions against the C6-001 contract addresses, following the existing pattern in `apps/webapp/src/services/wallet/` and `hooks/useLendingPools.ts` for API-call shape and error handling, but pointed at RPC/events instead of the internal API.
- Evidence hashing: hash the evidence file client-side (or via a thin API route that only computes and returns a hash, never persists the file) before it is written on-chain by the ally's transaction.
- Cycle-status derivation: a pure function (place it in `apps/shared/src/utils/` so it's testable independent of React and reusable if the API ever needs the same computation) that takes on-chain cycle records plus "today" and returns one of `on-time | late | disputed | not-received`, plus the two-cycles-missed escalation boolean.
- UI: `Stepper` for cycle-by-cycle progress, `FreshnessIndicator` on any RPC-derived value, `EmptyState` for a new investor with no holdings yet, `PageErrorFallback` / `SectionErrorFallback` around each of the three views so one failing RPC call doesn't take down the whole page.
- Wire `PropertyViewer3D` into the investor view, passing the ally property's `splatUrl` if one exists (this may not exist yet for the pilot ally; handle its absence gracefully with a documented empty state, don't block the rest of the page on it).

**Suggested execution**

1. `git checkout -b feature/pilot-dashboard-ally-operator-investor`
2. Confirm the C6-001 contract interface (function signatures, event shapes) before writing hooks against it; coordinate directly with whoever is on C6-001 if it's still in progress.
3. Build the cycle-status derivation utility in `apps/shared/src/utils/pilotCycleStatus.ts` first, with its own unit tests, independent of any UI.
4. Build `usePilotContract.ts` (or equivalent) for reads and event subscriptions.
5. Build the ally view, then the operator review queue, then the investor view, each using the corresponding hook and the design-system components.
6. Add Storybook stories for every new component covering loading, error, empty, and populated states.
7. Wire `PropertyViewer3D` into the investor view's evidence section.

**Test and commit**

- [ ] Component tests cover all four states (loading, error, empty, populated) for each of the three views
- [ ] `pilotCycleStatus` utility has unit tests covering every documented status transition and the two-cycle escalation boundary
- [ ] Manual verification against a real testnet deployment of the C6-001 contracts (not mocked) before merge
- [ ] All interactive elements are disabled during loading/disconnected-wallet states
- [ ] Visual check in both light and dark theme (see `docs/design-system/foundations.md`)
- [ ] All new strings are added to i18n files, consistent with the existing `[locale]` routing pattern

Example commit:
`git commit -m "feat(webapp): add pilot ally, review, and investor dashboard views"`

**Guidelines**

- Use existing component library primitives (`apps/webapp/src/components/ui`) before adding new ones; only add a new component if nothing existing fits.
- No inline styles except for genuinely dynamic values; use the CSS custom properties documented in `docs/design-system/foundations.md`.
- No new database table, no new investor-account concept. If a reviewer suggests one, that's a signal the requirement has drifted from `docs/strategy/product-brief.md`; stop and re-check the brief.
- PR must include before/after screenshots (or a short screen recording) of all three views in the description.
