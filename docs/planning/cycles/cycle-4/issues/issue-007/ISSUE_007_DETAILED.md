# C4-007: Add PR Template, Issue Templates, and Changelog Automation

## Issue Metadata

| Attribute       | Value                  |
| --------------- | ---------------------- |
| Issue ID        | C4-007                 |
| Area            | REPO                   |
| Difficulty      | Medium                 |
| Labels          | documentation, trivial |
| Dependencies    | None                   |
| Estimated Lines | 80-140                 |

## Overview

This issue creates the contributor scaffolding that keeps pull requests and issues readable as the team scales. The three deliverables are the PR template, the issue templates, and the changelog workflow.

## Pull Request Template

Create `.github/PULL_REQUEST_TEMPLATE.md`. The template should prompt contributors to answer the questions a reviewer needs to do their job efficiently. Keep it short enough that contributors actually fill it out.

Recommended structure:

```markdown
## Summary

Describe what this pull request changes and why.

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Security patch
- [ ] Dependency upgrade
- [ ] Documentation
- [ ] Refactor

## How to test

Steps to verify this change works as expected.

## Checklist

- [ ] All CI workflows pass
- [ ] No new `any` type casts introduced
- [ ] No linting rules disabled
- [ ] Tests added or updated where applicable
- [ ] Documentation updated where applicable
```

## Issue Templates

Create a directory at `.github/ISSUE_TEMPLATE/` with the following files:

**bug_report.yml**

Use the GitHub structured issue form format. Include fields for: description of the bug, steps to reproduce, expected behavior, actual behavior, environment details (OS, browser, wallet), and relevant logs or screenshots.

**feature_request.yml**

Include fields for: the problem being solved, the proposed solution, alternatives considered, and any relevant context or mockups.

**task.yml**

A lightweight template for general development tasks. Include fields for: description, acceptance criteria, and area (API, WEBAPP, CONTRACT, SHARED).

For each template, set `labels` in the front matter to auto-apply the appropriate label when the issue is created.

Example front matter for bug_report.yml:

```yaml
name: Bug Report
description: Report a bug or unexpected behavior
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: "Please search existing issues before submitting a new one."
  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear description of the bug.
    validations:
      required: true
```

## Changelog Workflow

Create `.github/workflows/changelog.yml`. Use `release-drafter` or a conventional-commits-based tool to generate the changelog automatically.

The recommended approach is `release-drafter/release-drafter`:

```yaml
name: Release Drafter

on:
  push:
    branches:
      - main
      - develop

permissions:
  contents: write
  pull-requests: write

jobs:
  update_release_draft:
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v6
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Create a corresponding `.github/release-drafter.yml` configuration file that maps commit prefixes to changelog categories:

```yaml
name-template: "v$RESOLVED_VERSION"
tag-template: "v$RESOLVED_VERSION"
categories:
  - title: "Security"
    labels:
      - "security"
  - title: "New Features"
    labels:
      - "enhancement"
  - title: "Bug Fixes"
    labels:
      - "bug"
  - title: "Dependencies"
    labels:
      - "dependencies"
  - title: "Documentation"
    labels:
      - "documentation"
change-template: "- $TITLE (#$NUMBER) @$AUTHOR"
```

## Initial CHANGELOG.md

Create `CHANGELOG.md` at the repository root. Use the Keep a Changelog format. Add an initial `[Unreleased]` section that notes this is the first structured changelog entry.

## Definition of Done

- `.github/PULL_REQUEST_TEMPLATE.md` exists and appears when opening a PR.
- Three issue templates exist under `.github/ISSUE_TEMPLATE/`.
- A changelog workflow runs on pushes to main and develop.
- `CHANGELOG.md` exists at the repository root.
- All CI workflows pass on the pull request.
