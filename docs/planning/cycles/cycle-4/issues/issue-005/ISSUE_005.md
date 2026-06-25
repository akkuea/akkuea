# Enable Webapp Unit Tests in CI

## Context

The webapp has twelve test files covering hooks, API service clients, and UI components. None of them run in CI. The test step in `apps/webapp/.github/workflows/webapp-ci.yml` has been commented out since it was added, meaning every pull request that touches the frontend can silently introduce regressions in hooks, services, or components.

The tests exist and are written. This issue enables them in CI, makes them pass, and adds a coverage gate so the threshold does not erode over time.

## What Needs to Be Done

Uncomment the test step in `webapp-ci.yml` and run the full test suite locally to identify any currently failing tests. Fix all failing tests without modifying their intent. Add a minimum coverage threshold of 60%. Ensure the format check step and the test step are independent, so a formatting failure does not prevent tests from running and vice versa.

This issue does not require writing new tests beyond what is needed to make the suite pass. If a test is testing something that no longer exists, update it to reflect the current implementation. Do not delete tests to make the suite pass.

## Acceptance Criteria

- The test step in `webapp-ci.yml` is active and not commented out.
- All test files pass in CI without modification to their assertions.
- A 60% minimum line coverage gate is enforced.
- The format check step and the test step are separate jobs or steps that do not block each other.
- All CI workflows pass on the submitted pull request.

## Files to Modify

The primary change is in `.github/workflows/webapp-ci.yml`. Any test files that fail due to stale mocks or outdated component APIs will also need updates. Do not modify tests to lower their assertion bar; only update them to match the current implementation.

## Quality Standard

Do not comment out failing tests or lower coverage thresholds to make the pipeline green. If a test reveals a real regression, fix the underlying code and document it in the pull request. All CI workflows must pass. This issue sets the baseline for frontend code quality going forward.
