# C8-008: Quality Gates for the Pilot Dashboard: Browser E2E for the Evidence Lifecycle, Accessibility, and Visual Regression

## Issue Metadata

| Attribute       | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Issue ID        | C8-008                                                                               |
| Area            | WEBAPP                                                                               |
| Difficulty      | High                                                                                 |
| Labels          | frontend, test, a11y, ci, high                                                       |
| Dependencies    | C6-002, C7-010                                                                       |
| Estimated Lines | 3,000-4,000 (RPC mock layer, e2e specs, a11y checks and fixes, visual baselines, CI) |

**Description**

Extend C7-010's Playwright harness to the evidence lifecycle by mocking Soroban RPC at the browser network layer, add accessibility checks across the pilot surface, and add visual regression over the existing pilot stories. The full context is in `ISSUE_008.md`.

**Requirements and context**

- Harness: `apps/webapp/playwright.config.ts` (`testDir: "./e2e"`, `globalSetup: ./e2e/global-setup`). Its header comment already describes mocking at the browser network layer via `page.route()`. Existing fixtures are `e2e/fixtures/wallet.ts` and `e2e/fixtures/whitelist-api.ts`, and the existing specs are `whitelist-onboarding.spec.ts` and `whitelist-review-queue.spec.ts`.
- Pilot reads use the generated clients through `apps/webapp/src/services/pilot/reads.ts` (`readEvidence`, `fetchPilotCycles`, `fetchPayoutPaused`, `fetchPilotHoldings`), which issue JSON-RPC `simulateTransaction` calls to the configured RPC URL (`services/pilot/config.ts`). The mock must answer those calls with `SorobanTransactionData` and `ScVal` results encoded from the generated types in `@akkuea/shared` (`contracts/pilot/payout-split.ts`, `income-token.ts`, `whitelist.ts`).
- Writes (`submitEvidence`, `startReview`, `reviewEvidence` in `services/pilot/writes.ts`) need simulate, send, and get-transaction mocks plus the wallet fixture's signing stub.
- Cycle states to build: `EvidenceStatus` in `apps/contracts/contracts/pilot-payout-split/src/lib.rs:101-112` (`Submitted`, `UnderReview`, `Approved`, `Rejected`, `Disputed`), plus no record, distributed on time and late (via `distributed_at` against `expectedAtFor` in `services/pilot/cycles.ts:39`), paused, and the two-cycle escalation state.
- Components for axe and visual coverage (all already have stories in `components/pilot/`): `CycleStatusBadge`, `CycleStatusTimeline`, `EvidenceReviewQueue`, `EvidenceSubmissionForm`, `InvestorHoldingsCard`, `PropertyEvidencePanel`, `WhitelistOnboardingForm`, `WhitelistReviewQueue`, and the three dashboards.
- Existing unit tests to extend with axe: `components/pilot/__tests__/{CycleStatusTimeline,EvidenceReviewQueue,EvidenceSubmissionForm,InvestorHoldingsCard}.test.tsx`. Pattern: `components/marketplace/__tests__/a11y.check.test.tsx`.

Example: typed RPC scenario:

```ts
// e2e/fixtures/soroban-rpc.ts
export function mockPilotRpc(page: Page, scenario: PilotScenario) {
  return page.route(`${RPC_URL}/**`, async (route) => {
    const body = route.request().postDataJSON();
    if (body.method === "simulateTransaction") {
      const call = decodeInvocation(body.params.transaction); // contract + function + args
      const result = scenario.answer(call); // typed EvidenceRecord, bool, i128...
      return route.fulfill({ json: simulateOk(body.id, encodeScVal(result)) });
    }
    // sendTransaction / getTransaction / getLatestLedger handled similarly
  });
}

test("investor sees a disputed cycle with the operator's reason", async ({
  page,
}) => {
  await mockPilotRpc(
    page,
    scenarios.cycle("2026-08").disputed("Bank statement total mismatch"),
  );
  await page.goto("/en/pilot/investor");
  await expect(page.getByText("Bank statement total mismatch")).toBeVisible();
});
```

**Suggested execution**

1. `git checkout -b feature/pilot-dashboard-quality-gates`
2. Build `e2e/fixtures/soroban-rpc.ts` with encode and decode helpers derived from the generated client specs, and unit-test the helpers.
3. Write scenario builders and the lifecycle specs (ally, operator, investor), reusing the wallet fixture.
4. Add axe checks to every pilot component test and dashboard, and fix violations: stepper focus, review-action keyboard access, and non-color status cues in `CycleStatusBadge`.
5. Add visual regression by building Storybook statically and running Playwright `toHaveScreenshot` over each pilot story in light and dark themes. Commit the baselines and document how to update them.
6. Wire everything into `webapp-ci.yml`, keeping visual regression on a pinned browser and OS image to avoid font-rendering drift.

**Test and commit**

- [ ] Lifecycle specs pass across several consecutive CI runs without retries (noted in the PR)
- [ ] Fixture helpers type-check against generated clients
- [ ] Zero axe violations across the pilot surface
- [ ] Visual regression baselines committed, with a deliberate-diff demonstration in the PR
- [ ] C7-010 specs still passing
- [ ] All five CI workflows green

Example commit:
`git commit -m "test(webapp): add soroban rpc mocks and evidence lifecycle e2e coverage"`

**Guidelines**

- Assert user-visible behavior (text, roles, states), never implementation details.
- No arbitrary waits. Wait on visible state.
- Build the RPC mock layer as reusable infrastructure, since future pilot flows will extend it.
- Accessibility fixes must follow `docs/design-system/` tokens and components.
