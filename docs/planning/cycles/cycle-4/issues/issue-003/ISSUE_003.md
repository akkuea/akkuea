# Upgrade drizzle-orm to Resolve SQL Injection Vulnerability

## Context

The API uses `drizzle-orm@0.38.4` as its ORM. Dependabot has flagged a high-severity SQL injection vulnerability in this version caused by improperly escaped SQL identifiers. The vulnerability is resolved in `drizzle-orm@0.45.2`.

This issue also covers updating the companion `drizzle-kit` package, which handles migrations and is pinned to a beta version. Both packages should be moved to stable, current versions.

## What Needs to Be Done

Update `drizzle-orm` in `apps/api/package.json` to `^0.45.2` and update `drizzle-kit` to its current stable release. After upgrading, run the full API test suite and verify that all database queries work correctly. The drizzle API between 0.38 and 0.45 includes some changes to query builder methods; any breakages must be resolved as part of this issue.

## Acceptance Criteria

- `drizzle-orm` version in `apps/api/package.json` is `^0.45.2` or higher.
- `drizzle-kit` is updated to a stable, non-beta release.
- All existing API tests pass with the updated packages.
- `bun run type-check` passes in `apps/api`.
- All CI workflows pass on the submitted pull request.
- The pull request description notes any query API changes that were required.

## Files to Modify

The primary change is in `apps/api/package.json`. The lockfile must be regenerated. If any drizzle query builder calls have changed their API between versions, the affected files in `apps/api/src/repositories/` will also need updates.

## Quality Standard

This is a security patch with a moderate risk of API breakage due to the version gap. Test every repository query before submitting. Do not skip failing tests or comment them out. If a query builder change is needed, document it clearly in the pull request. All CI workflows must pass.
