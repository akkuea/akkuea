# WebApp E2E and Visual Regression Tests

## Overview

This directory contains the Playwright browser end-to-end test suite for the webapp.

There are two test projects:

| Project | Command | What it tests |
| ------- | ------- | ------------- |
| `chromium` | `bun run test:e2e` | Evidence lifecycle and whitelist flows against a mocked Next.js dev server |
| `visual-regression` | `bunx playwright test --project=visual-regression` | Screenshot comparison of all pilot Storybook stories in light and dark themes |

## Running the Suite Locally

**Prerequisites:** Bun installed.

### Evidence lifecycle and whitelist e2e

```bash
cd apps/webapp
bun run test:e2e
```

The command boots a local webpack dev server on port 3100 (change with `PLAYWRIGHT_PORT`), warms up all five pilot routes, and runs the full spec suite against mocked Soroban RPC and API responses. No real backend is required.

To watch test results in the Playwright UI:

```bash
bun run test:e2e:ui
```

### Visual regression

The visual-regression project requires a Storybook server running on port 6006.

**Option A: use the static build (matches CI exactly)**

```bash
cd apps/webapp
bun run build-storybook          # builds to storybook-static/
bunx http-server storybook-static --port 6006 &
bunx playwright test --project=visual-regression
```

**Option B: use the live Storybook dev server (faster for local iteration)**

```bash
cd apps/webapp
bun run storybook &
bunx playwright test --project=visual-regression
```

## Updating Visual Baselines

When an intentional UI change causes screenshot diffs, update the committed baselines:

1. Make your UI change and verify it looks correct in Storybook.
2. Build Storybook statically (matches CI rendering):
   ```bash
   cd apps/webapp
   bun run build-storybook
   ```
3. Regenerate baselines (on a Linux machine or via Docker to match CI font rendering):
   ```bash
   bunx http-server storybook-static --port 6006 &
   bunx playwright test --project=visual-regression --update-snapshots
   ```
4. Review the updated PNG files in `e2e/snapshots/` with `git diff --stat`.
5. Commit only the snapshots that correspond to your intentional change. Do not
   commit unrelated drift.

> **Note on font rendering:** Screenshot comparisons are sensitive to the OS and
> font rendering pipeline. Baselines are generated on `ubuntu-latest` in CI.
> If you regenerate locally on macOS or Windows, the result will differ. Use
> Docker with an Ubuntu image or generate on a CI runner to keep them consistent.

## Adding New Stories to Visual Regression

1. Add the Storybook story ID (e.g. `pilot-newcomponent--default`) to the
   `PILOT_STORIES` array in `e2e/visual-regression.spec.ts`.
2. Generate the initial baseline:
   ```bash
   bunx playwright test --project=visual-regression --update-snapshots
   ```
3. Commit the new PNG files in `e2e/snapshots/`.

## Fixture Architecture

### Soroban RPC Mock (`e2e/fixtures/soroban-rpc.ts`)

The `mockPilotRpc()` function intercepts all outbound JSON-RPC requests to Soroban
and answers them with in-memory scenario state. It is the primary mechanism that
makes the evidence-lifecycle specs fast and deterministic.

**Scenario builder API:**

```ts
const scenario = new PilotRpcScenario()
  .cycle("2026-01").distributedOnTime(BigInt(11_750_0000000))
  .cycle("2026-02").distributedLate(BigInt(11_750_0000000))
  .cycle("2026-03").submitted(BigInt(12_400_0000000))
  .setHoldings({ balance: BigInt(250_0000000), totalSupply: BigInt(1_000_0000000) });

await mockPilotRpc(page, scenario);
await page.goto("/en/pilot/investor");
```

Available cycle states: `none`, `submitted`, `underReview`, `approved`,
`rejected(reason)`, `disputed(reason)`, `distributedOnTime`, `distributedLate`.

Write operations (`submit_evidence`, `start_review`, `review_evidence`,
`flag_dispute`, `execute_distribution`) mutate the in-memory scenario state so
subsequent queries reflect the change automatically.

### Wallet Mock (`e2e/fixtures/wallet.ts`)

Seeds `localStorage` with a connected wallet stub so the app believes a Stellar
wallet is present on first render. Must be called before `page.goto()`.

### Whitelist API Mock (`e2e/fixtures/whitelist-api.ts`)

Covers `GET /pilot/whitelist/status/:address`, `POST /pilot/whitelist/request`,
`GET /pilot/whitelist/pending`, and the review action. Used by the whitelist
onboarding and review-queue specs only.

## CI

The suite runs in `webapp-ci.yml` under two jobs:

- `e2e-tests`: runs `chromium` project against the mocked Next.js dev server.
- `visual-regression`: builds Storybook, serves it statically, and runs the
  `visual-regression` project. Fails on any pixel diff beyond the 1% tolerance.
  Diffs are uploaded as artifacts on failure for review.
