# Playwright End-to-End Test Harness for the Whitelist Onboarding and Review Flow

## Context

There is no end-to-end browser-testing infrastructure anywhere in this monorepo today - not in `apps/webapp`, not in `apps/akkuea-land`. Meanwhile, `apps/webapp/src/components/pilot/WhitelistOnboardingForm.tsx` and `WhitelistReviewQueue.tsx` (merged as part of #1067 / C6-008) are the only pilot-facing UI that already exists and is stable. That makes them the right place to establish this repository's first e2e harness - a lower-risk foundation than building it against the still-in-progress read-only dashboard (#1061 / C6-002), which would leave the new harness with nothing stable to test against.

## What Needs to Be Done

- Introduce Playwright (or a documented, justified alternative, if a prior decision already leans elsewhere) as an isolated test target inside `apps/webapp`, wired into `webapp-ci.yml` as its own job or step so it does not slow down or destabilize the existing unit-test job.
- Write specs covering `WhitelistOnboardingForm`'s required states - loading, error, success, and disconnected-wallet - matching this project's own established frontend acceptance bar (every interactive element must handle these four states, as already required of the in-progress dashboard issue).
- Write specs covering `WhitelistReviewQueue`'s approve and reject actions.
- Run the suite against a mocked or local API layer, not real testnet transactions, to keep it fast and deterministic; document a clear, separate seam for later pointing the same specs at a real environment if that becomes useful.
- Document how to run the suite locally and in CI.

## Acceptance Criteria

- Playwright (or the chosen alternative) is set up in `apps/webapp`, runs locally with a documented single command, and runs in CI as an isolated job in `webapp-ci.yml`.
- Specs cover all four required states of `WhitelistOnboardingForm` and the approve/reject actions of `WhitelistReviewQueue`, each with an independently readable pass/fail.
- The suite runs against a mocked or local API layer and completes in CI without requiring a live testnet transaction.
- Adding this suite does not slow down or destabilize the existing webapp unit-test CI job (it runs as a separate, independent step).
- Local and CI run instructions are documented in `apps/webapp`'s README or `CONTRIBUTING.md`.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is the first e2e harness in the repository, not just two more test files - the setup decisions made here (how it's invoked, how it's mocked, how it's wired into CI) will be the template every future e2e suite in this monorepo copies. Get the foundation right: fast, deterministic, clearly documented, and genuinely isolated from the existing test suite's reliability.
