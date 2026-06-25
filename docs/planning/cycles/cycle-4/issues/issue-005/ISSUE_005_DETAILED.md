# C4-005: Enable Webapp Unit Tests in CI

## Issue Metadata

| Attribute       | Value                  |
| --------------- | ---------------------- |
| Issue ID        | C4-005                 |
| Area            | WEBAPP                 |
| Difficulty      | Medium                 |
| Labels          | frontend, test, medium |
| Dependencies    | None                   |
| Estimated Lines | 30-80                  |

## Overview

Twelve test files exist in the webapp and none run in CI. This issue activates the pipeline, resolves any test failures, and establishes a 60% coverage floor. The work is primarily configuration and test maintenance, not new feature code.

## Current Test Files

The following files exist and are expected to pass:

- `src/hooks/__tests__/useHealthFactor.test.ts`
- `src/hooks/__tests__/useLendingPools.test.ts`
- `src/hooks/__tests__/useLiveUpdates.test.ts`
- `src/services/api/__tests__/client.test.ts`
- `src/services/api/__tests__/lending.test.ts`
- `src/services/api/__tests__/properties.test.ts`
- `src/services/api/__tests__/users.test.ts`
- `src/services/api/__tests__/types.test.ts`
- `src/app/marketplace/page.test.tsx`

## Step 1: Run the suite locally first

Before touching the CI file, run the tests locally to understand the current state:

```bash
cd apps/webapp
bun test
```

Note which tests pass and which fail. Do not open the pull request until all tests pass locally.

## Step 2: Update webapp-ci.yml

The commented section in `.github/workflows/webapp-ci.yml` looks like this:

```yaml
# - name: Run unit tests
#   run: |
#     cd apps/webapp
#     bun test --coverage --watchAll=false
```

Replace it with two independent steps:

```yaml
- name: Run unit tests
  run: |
    cd apps/webapp
    bun test --coverage

- name: Check coverage threshold
  run: |
    cd apps/webapp
    COVERAGE=$(bun test --coverage 2>&1 | grep -oP '\d+\.\d+(?=%)' | head -1)
    echo "Coverage: ${COVERAGE}%"
    if (( $(echo "$COVERAGE < 60" | bc -l) )); then
      echo "Coverage ${COVERAGE}% is below the required 60% threshold"
      exit 1
    fi
```

Ensure this step does not depend on the Prettier format check step. Both steps should run independently. In the workflow file, place them as separate steps under the same job or use `continue-on-error: false` only where appropriate.

## Step 3: Fix failing tests

Common failure modes in this codebase:

**API client tests that expect a specific base URL**: The API client reads `process.env.NEXT_PUBLIC_API_URL`. In the test environment this may be undefined, causing the client to fall back to `http://localhost:3001`. Update test setup to set this variable before tests run, or mock the fetch call to avoid the dependency.

**Hook tests that call real API endpoints**: Hooks like `useProperties` and `useLendingPools` call the live API client. These tests must mock the API service layer. Use `jest.mock` or `bun:test`'s equivalent to intercept the service calls and return fixture data.

**Component tests that require a wallet context**: Some components require `WalletContext` or the Stellar wallets kit. Wrap these in a mock provider that returns a disconnected wallet state.

## Step 4: Verify the coverage gate

After the suite passes, check the coverage report:

```bash
cd apps/webapp
bun test --coverage
```

If coverage is below 60%, identify the uncovered modules and add targeted tests for the most critical paths. Focus on the API service layer and hooks, as those carry the most business logic.

## What Not to Do

Do not delete tests to make the suite pass. Do not modify test assertions to always return true. Do not lower the coverage threshold below 60%. Do not combine this change with feature work.

## Definition of Done

- All test files pass locally and in CI.
- The coverage threshold of 60% is enforced in the workflow.
- The format check and test steps are independent.
- All CI workflows pass on the pull request.
