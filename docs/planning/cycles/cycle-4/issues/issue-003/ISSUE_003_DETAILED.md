# C4-003: Upgrade drizzle-orm to Resolve SQL Injection Vulnerability

## Issue Metadata

| Attribute       | Value                      |
| --------------- | -------------------------- |
| Issue ID        | C4-003                     |
| Area            | API                        |
| Difficulty      | Trivial                    |
| Labels          | backend, security, trivial |
| Dependencies    | None                       |
| Estimated Lines | 5-30                       |

## Overview

Drizzle ORM versions before 0.45.2 contain a SQL injection vulnerability via improperly escaped SQL identifiers. This affects the API's database layer. The fix is a version upgrade, but the version gap between 0.38 and 0.45 includes query builder API changes that may require code updates in the repository layer.

## Upgrade Steps

### Step 1: Update package versions

In `apps/api/package.json`, update:

```json
"drizzle-orm": "^0.45.2",
"drizzle-kit": "^0.31.0"
```

Check the current stable version of `drizzle-kit` on npm before setting the version. It should be a stable release, not a beta.

### Step 2: Regenerate the lockfile

```bash
bun install
```

### Step 3: Run type-checking

```bash
cd apps/api
bun run type-check
```

Drizzle 0.45 changed some generic types in the query builder. TypeScript errors here indicate places that need updating.

### Step 4: Check the repository files

The files most likely to require changes are in `apps/api/src/repositories/`. Common breaking changes between drizzle 0.38 and 0.45 include:

- The `db.select().from()` API is unchanged.
- The `db.insert().values()` API is unchanged.
- `db.update().set().where()` is unchanged.
- The `sql` template tag for raw queries may have stricter escaping requirements, which is intentional and the fix for the vulnerability.
- The `onConflictDoUpdate` option changed its structure in some versions.

Review each repository file and fix any TypeScript errors before running tests.

### Step 5: Run the full test suite

```bash
cd apps/api
bun test
```

All tests must pass. Do not comment out or skip failing tests. If a test failure reveals a query that relied on the vulnerable escaping behavior, fix the query correctly.

### Step 6: Run the linter

```bash
cd apps/api
bun run lint
```

## Pull Request Requirements

The pull request description must:

- Reference the Dependabot alert for drizzle-orm.
- List any repository files that required query changes and explain what changed.
- Confirm that all tests pass and no tests were skipped or modified to work around failures.

## Definition of Done

- `drizzle-orm` is at `^0.45.2` or higher.
- `drizzle-kit` is at a stable, non-beta release.
- All repository queries compile without TypeScript errors.
- All existing tests pass.
- All CI workflows pass on the pull request.
