# Contributing to Akkuea

Thank you for your interest in contributing to Akkuea. This guide covers everything you need to know to submit high-quality contributions - from forking the repository to getting your pull request merged.

Please read this document in its entirety before opening your first pull request. Following these standards protects the stability of the platform and makes the review process fast and efficient for everyone.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How We Work: Fork-Based Workflow](#how-we-work-fork-based-workflow)
3. [Setting Up Your Fork](#setting-up-your-fork)
4. [Keeping Your Fork Up to Date](#keeping-your-fork-up-to-date)
5. [Branching Strategy](#branching-strategy)
6. [Working on an Issue](#working-on-an-issue)
7. [Commit Standards](#commit-standards)
8. [Code Quality Standards](#code-quality-standards)
9. [Testing Requirements](#testing-requirements)
10. [CI/CD: Workflows Must Pass](#cicd-workflows-must-pass)
11. [Opening a Pull Request](#opening-a-pull-request)
12. [Pull Request Checklist](#pull-request-checklist)
13. [Review Process](#review-process)
14. [Common Pitfalls](#common-pitfalls)

---

## Code of Conduct

All contributors are expected to interact with respect and professionalism. Harassment, dismissive language, and personal attacks will not be tolerated. If you observe or experience unacceptable behavior, report it to the maintainers.

---

## How We Work: Fork-Based Workflow

**Akkuea does not accept direct pushes to the main repository.** Every contribution - regardless of size - must go through a personal fork and a pull request.

This is not a bureaucratic formality. The fork-based workflow gives maintainers visibility into every change, ensures CI runs against all contributions, and keeps the `main` and `develop` branches always in a deployable state.

**The rules:**

- You must fork the repository to your personal GitHub account.
- All work is done on a branch inside your fork.
- You open a pull request from your fork's branch into `akkuea/akkuea:develop`.
- You never push directly to `akkuea/akkuea` on any branch.

If you have been granted write access to the repository for maintenance purposes, the fork rule still applies to feature and fix work.

---

## Setting Up Your Fork

### 1. Fork the repository

Click the **Fork** button on the [akkuea/akkuea](https://github.com/akkuea/akkuea) GitHub page. This creates a copy of the repository under your account (`github.com/<your-username>/akkuea`).

### 2. Clone your fork locally

```bash
git clone https://github.com/<your-username>/akkuea.git
cd akkuea
```

### 3. Add the upstream remote

This is critical. The `upstream` remote points to the original repository. You will use it to pull in changes from the main project without going through your fork.

```bash
git remote add upstream https://github.com/akkuea/akkuea.git
```

Verify your remotes are configured correctly:

```bash
git remote -v
# origin    https://github.com/<your-username>/akkuea.git (fetch)
# origin    https://github.com/<your-username>/akkuea.git (push)
# upstream  https://github.com/akkuea/akkuea.git (fetch)
# upstream  https://github.com/akkuea/akkuea.git (push)
```

### 4. Install dependencies

```bash
bun run install:all
```

---

## Keeping Your Fork Up to Date

The `develop` branch of the main repository moves continuously. If your fork falls behind, you will encounter merge conflicts and your pull request will be harder to review. **Keep your fork synchronized before starting any new work and before opening a pull request.**

### Syncing your local fork with upstream

```bash
# Fetch all changes from the original repository
git fetch upstream

# Switch to your local develop branch
git checkout develop

# Merge upstream changes into your local develop
git merge upstream/develop

# Push the updated develop branch to your fork on GitHub
git push origin develop
```

### Rebasing your feature branch

If you have been working on a branch while `upstream/develop` has moved forward, rebase your branch on top of the latest develop rather than merging. This keeps the commit history clean.

```bash
# Update your local develop (as above), then:
git checkout feature/my-feature
git rebase develop
```

Resolve any conflicts that arise during the rebase, then force-push your feature branch to your fork:

```bash
git push origin feature/my-feature --force-with-lease
```

> `--force-with-lease` is safer than `--force`: it refuses to push if someone else has pushed to the same branch in the meantime, protecting against accidental overwrites.

**Make it a habit:** sync your fork at the start of each working session and immediately before opening a pull request.

---

## Branching Strategy

The main repository has two long-lived branches:

| Branch    | Purpose                                                       |
| --------- | ------------------------------------------------------------- |
| `develop` | Integration branch. All pull requests target this branch.     |
| `main`    | Production-ready releases only. Never target `main` directly. |

When working in your fork, create a short-lived feature branch from `develop` for every piece of work. Name your branch using the following convention:

```
<type>/<short-description>
```

Examples:

```
feat/property-tokenization-endpoint
fix/collateral-ratio-calculation
docs/update-environment-variables
refactor/lending-pool-service
test/kyc-verification-integration
```

Keep branch names lowercase, hyphen-separated, and descriptive enough that the purpose is obvious at a glance.

---

## Working on an Issue

All contributions must be linked to an open GitHub issue. Do not open a pull request for work that is not tracked by an issue.

### Before you start

1. Find an open issue or create one describing the work.
2. Comment on the issue to signal that you are working on it. This prevents duplicate effort.
3. Wait for a maintainer to acknowledge your intent if the issue is complex or has architectural implications.

### Understanding the issue

Before writing a single line of code, read the issue thoroughly. Pay attention to:

- **Acceptance criteria** - the explicit list of what must be true for the issue to be considered done.
- **Out of scope** - what the issue explicitly does not cover. Do not implement features that are not requested.
- **Related issues and PRs** - understand the context and avoid duplicating or conflicting with adjacent work.

If anything in the issue is ambiguous, ask for clarification in the issue thread before starting. Assumptions made in code are harder to correct than assumptions caught in a comment.

---

## Commit Standards

### Atomic commits

Each commit must represent a single, complete, self-contained change. This is the most important commit rule.

An atomic commit:

- Introduces one logical change only.
- Leaves the codebase in a working, buildable state after it is applied.
- Can be reverted independently without breaking unrelated functionality.
- Has a description that fully explains the change without referencing other commits.

**What atomic does not mean:** Atomic does not mean tiny. A commit that refactors a service and updates its corresponding tests is atomic - it is one logical change. A commit that refactors a service, adds a new feature, and fixes an unrelated bug is not atomic - it is three changes bundled together.

Bad commit history (non-atomic):

```
WIP
fix stuff
more fixes
almost done
final
```

Good commit history (atomic):

```
feat(api): add collateral validation to lending pool service
test(api): add unit tests for collateral validation edge cases
fix(contracts): correct interest rate precision loss on small amounts
docs: update lending pool API reference with collateral endpoint
```

### Conventional Commits format

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**

| Type       | When to use                                   |
| ---------- | --------------------------------------------- |
| `feat`     | A new feature or capability                   |
| `fix`      | A bug fix                                     |
| `docs`     | Documentation changes only (no code)          |
| `refactor` | Code restructuring with no behavior change    |
| `test`     | Adding or modifying tests only                |
| `chore`    | Tooling, CI, dependency updates, build system |
| `perf`     | A change that improves performance            |
| `style`    | Formatting, whitespace (no logic change)      |
| `revert`   | Reverting a previous commit                   |

**Scope** (optional but recommended): the workspace or module affected - `api`, `webapp`, `contracts`, `shared`.

**Short description rules:**

- Use the imperative mood: "add endpoint" not "added endpoint" or "adds endpoint"
- Do not capitalize the first letter
- Do not end with a period
- Keep it under 72 characters

**Body** (optional): explain the _why_, not the _what_. The code shows what changed; the body explains why the change was necessary. Include relevant context, constraints, or trade-offs.

**Footer** (optional): reference the issue this commit addresses using `Closes #<issue-number>` or `Refs #<issue-number>`.

Complete example:

```
fix(api): correct division-by-zero in interest rate calculation

The compound interest calculation in LendingPoolService divided by the
number of compounding periods before checking whether the value was
zero. For pools with a zero-period grace window this caused a runtime
panic that brought down the API process.

Guard added before the division. Edge case covered by a new unit test.

Closes #342
```

### What never belongs in a commit

- Commented-out code
- Debug `console.log` statements left in production paths
- Changes unrelated to the commit's stated purpose
- Secrets, API keys, or private keys of any kind
- Generated build artifacts (`dist/`, `.next/`, `*.wasm`)
- Lock file changes that were not caused by an intentional dependency update

---

## Code Quality Standards

Akkuea is a financial platform. The code must be production-grade. The following standards are non-negotiable.

### No technical debt

Technical debt is the cost paid later for shortcuts taken now. We do not accept shortcuts that defer correctness. Specifically:

- Do not leave `// TODO` or `// FIXME` comments unless they reference an open issue and are approved by a maintainer.
- Do not write placeholder implementations that return hardcoded values.
- Do not suppress TypeScript errors with `as any`, `// @ts-ignore`, or `// @ts-nocheck` unless the suppression is accompanied by a detailed comment explaining why it is necessary and what the correct long-term fix is.
- Do not disable ESLint rules inline unless you can justify it in a comment that will survive future review.

### Type safety

- All public function signatures must have explicit TypeScript types. Do not rely on inferred return types for exported functions.
- Zod schemas are the authoritative validation layer at system boundaries (API routes, form submissions). Use them.
- The `shared` library is the single source of truth for types shared between the API and the frontend. Do not duplicate type definitions.

### Error handling

- Every API route must handle errors explicitly. Do not let unhandled promise rejections reach the Elysia error boundary unintentionally.
- Use structured errors (typed error classes or discriminated unions) rather than throwing plain strings.
- Log errors with context. A log line that says `"error"` with no additional information is not useful.

### Security

- Never log sensitive data: private keys, secrets, passwords, personal data, or full request bodies that may contain credentials.
- Validate all input at the API boundary using Zod. Trust nothing from the request.
- Do not introduce new dependencies that fetch remote resources at install time or runtime without explicit maintainer approval.
- Follow the principle of least privilege: new API routes should only access the data and contracts they need for their specific operation.

### Performance

- Do not add N+1 query patterns. If your change fetches a list and then queries the database once per item, redesign it.
- Cache writes must have explicit invalidation. Do not add Redis writes without documenting when the key expires or gets cleared.
- Do not add synchronous blocking operations (file system reads, network calls) in request handler hot paths.

### Readability

- Write code that can be understood by another engineer six months from now.
- Function and variable names should describe intent, not implementation.
- Keep functions short and focused. A function that does two things is a function waiting to be split.
- Comments should explain _why_ something is done, not _what_ - the code already shows the what. If you need a comment to explain what a line does, the line should be rewritten to be self-explanatory.

---

## Testing Requirements

No pull request will be merged without adequate test coverage for the changes introduced.

### What must be tested

- **Every new function or service method** that contains business logic must have unit tests covering the happy path and all identified edge cases.
- **Every new API route** must have integration tests that cover successful responses, validation errors, and authorization failures.
- **Every bug fix** must be accompanied by a test that reproduces the bug before the fix and passes after.
- **Smart contract changes** must include Rust unit tests for all new or modified contract functions.

### Running tests

```bash
# Run all tests across all workspaces
bun run test

# Run tests for a specific workspace
cd apps/api && bun test
cd apps/webapp && bun test
cd apps/contracts && cargo test
```

### What makes a good test

- Tests are deterministic. They pass or fail consistently regardless of execution order or external state.
- Tests are isolated. They do not depend on the state left by other tests.
- Tests assert behavior, not implementation. If you refactor the internals of a function without changing its contract, the tests should not need to change.
- Test names describe what is being verified: `"returns 400 when collateral ratio is below minimum"` is good; `"test1"` is not.

### Coverage expectations

- Business logic in `apps/api/src/services/` is expected to have thorough unit test coverage.
- API routes in `apps/api/src/routes/` are expected to have integration test coverage.
- Smart contract functions are expected to have unit test coverage.
- UI components do not require exhaustive unit tests but should have smoke tests for non-trivial interactive behavior.

---

## CI/CD: Workflows Must Pass

Akkuea runs five GitHub Actions workflows on every pull request. **All five must pass before a pull request can be merged.** No exceptions.

| Workflow           | What it validates                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `monorepo-ci.yml`  | Workspace integrity, dependency consistency, cross-workspace type compatibility, security compliance scan |
| `api-ci.yml`       | API lint, type-check, unit and integration tests, build                                                   |
| `webapp-ci.yml`    | Webapp lint, type-check, unit tests, build                                                                |
| `shared-ci.yml`    | Shared library lint, type-check, build                                                                    |
| `contracts-ci.yml` | Rust format (`rustfmt`), linting (`cargo clippy`), unit tests, WASM build                                 |

### Before opening your pull request

Run every check locally to catch failures before CI does:

```bash
# Type checking
bun run typecheck

# Linting
bun run lint

# Tests
bun run test

# Full build
bun run build

# Smart contracts (from apps/contracts/)
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo build --target wasm32-unknown-unknown --release
```

### Investigating CI failures

When a workflow fails on your pull request:

1. Open the failed workflow run in GitHub Actions.
2. Expand the failing job and step to read the full error output.
3. Reproduce the failure locally using the command from the step above.
4. Fix the root cause - do not suppress the failure.
5. Push the fix as a new atomic commit.

Do not ask maintainers to merge a pull request with failing workflows. If a workflow failure appears to be unrelated to your changes (a flaky test, a transient network error), note this in the pull request and re-run the workflow to confirm it is not a real failure.

---

## Opening a Pull Request

### Before you open it

- [ ] Your branch is rebased on the latest `upstream/develop`.
- [ ] All five CI workflows pass locally (lint, typecheck, tests, build).
- [ ] Your commits are atomic and follow the Conventional Commits format.
- [ ] Your changes are limited to what the issue requested - no bonus features, no unrelated cleanup.
- [ ] You have not introduced any new warnings in TypeScript, ESLint, or Cargo Clippy output.

### Target branch

All pull requests must target `akkuea/akkuea:develop`. Never open a pull request targeting `main`.

### Pull request title

Use the same Conventional Commits format as your commit messages:

```
feat(api): add collateral ratio validation endpoint
fix(contracts): correct interest calculation precision loss
docs: update environment variables reference
```

### Pull request description

A well-written description dramatically reduces review time. Include:

**What this PR does** - a concise summary of the change, written for someone who has not read the issue.

**Why it is needed** - the context. Link to the issue with `Closes #<number>` or `Refs #<number>`.

**How to test it** - concrete steps a reviewer can follow to verify the change works as expected. Include any specific environment setup required.

**What was intentionally left out** - if the issue touched on things you did not implement, state this explicitly so reviewers do not assume they were missed.

**Screenshots or API output** (if applicable) - for UI changes or API responses, include a before/after comparison.

---

## Pull Request Checklist

Use this checklist in your pull request description. Every item must be checked before requesting review.

```markdown
### Checklist

#### Workflow & Process

- [ ] This PR targets `develop`, not `main`
- [ ] My fork is up to date with `upstream/develop`
- [ ] This PR is linked to an open issue (`Closes #` or `Refs #`)
- [ ] I have not implemented anything beyond what the issue requested

#### Commits

- [ ] All commits are atomic (one logical change per commit)
- [ ] All commit messages follow the Conventional Commits format
- [ ] No WIP, "fix", or "temp" commits in the history
- [ ] No commented-out code or debug statements in any commit

#### Code Quality

- [ ] No TypeScript errors (`bun run typecheck` passes)
- [ ] No ESLint errors or warnings (`bun run lint` passes)
- [ ] No new `any` types without justification
- [ ] No new TODOs without a linked issue
- [ ] No technical debt introduced

#### Tests

- [ ] New functionality is covered by tests
- [ ] Bug fixes include a regression test
- [ ] All existing tests pass (`bun run test` passes)
- [ ] Smart contract changes are covered by Rust tests (`cargo test` passes)

#### CI/CD

- [ ] `monorepo-ci.yml` passes
- [ ] `api-ci.yml` passes
- [ ] `webapp-ci.yml` passes
- [ ] `shared-ci.yml` passes
- [ ] `contracts-ci.yml` passes (if contracts were modified)

#### Security

- [ ] No secrets, keys, or credentials in any commit or file
- [ ] Input validation added for any new API surface
- [ ] No new dependencies introduced without maintainer awareness

#### Documentation

- [ ] Environment variables added or changed are reflected in `docs/deployment/environment-variables.md`
- [ ] New API endpoints are reflected in the relevant `docs/api/` file
- [ ] `README.md` updated if the change affects setup or usage
```

---

## Review Process

### What to expect

Once you open a pull request:

1. A maintainer will be assigned as reviewer within a few business days.
2. The reviewer may request changes. Address each comment specifically - do not make unrelated changes at the same time.
3. Mark conversations as resolved only when you have addressed the feedback (not just acknowledged it).
4. Once all requested changes are addressed and all workflows pass, the maintainer will approve and merge the PR using a squash or merge commit as appropriate.

### Responding to feedback

- Be specific in your replies. If you agree with a comment and made the change, say what you changed. If you disagree, explain your reasoning - disagreements are valuable and maintainers are open to reconsidering.
- Do not add "fixup" commits that only exist to address review comments. Either incorporate the fix into the original commit using an interactive rebase, or add a clean new atomic commit if the fix represents a meaningful addition.
- Keep your pull request updated with `upstream/develop` throughout the review process. If the branch falls too far behind, reviewers may ask you to rebase before continuing.

### Draft pull requests

If you want early feedback on an approach before the implementation is complete, open a **Draft Pull Request**. This signals to reviewers that the PR is not ready for full review, but you are open to directional feedback. Convert it to a regular PR when it is complete and all checklist items are satisfied.

---

## Common Pitfalls

**"I'll clean it up later."**
Cleanup that is deferred to a follow-up PR often never happens. Write the correct solution now. If the correct solution is blocked by something else, that blocker belongs in its own issue.

**Opening a PR without running CI locally first.**
Every CI failure that could have been caught locally wastes a review cycle. Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build` before every push.

**Not keeping the fork up to date.**
A fork that is weeks or months behind `upstream/develop` will produce PRs full of merge conflicts and logic conflicts with other merged work. Sync before you start, sync before you submit.

**Bundling multiple concerns into one PR.**
A PR that fixes a bug, adds a feature, and refactors a service is three PRs. Reviewers cannot give meaningful feedback on one concern without understanding its interaction with the others. Keep PRs focused.

**Touching files unrelated to the issue.**
Opportunistic refactoring in unrelated files makes PRs harder to review and harder to revert if something goes wrong. If you spot a problem in an unrelated file, open a new issue and address it separately.

**Suppressing TypeScript or ESLint errors instead of fixing them.**
Every suppression is a signal that something is wrong and the author chose not to deal with it. These accumulate into real bugs. Fix the underlying issue.

**Committing secrets or private keys.**
If you accidentally commit a secret, do not attempt to rewrite history yourself - contact a maintainer immediately. Rewriting history of a shared branch requires coordination to avoid data loss for other contributors.

---

## Questions

If you have questions about any part of this process, open a [GitHub Discussion](https://github.com/akkuea/akkuea/discussions) or comment on the relevant issue. Do not open a pull request to ask a question.

We are committed to making this a welcoming and productive contribution experience. When in doubt, ask.
