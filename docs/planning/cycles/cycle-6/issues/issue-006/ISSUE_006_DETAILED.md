# C6-006: Close the KYC Enforcement Gaps and Remediate Dependency Vulnerabilities

## Issue Metadata

| Attribute       | Value                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue ID        | C6-006                                                                                                                                                                                   |
| Area            | API                                                                                                                                                                                      |
| Difficulty      | High                                                                                                                                                                                     |
| Labels          | backend, error-handling, validation, high                                                                                                                                                |
| Dependencies    | None                                                                                                                                                                                     |
| Estimated Lines | 4000+ (dominated by `bun.lock` regeneration across dependency upgrades; hand-authored fix and test code is smaller, roughly 300-600 lines, and that's expected and fine, see note below) |

**Description**

Close the two documented KYC enforcement gaps in `apps/api`, and work through `.github/security/audit-allowlist.txt` upgrading every dependency with an available non-breaking patch.

**Requirements and context**

- `POST /kyc/verify/:documentId` (`apps/api/src/routes/kyc.ts`, referenced at `routes/kyc.ts:130-139` in `docs/api/kyc-workflow.md`): add the same admin-auth check already used elsewhere (see `internalOperationsAuth.ts`, already used by `/internal/operations/properties/:id/review` per `docs/api/launch-workflows.md`).
- `buyShares` (`apps/api/src/routes/properties.ts`, referenced at `routes/properties.ts:156-183`): add a guard reading `kycRepository.getUserKycStatus(buyer.id)` and throwing a typed `AuthorizationError` if the status isn't `approved`, exactly as sketched in `docs/api/kyc-workflow.md`'s "Known gaps" section.
- Dependency remediation: `.github/security/audit-allowlist.txt` currently lists advisories against `next`, `nanoid`, `shell-quote`, `brace-expansion`, `undici`, `js-yaml`, `image-size`, `postcss`, `protobufjs`, `ws`, `axios`, `form-data`, `ip-address`, and `sharp`, among others, most marked "transitive; track upgrade." For each, check `bun outdated` and the advisory's fixed-version range; upgrade whichever direct or transitive dependency resolves it without a breaking major-version bump to a package this codebase directly depends on. Where the fix requires a breaking change to a direct dependency (e.g. a Next.js major bump), leave it allowlisted and note that explicitly rather than force an unrelated breaking upgrade into this issue.
- A note on line-count expectations for this specific issue: unlike the other issues in this cycle, the bulk of this PR's diff will be `bun.lock` (an auto-generated lockfile, not hand-authored code). That's expected and correct; the hand-authored portion (the two guards, their tests, and the audit-allowlist edits) will be meaningfully smaller. Don't pad the guard implementation or its tests artificially to hit a line target; the value here is closing real gaps correctly, not volume.

**Suggested execution**

1. `git checkout -b fix/kyc-enforcement-gaps-and-dependency-audit`
2. Fix and test the `verify` endpoint auth gap first (smaller, independent, easy to verify in isolation).
3. Fix and test the `buyShares` KYC guard second.
4. Run `bun outdated` (or the workspace-appropriate equivalent) across each workspace, cross-reference against `audit-allowlist.txt`, and upgrade what can be upgraded without a breaking change.
5. Re-run the full test suite after each dependency upgrade batch, not just once at the end, to isolate any regression to the upgrade that caused it.
6. Update `.github/security/audit-allowlist.txt` and `docs/api/kyc-workflow.md`'s "Known gaps" section to reflect the new state.

**Test and commit**

- [ ] New regression test: `POST /kyc/verify/:documentId` without valid admin credentials returns 401/403
- [ ] New regression test: `buyShares` called by a non-approved user returns the typed authorization error; called by an approved user still succeeds (no regression on the happy path)
- [ ] Full test suite passes after every dependency upgrade, not just the final one
- [ ] `bash .github/scripts/dependency-audit.sh .` (the script `monorepo-ci.yml` actually runs) passes locally before pushing

Example commit:
`git commit -m "fix(api): require admin auth on kyc verify and enforce kyc status on buyShares"`

(dependency upgrades may warrant a separate `chore(deps): upgrade dependencies with available security patches` commit, kept atomic and distinct from the two logic fixes above)

**Guidelines**

- Never weaken an existing check to make a test pass; fix the actual gap.
- Treat `audit-allowlist.txt` entries you can't fix as your finding, not your failure; document why clearly rather than silently leaving a stale note.
- 401 for missing/invalid credentials, 403 for valid credentials without sufficient permission, consistent with the rest of the API's existing error convention.
