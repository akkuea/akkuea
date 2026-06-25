# Upgrade Next.js to Resolve Security Vulnerabilities

## Context

The webapp currently runs Next.js 16.1.7. Dependabot has flagged thirteen open security alerts against this version, seven of which are rated high severity. The vulnerabilities include middleware and proxy bypass attacks, server-side request forgery via WebSocket upgrades, cross-site scripting in App Router applications, and multiple denial of service vectors against Server Components. All of them are resolved in version 16.2.6.

This is a dependency upgrade, not a feature change. The goal is to close the open CVEs with minimal surface area.

## What Needs to Be Done

Update the `next` package in `apps/webapp/package.json` from `16.1.7` to `^16.2.6`. After updating, verify the build passes, all existing CI checks pass, and there are no runtime regressions on the key pages: landing, marketplace, dashboard, lending, and KYC.

Next.js patch releases within the same major version maintain backwards compatibility. No application code changes are expected. If any deprecation warnings appear during the build, document them in the pull request description but do not address them in this issue.

## Acceptance Criteria

- `next` version in `apps/webapp/package.json` is `^16.2.6` or higher.
- `bun run build` completes without errors in `apps/webapp`.
- All existing CI workflows pass on the submitted pull request.
- No new TypeScript errors are introduced.
- The pull request description lists the CVEs being closed.

## Files to Modify

The change is contained to `apps/webapp/package.json` and the lockfile. Run `bun install` after updating the version to regenerate `bun.lock`.

## Quality Standard

This is a security patch. It must be clean, contained, and verifiable. Do not combine this change with unrelated fixes or upgrades. All CI workflows must pass. The pull request description must reference the Dependabot alerts being resolved.
