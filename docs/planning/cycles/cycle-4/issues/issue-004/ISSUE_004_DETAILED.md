# C4-004: Remove soroban-client and Standardize on @stellar/stellar-sdk

## Issue Metadata

| Attribute       | Value                              |
| --------------- | ---------------------------------- |
| Issue ID        | C4-004                             |
| Area            | SHARED                             |
| Difficulty      | Trivial                            |
| Labels          | shared, backend, frontend, trivial |
| Dependencies    | None                               |
| Estimated Lines | 10-20                              |

## Overview

This issue removes dead dependency weight and standardizes the Stellar SDK import path across the monorepo. The `apps/shared` package already uses `@stellar/stellar-sdk` and serves as the correct reference for the other packages.

## Current State

Run the following to see the problem:

```bash
grep -r "soroban-client\|\"stellar-sdk\"" --include="package.json" .
```

You will find `soroban-client` declared in three package.json files and `stellar-sdk` (the old name) declared in two. None of the TypeScript source files import from `soroban-client`, confirming it is dead weight.

## Cleanup Steps

### Step 1: Remove soroban-client

Remove the `soroban-client` entry from these three files:

- `/package.json` (root)
- `apps/api/package.json`
- `apps/webapp/package.json`

### Step 2: Rename stellar-sdk to @stellar/stellar-sdk

In `apps/api/package.json` and `apps/webapp/package.json`, rename the dependency key:

```json
"@stellar/stellar-sdk": "^13.3.0"
```

Remove the old `"stellar-sdk"` entry at the same time.

### Step 3: Update TypeScript imports

Search for all imports using the old name:

```bash
grep -r "from 'stellar-sdk'" apps/ --include="*.ts"
```

The files that will appear are in `apps/api/src/`. Update each one:

```typescript
// Before
import { Keypair } from "stellar-sdk";

// After
import { Keypair } from "@stellar/stellar-sdk";
```

The public API surface of `@stellar/stellar-sdk` is identical to `stellar-sdk` at the same version. No other code changes are needed.

### Step 4: Regenerate the lockfile

```bash
bun install
```

### Step 5: Verify

```bash
bun run type-check
bun run lint
bun test
```

Run these from the repository root or individually in each affected package. All must pass.

## What Not to Do

Do not upgrade the `@stellar/stellar-sdk` version as part of this change. The goal is cleanup only. A version upgrade is a separate concern.

Do not remove the `"resolutions"` field in `apps/shared/package.json` that pins `stellar-base`. That field exists for a reason and should remain untouched.

## Definition of Done

- `soroban-client` does not appear in any `package.json`.
- All packages declare `@stellar/stellar-sdk` rather than `stellar-sdk`.
- All TypeScript imports from `'stellar-sdk'` are updated to `'@stellar/stellar-sdk'`.
- `bun run type-check` passes across all packages.
- All CI workflows pass on the pull request.
