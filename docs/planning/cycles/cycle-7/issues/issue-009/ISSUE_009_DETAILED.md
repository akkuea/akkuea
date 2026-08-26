# C7-009: End-to-End Testnet Integration Suite for the Full Pilot Lifecycle

## Issue Metadata

| Attribute       | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Issue ID        | C7-009                                                               |
| Area            | DX                                                                   |
| Difficulty      | High                                                                 |
| Labels          | test, ci, dx, api, contracts, high                                   |
| Dependencies    | C6-001, C6-008                                                       |
| Estimated Lines | 350-550 (orchestration script/suite, fixtures, RPC assertions, docs) |

**Description**

Build the first true end-to-end integration suite for the pilot's live testnet deployment, driving the real API against the real deployed `pilot-whitelist`, `pilot-income-token`, and `pilot-payout-split` contracts, closing the gap left by `bun run smoke`'s current zero pilot coverage.

**Requirements and context**

- `scripts/smoke/run-smoke-tests.sh` is the existing convention for post-deploy checks (health, Swagger, properties list, optional webapp check, per its numbered sections). Read it fully and either extend it or add a clearly separate sibling script/suite - state which approach and why.
- Contract IDs: `apps/shared/src/contracts.testnet.json` (`PILOT_WHITELIST`, `PILOT_INCOME_TOKEN`, `PILOT_PAYOUT_SPLIT`, `USDC_TOKEN`) are the real, already-deployed targets.
- API surface to drive: `POST /pilot/whitelist/request`, then the operator-approval path (`WhitelistService.approveRequest`, exposed via whatever admin route already calls it - check `routes/admin.ts` or `WhitelistController`).
- Direct-chain steps (evidence recording, two-signer distribution execution) have no API route yet by design (per the product brief, this is meant to be signed directly by operator/ally wallets) - this suite will need to invoke `pilot-payout-split` directly via the Stellar SDK (or the C7-004 generated client, if it has landed), using documented testnet-only funded keypairs for the operator, ally, and at least one holder.
- Never commit a real secret. Document required environment variables (`PILOT_E2E_OPERATOR_SECRET`, etc., or whatever naming this project's existing env conventions use) in `scripts/smoke/README.md`, matching its existing environment-configuration documentation style.

**Suggested execution**

1. `git checkout -b feature/pilot-e2e-testnet-suite`
2. Read `scripts/smoke/run-smoke-tests.sh` and `scripts/smoke/README.md` in full.
3. Decide and document: new script vs. new `bun test` suite vs. an extension of the existing smoke script. Implement whichever keeps each of the four lifecycle steps independently assertable and independently diagnosable on failure.
4. Implement step 1 (whitelist request via real API).
5. Implement step 2 (real approval via API, then independent RPC confirmation of `is_approved()` - do not just trust the API's response, verify against the chain directly, since that's the entire point of this suite).
6. Implement step 3 (evidence recording and two-signer distribution execution against the real deployed `pilot-payout-split`, using the documented test fixtures).
7. Implement step 4 (RPC balance assertions against the expected fee/pro-rata split).
8. Wire the new command (`bun run smoke:pilot` or equivalent) into `package.json` and document it.
9. Decide and document whether/how this runs in CI (a live-testnet-dependent suite may need to run on a schedule or be manually triggered rather than on every PR - state the tradeoff explicitly rather than silently skipping CI integration).

**Test and commit**

- [ ] All four lifecycle steps pass against the real testnet deployment
- [ ] Each step's failure is independently diagnosable (clear, step-specific error output)
- [ ] Required fixtures and environment variables are documented, with an explicit no-real-secrets statement
- [ ] The suite is invocable as its own command, separate from the fast local test/smoke loop
- [ ] CI integration approach (or explicit non-integration with justification) is documented in the PR

Example commit:
`git commit -m "test: add end-to-end testnet integration suite for the pilot lifecycle"`

**Guidelines**

- Independently verify on-chain state after each API-driven step (via RPC) rather than trusting the API's own response as proof - the value of this suite is catching exactly the kind of drift C7-005 also targets, at the full-lifecycle level.
- Keep the suite idempotent enough to re-run against a persistent testnet deployment without requiring a fresh contract deployment every time, if at all feasible - document any exception.
