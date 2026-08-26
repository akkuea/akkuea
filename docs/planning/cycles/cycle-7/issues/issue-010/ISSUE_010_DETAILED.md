# C7-010: Playwright End-to-End Test Harness for the Whitelist Onboarding and Review Flow

## Issue Metadata

| Attribute       | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Issue ID        | C7-010                                                |
| Area            | WEBAPP                                                |
| Difficulty      | High                                                  |
| Labels          | frontend, test, ci, high                              |
| Dependencies    | C6-008                                                |
| Estimated Lines | 400-600 (framework setup, CI job, specs, mocks, docs) |

**Description**

Stand up this repository's first end-to-end browser-test harness, anchored to the already-merged, stable whitelist onboarding and review-queue components in `apps/webapp`.

**Requirements and context**

- Target components: `apps/webapp/src/components/pilot/WhitelistOnboardingForm.tsx` and `WhitelistReviewQueue.tsx`, plus their Storybook stories (`WhitelistOnboardingForm.stories.tsx`, `WhitelistReviewQueue.stories.tsx`) - the stories are a useful reference for the states and props these components already expect to handle, and may inform how the mock API layer should be shaped.
- Route location: `apps/webapp/src/app/[locale]/pilot/onboarding` is the existing route these components render under; confirm the exact path before writing specs that navigate to it.
- CI wiring: read `webapp-ci.yml` in full before adding a step - the new Playwright job must be additive (its own job or a clearly separate step), never modifying or slowing the existing unit-test job's critical path.
- No existing e2e/Playwright/Cypress config exists anywhere in this monorepo (confirmed absent from both `apps/webapp` and `apps/akkuea-land`) - this is a genuinely new introduction, not an extension of something partial.
- Mock layer: decide between Playwright's built-in route interception (mocking the API calls `WhitelistOnboardingForm`/`WhitelistReviewQueue` make) versus running against a real local API instance with a seeded/sandboxed database - route interception is likely faster and more deterministic for a first harness; document the choice.

**Suggested execution**

1. `git checkout -b feature/webapp-playwright-e2e-harness`
2. Install and configure Playwright in `apps/webapp` (`playwright.config.ts`, browser install step for CI).
3. Add a `webapp-ci.yml` job/step that installs Playwright browsers and runs the suite, isolated from the existing unit-test job.
4. Write specs for `WhitelistOnboardingForm`: initial/loading state, validation error state, submission-success state, and disconnected-wallet state (if the component's props/context require a connected wallet - confirm from its implementation).
5. Write specs for `WhitelistReviewQueue`: approve action, reject action (including the reason input, per the acceptance criteria already established for this component when it was built), and empty-queue state.
6. Add the API mocking/interception layer.
7. Document local and CI invocation in `apps/webapp`'s README or `CONTRIBUTING.md`.

**Test and commit**

- [ ] Playwright runs locally with a single documented command
- [ ] All four `WhitelistOnboardingForm` states are covered by an independently passing/failing spec
- [ ] `WhitelistReviewQueue` approve, reject, and empty-queue states are covered
- [ ] New CI job/step is isolated from and does not slow the existing unit-test job
- [ ] Documentation for local/CI usage is added

Example commit:
`git commit -m "test(webapp): add playwright e2e harness for whitelist onboarding flow"`

**Guidelines**

- Do not point the initial suite at real testnet transactions; keep it fast and deterministic via mocking, with a documented seam for later pointing it at a live environment.
- Follow this project's design-system and accessibility conventions when writing selectors (prefer role/label-based queries over brittle CSS selectors, consistent with how the components were already built to be accessible).
