# Remove Test Snapshots and Exclude from Git

## Context

The Soroban contract tests generate JSON snapshot files under `apps/contracts/contracts/defi-rwa/test_snapshots/`. There are currently 24 of these files committed to the repository. Snapshot files are generated artifacts: they change whenever tests run and differ across environments, making them a source of spurious merge conflicts and noisy diffs. They belong in `.gitignore`, not in version control.

## What Needs to Be Done

Delete the existing snapshot files from the repository using `git rm`. Add the `test_snapshots/` directory pattern to the contracts `.gitignore`. Also add a general `*.snap` entry to the root `.gitignore` to prevent snapshot files from other tools from being committed in the future.

## Acceptance Criteria

- All files under `apps/contracts/contracts/defi-rwa/test_snapshots/` are removed from the repository.
- `test_snapshots/` is excluded in `apps/contracts/.gitignore`.
- `*.snap` is excluded in the root `.gitignore`.
- The contract test suite still passes after the snapshot files are removed.
- All CI workflows pass on the submitted pull request.

## Files to Modify

Use `git rm -r apps/contracts/contracts/defi-rwa/test_snapshots/` to remove the tracked files. Update `apps/contracts/.gitignore` and the root `.gitignore`. Verify that the snapshot directory is recreated correctly when tests run but is not tracked by git.

## Quality Standard

This is a housekeeping change. Keep the pull request focused. Do not modify test logic, contract code, or CI workflows. Confirm that `cargo test` still passes in `apps/contracts` before submitting. All CI workflows must pass.
