# Remove soroban-client and Standardize on @stellar/stellar-sdk

## Context

The monorepo currently declares three different identifiers for what is effectively the same Stellar SDK package: `soroban-client`, `stellar-sdk`, and `@stellar/stellar-sdk`. The `soroban-client` package was deprecated when its functionality was absorbed into `stellar-sdk` starting at version 10. It has not been maintained since and carries no active security updates. Additionally, `stellar-sdk` is the old package name; the current canonical name is `@stellar/stellar-sdk`.

A search across the entire codebase shows zero imports from `soroban-client`. It exists in `package.json` files but is never used. Having three names for the same library increases bundle size, creates confusing signals for new contributors, and adds unnecessary dependency surface area.

## What Needs to Be Done

Remove `soroban-client` from all `package.json` files where it appears: the repository root, `apps/api`, and `apps/webapp`. Then standardize all remaining references from `stellar-sdk` to `@stellar/stellar-sdk` so the entire monorepo uses a single, consistent package name. Update any TypeScript imports that use the bare `stellar-sdk` name.

The `apps/shared` package already uses `@stellar/stellar-sdk` correctly and serves as the reference.

## Acceptance Criteria

- `soroban-client` does not appear in any `package.json` file in the repository.
- All packages use `@stellar/stellar-sdk` rather than the bare `stellar-sdk` name.
- All TypeScript imports from `stellar-sdk` are updated to import from `@stellar/stellar-sdk`.
- `bun run type-check` passes across all packages.
- All CI workflows pass on the submitted pull request.

## Files to Modify

Remove `soroban-client` from `package.json` at the root, in `apps/api`, and in `apps/webapp`. Update `stellar-sdk` to `@stellar/stellar-sdk` in those same files. Search for `from 'stellar-sdk'` across all TypeScript files and update those imports. The affected source files are in `apps/api/src/`.

## Quality Standard

This is a dependency cleanup with zero tolerance for broken imports. Run `bun run type-check` in every package before submitting. All CI workflows must pass. Do not introduce any new package dependencies as part of this change.
