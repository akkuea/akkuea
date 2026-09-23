# Quality Gates for the Pilot Dashboard: Browser E2E for the Evidence Lifecycle, Accessibility, and Visual Regression

| Attribute       | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Issue ID        | C8-008                                                                               |
| Area            | WEBAPP                                                                               |
| Difficulty      | High                                                                                 |
| Labels          | frontend, test, a11y, ci, high                                                       |
| Dependencies    | C6-002, C7-010                                                                       |
| Estimated Lines | 3,000-4,000 (RPC mock layer, e2e specs, a11y checks and fixes, visual baselines, CI) |

## Context

C7-010 gave this repository its first browser end-to-end harness, but it covers only whitelist onboarding and the whitelist review queue (`apps/webapp/e2e/` contains exactly those two specs and mocks only the whitelist API). The flow the product brief's sequence diagram is actually about has no protection at the browser level: an ally submits evidence, the operator starts a review and approves or rejects with a reason, a cycle becomes disputed, and the investor timeline reflects on-time, late, disputed, and not-received status. C7-009's suite is script-level (`smoke:pilot`) and never opens a browser. The gaps below share one theme: a regression in the dashboard investors and the ally actually use should fail CI before it reaches them.

- **No browser e2e for the evidence lifecycle.** All pilot reads go to Soroban RPC, and the Playwright suite has no way to mock that. `e2e/fixtures/` has only `wallet.ts` and `whitelist-api.ts`.
- **No accessibility coverage on the pilot surface.** `apps/webapp/src/components/pilot/__tests__/` has no axe checks. The only a11y test in the webapp is `components/marketplace/__tests__/a11y.check.test.tsx`. Issue #973 covered four base primitives, not the pilot components.
- **No visual regression.** Nothing in the webapp uses `toHaveScreenshot`, even though every pilot component already has a Storybook story (`CycleStatusBadge`, `CycleStatusTimeline`, `EvidenceReviewQueue`, `EvidenceSubmissionForm`, `InvestorHoldingsCard`, `PropertyEvidencePanel`, `WhitelistOnboardingForm`, `WhitelistReviewQueue`).

## What Needs to Be Done

- Build a Soroban RPC mock layer for Playwright: `page.route()` handlers that answer `simulateTransaction`, `getLedgerEntries`, and `sendTransaction`/`getTransaction` with realistic XDR responses, generated from the typed clients so fixtures cannot drift from the contract spec. Provide scenario builders for each cycle state (none, submitted, under review, approved, rejected with reason, disputed, distributed on time, distributed late, paused).
- Write e2e specs for the full evidence lifecycle across the ally, operator, and investor routes as they exist today: ally submission with client-side hashing, the operator review queue (start review, approve, reject with reason), the paused-contract state, the two-cycle escalation state, and the investor timeline for each status.
- Add axe checks to every component in `components/pilot/` and to the three pilot dashboards, and fix every violation found. Pay particular attention to focus management in the onboarding stepper, keyboard access to review-queue actions, and status conveyed by more than color in `CycleStatusBadge`.
- Add visual regression over the pilot Storybook stories (for example Playwright screenshots against the static Storybook build), in both light and dark themes, with committed baselines and a documented update procedure. Wire it into `webapp-ci.yml`.

## Acceptance Criteria

- Playwright specs cover each evidence-lifecycle state listed above against mocked RPC, run in `webapp-ci.yml`, and pass reliably (no retries needed across several consecutive CI runs, noted in the PR).
- RPC fixtures are built from the generated contract types, so a contract spec change that breaks them fails at type-check.
- Every pilot component and dashboard has an axe check with zero violations, and the fixes are included in the PR.
- Visual regression covers every pilot story in light and dark themes and fails CI on an unintended change, which the PR demonstrates with a deliberate diff. The baseline update procedure is documented in `apps/webapp/e2e/README.md` or equivalent.
- The existing whitelist e2e specs from C7-010 still pass.
- All five required CI workflows pass on the pull request.

## Quality Standard

These tests exist to protect investors from a broken trust surface, so they must test real user-visible behavior and never implementation details, and they must be reliable. A flaky gate gets disabled, and a disabled gate protects no one. Build the RPC mock layer as reusable infrastructure. Future cycles will extend it to every new pilot flow, the same way C7-010's harness was built to be extended.
