# End-to-End Testnet Integration Suite for the Full Pilot Lifecycle

## Context

`bun run smoke` (`scripts/smoke/run-smoke-tests.sh`) checks API health, Swagger reachability, the public properties list, and optionally the webapp - zero coverage of the pilot contracts or flow, despite the pilot being the actual product this repository now ships. `docs/strategy/product-brief.md`'s own Engineering/output Success Criteria require "Full contract suite... deployed and exercised end-to-end on testnet... before any mainnet integration work begins." The existing Rust unit tests in `pilot-payout-split` already do genuine in-process cross-contract testing (`env.register`-ing real `PilotWhitelist`, `PilotIncomeToken`, and a Stellar Asset Contract together, not mocks), which is excellent - but nothing exercises the actual deployed testnet contracts (the IDs already recorded in `apps/shared/src/contracts.testnet.json`) the way a real operator workflow would, end to end, through the real API and real chain.

## What Needs to Be Done

- Add a new post-deploy integration suite (a script following `scripts/smoke/run-smoke-tests.sh`'s conventions, or a dedicated `bun test` suite under `apps/api`, whichever fits this project's existing invocation pattern better) that, against a running API instance and the recorded testnet contract IDs:
  1. Submits a whitelist request through the real `POST /pilot/whitelist/request`.
  2. Approves it through the real API (exercising the real on-chain `submitWhitelistApprove` call), then confirms `is_approved()` via RPC directly against the deployed contract.
  3. Using documented, testnet-only, funded operator/ally/holder keypairs (never committed as real secrets), records evidence and executes a two-signer distribution against the real deployed `pilot-payout-split` contract.
  4. Asserts the resulting USDC balances via RPC match the expected 10%-fee/90%-pro-rata split.
- Wire it into a clearly separate command (e.g. `bun run smoke:pilot`) so it does not run as part of the fast local development loop, and document required fixtures in `scripts/smoke/README.md`.

## Acceptance Criteria

- The suite runs end to end against a real testnet deployment (using the contract IDs in `apps/shared/src/contracts.testnet.json`) and passes.
- Each of the four steps above has an explicit, separately readable assertion - the suite fails at the specific step that broke, not with a single opaque end-to-end failure.
- Required testnet fixtures (funded keypairs, expected environment variables) are documented in `scripts/smoke/README.md` following its existing documentation style, with an explicit statement that no real secret is ever committed.
- The suite is invocable as its own command, separate from the fast local `bun run smoke` path.
- All five required CI workflows pass on the pull request (the new suite itself does not need to run inside every CI run if it requires a live testnet deployment and funded accounts - state and justify that decision explicitly in the PR).

## Quality Standard

This is the single largest verification gap identified across this repository for the pilot: the product's actual, real, deployed contracts have never been exercised end to end the way an investor's money will actually move through them. Unit tests with in-process mocks and cross-contract registration, however good, are not a substitute for proving the real deployed artifacts, wired together through the real API, actually work.
