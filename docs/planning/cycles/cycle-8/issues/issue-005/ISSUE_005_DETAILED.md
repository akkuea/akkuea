# C8-005: Mainnet Cutover Gate: Automated Preflight, Secret Hardening, Measured Payout Cost, Day-0 Checklist, and Threat Model

## Issue Metadata

| Attribute       | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| Issue ID        | C8-005                                                                         |
| Area            | DX                                                                             |
| Difficulty      | High                                                                           |
| Labels          | security, ci, dx, documentation, backend, high                                 |
| Dependencies    | C6-001, C6-007, C7-009                                                         |
| Estimated Lines | 3,500-4,500 (preflight tool and tests, CI changes, auth fix, operational docs) |

**Description**

Make the move from testnet to mainnet something a script checks rather than something a person remembers, close a live default-secret vulnerability, and publish the fee-per-payout figure the product brief requires. The full context is in `ISSUE_005.md`.

**Requirements and context**

- Default secret: `apps/api/src/middleware/auth.ts:5` and `apps/api/src/routes/auth.ts:22` both read `process.env.JWT_SECRET || 'super-secret-default-key-for-dev'`. Centralize the secret in one config module that validates at boot (minimum length, not a known placeholder) and import it from both places. Update the test files that use the literal to set an explicit test secret.
- Env schema: `apps/shared/src/env/schemas.ts` (the API schema around lines 100-155, with `DATABASE_SSL` at 103, `NODE_ENV` at 105, and `OPERATIONS_*` at 112-115). Add `JWT_SECRET` there, and to `.env.example` and `docs/deployment/environment-variables.md`, whose current text wrongly says the variable does not exist.
- CI secret scanning: `webapp-ci.yml:137-145` and `contracts-ci.yml:~138` have "Check for secrets in code" steps. `api-ci.yml`'s `security-audit` job (line 91) has none. Add an equivalent step for `apps/api/src`, excluding test fixtures explicitly rather than broadly.
- Preflight: nothing under `scripts/` does this today (`build.sh`, `deploy*.sh`, `diagrams/`, `smoke/`). Put the tool beside `scripts/smoke/` and reuse the typed clients from `@akkuea/shared` for on-chain reads (`admin()` on each contract, and the payout-split configuration read via `eurc_swap_path_status()` and the stored addresses). Get WASM hashes from RPC (`getLedgerEntries` on the contract instance) and compare them with the `stellar contract build` output.
- Budget: `contracts-ci.yml:208-236` runs only `cargo test --package rwa-defi-contract budget_check -- --nocapture` (line 235). The pilot test is `budget_check_execute_distribution_for_ten_holders` (`apps/contracts/contracts/pilot-payout-split/src/lib.rs:2138`). Recent commits capped holders at 15 to avoid budget exhaustion (`39264bcd`), so measure and publish figures up to that cap.
- Existing checklist to mirror: `docs/deployment/post-deploy-checklist.md` (defi-rwa only). Existing deploy guide: `docs/deployment/deploy-pilot-contracts.md`.

Example: manifest-driven preflight:

```ts
// scripts/preflight/manifest.mainnet.json holds reviewed, non-secret expected values:
// { "network": "PUBLIC", "contracts": { "payoutSplit": "C...", ... },
//   "roles": { "admin": "G...", "operator": "G...", "ally": "G...", "feeRecipient": "G..." },
//   "wasmHashes": { "payoutSplit": "ab12...", ... } }
const failures: string[] = [];
if (env.STELLAR_NETWORK_PASSPHRASE !== Networks.PUBLIC)
  failures.push("Network passphrase is not mainnet");
if (env.DATABASE_SSL !== "true")
  failures.push("DATABASE_SSL must be true in production");
if (manifest.roles.operator === manifest.roles.ally)
  failures.push("Operator and ally must be distinct");
const onChainAdmin = (await whitelist.admin()).result;
if (onChainAdmin !== manifest.roles.admin)
  failures.push(
    `pilot-whitelist admin is ${onChainAdmin}, expected ${manifest.roles.admin}`,
  );
process.exit(failures.length ? 1 : 0);
```

**Suggested execution**

1. `git checkout -b feature/mainnet-cutover-gate`
2. Fix the JWT fallback and add the `api-ci.yml` scan step first, as a small, reviewable commit.
3. Build the environment half of the preflight with a test per failure case.
4. Build the on-chain half, run it against the current testnet deployment with a testnet manifest, and paste the output in the PR.
5. Extend the `invocation-budget` job, run fee measurements on testnet at 1, 5, 10, and 15 holders (USDC-only and mixed), and write `docs/operations/pilot-payout-cost.md`.
6. Write `docs/deployment/pilot-day-0-checklist.md` with the preflight as its first gate, linking to the pause, role, and incident runbooks.
7. Write `docs/architecture/threat-model.md`: actors, assets, per-function trust boundaries, contract-enforced versus human-mediated protections, known weaknesses, and a mermaid trust-boundary diagram per the product brief's documentation standard.

**Test and commit**

- [ ] Boot fails without a valid `JWT_SECRET`, and no default secret literal remains in `apps/api/src` production code
- [ ] `api-ci.yml` secret scan fails on a planted fixture
- [ ] One preflight test per listed failure, plus a passing configuration
- [ ] Testnet preflight output and fee-measurement transaction hashes in the PR
- [ ] Docs linked from `deploy-pilot-contracts.md` and `product-brief.md`
- [ ] All five CI workflows green

Example commit:
`git commit -m "feat(dx): add mainnet preflight gate and remove default jwt secret"`

**Guidelines**

- The manifest contains only public addresses and hashes. Never put a secret in it or in any checked-in fixture.
- Every failure message must name the exact variable or address and the expected value.
- The threat model must list real weaknesses plainly. It is an engineering document, not marketing.
