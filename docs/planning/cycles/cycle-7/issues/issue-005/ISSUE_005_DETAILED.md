# C7-005: Harden the Pilot Whitelist API: Rate Limiting, Abuse Protection, and On-Chain Consistency Tests

## Issue Metadata

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Issue ID        | C7-005                                                             |
| Area            | API                                                                |
| Difficulty      | High                                                               |
| Labels          | api, backend, security, validation, high                           |
| Dependencies    | C6-006, C6-008                                                     |
| Estimated Lines | 300-500 (middleware wiring, service test infra, integration tests) |

**Description**

Harden `apps/api/src/routes/whitelist.ts` and `WhitelistService` against abuse and against silent database/chain drift, closing the one pilot-facing API surface that currently has neither rate limiting nor any test that touches a real contract.

**Requirements and context**

- `apps/api/src/middleware/rateLimit.ts` already exists and is proven in production use across `lending.ts`, `kyc.ts`, `properties.ts`, `users.ts`, `auth.ts`, `webhooks.ts`. Read its usage in one of those (e.g. `kyc.ts`, the closest sibling in sensitivity) and apply the same pattern to `whitelist.ts`'s `POST /request`.
- `WhitelistController.request` / `WhitelistService` (not yet reviewed in this issue's research pass in full - read both before changing) handle the initial submission and the unique `walletAddress` constraint in `apps/api/src/db/schema/pilotWhitelist.ts`. Confirm the actual current behavior for a resubmission after rejection (does the unique constraint reject it outright with an unhandled 500, or is there existing logic to allow a new attempt?) and fix it to fail cleanly with a clear 4xx and message if it doesn't already.
- The integration test target is `WhitelistService.approveRequest`, specifically its two side effects: the call to `stellarService.submitWhitelistApprove(contractId, adminPublicKey, adminSecret, walletAddress)` and the subsequent database update. Use a local Soroban test ledger or a dedicated testnet fixture contract (never the production pilot contract ID) - check `apps/api/src/tests/treasury.integration.test.ts` for this repository's existing pattern for chain-touching integration tests before inventing a new one.
- The failure-path test needs a way to force `submitWhitelistApprove` to fail deterministically (e.g. an invalid/unfunded signer fixture, or a contract instance with the address pre-revoked) and assert the database row's `status` is still `pending`, never flipped to `approved`.

**Suggested execution**

1. `git checkout -b feature/harden-pilot-whitelist-api`
2. Add `rateLimit` middleware to the `POST /request` route (and `GET /status/:walletAddress` if the enumeration-risk review concludes it's warranted) in `apps/api/src/routes/whitelist.ts`.
3. Read `WhitelistController.ts` in full; trace the resubmission path and fix or document it.
4. Follow the existing chain-touching integration test pattern (`treasury.integration.test.ts`) to write `whitelist.integration.test.ts`, deploying or pointing at a sandboxed `pilot-whitelist` contract instance.
5. Write the happy-path consistency test and the failure-path non-drift test described above.
6. Update `docs/deployment/` or `scripts/smoke/README.md` if the integration test requires new documented environment variables/fixtures.

**Test and commit**

- [ ] Unit tests cover the happy path and all error/rate-limit cases for the whitelist routes
- [ ] New integration test(s) verify database and on-chain state agree after a real (sandboxed) approval
- [ ] New integration test proves a failed on-chain submission never results in a false "approved" database state
- [ ] 429 returned when the rate limit is exceeded, consistent with this API's existing convention
- [ ] All five required CI workflows pass

Example commit:
`git commit -m "fix(api): rate-limit and add on-chain consistency tests for pilot whitelist"`

**Guidelines**

- Never point any test at a real mainnet or shared testnet admin key; use a dedicated, documented test fixture, and never commit a real secret.
- Keep the existing fully-mocked `whitelist.test.ts` in place for fast unit coverage; add the integration tests alongside it, don't replace fast tests with slow ones.
