# Harden the Pilot Whitelist API: Rate Limiting, Abuse Protection, and On-Chain Consistency Tests

## Context

`apps/api/src/routes/whitelist.ts` (`POST /pilot/whitelist/request`, `GET /pilot/whitelist/status/:walletAddress`) is the pilot's actual KYC intake surface - by design, it is public and unauthenticated. Every other route group in this API applies the existing `rateLimit` middleware (`apps/api/src/middleware/rateLimit.ts`) - `lending.ts`, `kyc.ts`, `properties.ts`, `users.ts`, `auth.ts`, `webhooks.ts` all use it - but `whitelist.ts` does not. Separately, `WhitelistService.approveRequest()` submits a real, admin-signed transaction to the deployed `pilot-whitelist` contract (`stellarService.submitWhitelistApprove`), then updates the request's status in Postgres - but the only existing test, `routes/whitelist.test.ts`, fully mocks `WhitelistService` itself (`mock.module('../services/WhitelistService', ...)`). Nothing in this codebase actually proves that an "approved" row in `pilot_whitelist_requests` corresponds to `is_approved() == true` on the live contract, or that a failed on-chain submission is never mistakenly recorded as approved.

## What Needs to Be Done

- Apply the existing `rateLimit` middleware to `POST /pilot/whitelist/request` at minimum - an unauthenticated endpoint accepting full name, ID type, and ID reference is a textbook abuse and spam target. Evaluate and decide (documenting the reasoning) whether `GET /status/:walletAddress` also needs protection against wallet-address enumeration.
- Review the resubmission path: today the database enforces a unique `walletAddress`, but confirm what actually happens today if a rejected applicant tries to submit again (is there a real resubmission path, or does the unique constraint just fail the second request outright?) and fix or document the intended behavior.
- Write an integration test that exercises `WhitelistService.approveRequest` against a real `pilot-whitelist` contract deployment (local Soroban sandbox or testnet, not a mock), asserting that after a successful approval both the database status and the contract's `is_approved()` read agree, and that a simulated on-chain failure leaves the database status unchanged rather than falsely marking the request approved.

## Acceptance Criteria

- `POST /pilot/whitelist/request` is rate-limited, consistent with the limits already applied to comparable public-facing endpoints elsewhere in this API; the limit and its rationale are documented.
- The resubmission behavior for a previously rejected wallet address is explicit, intentional, and tested - not an accidental side effect of a unique-constraint failure.
- A new integration test proves database and on-chain state agree after a real (sandboxed) approval, replacing or supplementing the fully-mocked existing test - the fully-mocked test does not need to be deleted, but the gap it leaves must be closed.
- A second integration test proves that when the on-chain submission fails, the database request status is not changed to "approved."
- `cargo`/`bun` linting and type-checking pass; all five required CI workflows pass on the pull request.

## Quality Standard

The whitelist is this pilot's entire KYC gate - the "minimum-defensible" trust boundary the product brief stakes its credibility on. A silent drift between what the database says and what the chain actually enforces is exactly the kind of gap that looks fine in every existing (mocked) test and only surfaces when a real investor is wrongly let in or wrongly kept out. Close it before it needs closing under pressure.
