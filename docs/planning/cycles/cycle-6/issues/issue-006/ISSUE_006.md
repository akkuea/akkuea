# Close the KYC Enforcement Gaps and Remediate Dependency Vulnerabilities

## Context

`docs/api/kyc-workflow.md` documents two known gaps in the existing platform build honestly and specifically: `POST /kyc/verify/:documentId` has no authentication middleware at all, meaning any HTTP client that knows a document ID can approve or reject it, and `buyShares` does not check `users.kycStatus` before allowing a share purchase, meaning a user with `kycStatus = 'not_started'` can buy shares today. Separately, GitHub's dependency scanning currently flags 27 vulnerabilities against `develop` (12 high, 12 moderate, 3 low), and `.github/security/audit-allowlist.txt` lists dozens of advisories as allowlisted rather than fixed. None of this is acceptable in a product being pitched to real estate agencies and investors as verifiable and auditable.

## What Needs to Be Done

- Add authentication middleware to `POST /kyc/verify/:documentId`, gated the same way other admin-only operations already are (`OPERATIONS_BACKEND_CREDENTIAL` and/or `OPERATIONS_ALLOWED_WALLETS`, per `docs/deployment/environment-variables.md`).
- Add a KYC-status guard to `buyShares` (`routes/properties.ts`) that rejects the purchase with a clear error unless `users.kycStatus === 'approved'`, following the pseudocode already sketched in `docs/api/kyc-workflow.md`.
- Work through `.github/security/audit-allowlist.txt`: for every listed advisory, check whether a non-breaking patched version is now available upstream and upgrade to it, removing the entry from the allowlist. For advisories with no available fix yet, leave them allowlisted but confirm the "follow-up" note is still accurate.
- Update `docs/api/kyc-workflow.md`'s "Known gaps" section once each gap is closed, following the same pattern already used elsewhere in this repo when a documented gap gets fixed (see how Issue #729's oracle guardrails work updated `docs/operations/runbook-oracle-failure.md`).

## Acceptance Criteria

- `POST /kyc/verify/:documentId` returns 401/403 for any request without valid admin credentials, verified by a new regression test.
- `buyShares` returns a clear, typed error when called by a user whose `kycStatus` is not `approved`, verified by a new regression test; the happy path for an approved user is unaffected.
- The number of advisories in `audit-allowlist.txt` decreases; every remaining entry has a currently accurate reason it can't yet be fixed.
- `docs/api/kyc-workflow.md`'s "Known gaps" section is updated to reflect the new, closed state (or removed entirely if both gaps are fully closed).
- All five required CI workflows pass on the pull request, including the dependency audit step in `monorepo-ci.yml`.

## Quality Standard

These are the two most concrete, already-documented security gaps in the entire codebase; there is no ambiguity about what "done" looks like here; the acceptance criteria in `docs/api/kyc-workflow.md` already describe it precisely. Fix the actual gap, don't paper over it with a comment or a TODO. Every dependency upgrade must be verified to not break the existing test suite before being counted as done.
