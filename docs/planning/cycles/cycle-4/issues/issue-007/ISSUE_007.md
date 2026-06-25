# Add PR Template, Issue Templates, and Changelog Automation

## Context

The repository has no pull request template, no issue templates, and no changelog automation. Contributors open pull requests with inconsistent descriptions, making review harder and traceability worse. Issues opened through the GitHub UI have no structure, which leads to ambiguous bug reports and feature requests.

This issue adds the scaffolding that keeps contributions consistent and makes the project easier to maintain as the contributor base grows.

## What Needs to Be Done

Create a pull request template that guides contributors to describe what changed, why, how to test it, and whether all CI checks pass. Create issue templates for bug reports, feature requests, and Stellar Wave contributor applications. Add a GitHub Actions workflow that automates changelog generation on every release using conventional commit messages.

## Acceptance Criteria

- A pull request template exists at `.github/PULL_REQUEST_TEMPLATE.md` and appears automatically when a contributor opens a PR.
- At least three issue templates exist under `.github/ISSUE_TEMPLATE/`: bug report, feature request, and general task.
- A changelog workflow runs on tag pushes and generates or updates `CHANGELOG.md` based on commit history.
- The changelog format follows the Keep a Changelog convention.
- All CI workflows pass on the submitted pull request.

## Files to Create

Create `.github/PULL_REQUEST_TEMPLATE.md`, the `.github/ISSUE_TEMPLATE/` directory with at least three template files, and `.github/workflows/changelog.yml`. Optionally create `CHANGELOG.md` at the repository root with an initial entry for the current cycle.

## Quality Standard

Templates should be concise and actionable. Do not make them so long that contributors skip them. Each field in a template should serve a clear purpose. The changelog workflow must be tested by verifying it runs correctly on a tag event or through a manual workflow dispatch. All CI workflows must pass.
