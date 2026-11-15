# No navigation leads to the pilot pages: investor, ally, onboarding and review are reachable only by typing the URL

| Field           | Value   |
| --------------- | ------- |
| ID              | C9-010  |
| Area            | WEBAPP  |
| Difficulty      | Medium  |
| Dependencies    | C6-002  |
| Estimated Lines | 150-300 |

## Context

The pilot has five routes under `apps/webapp/src/app/[locale]/pilot/`: `investor`, `ally`, `onboarding`, `review/whitelist` and `review/evidence`. Nothing in `apps/webapp/src/components/layout/`, `components/landing/` or the locale root page links to any of them. The product brief calls the pilot the near-term product, and a visitor cannot find it.

## What Needs to Be Done

- Add an entry point to the pilot from the main navigation, on desktop and mobile.
- Link the investor dashboard and the onboarding request to everyone.
- Show the ally and review links only where they make sense, and say in the PR how that is decided. A hidden link is a convenience, not access control: the pages and the API keep their own checks.
- Add the labels to `en.json` and `es.json`.
- Follow `docs/design-system/`.

## Scope

In scope: navigation components, message files, tests.

Out of scope: changing the pilot pages, new authorization logic, the landing page copy.

## Acceptance Criteria

- [ ] From the home page, the investor dashboard and the onboarding request can each be reached without typing a URL, on desktop and mobile widths.
- [ ] Links keep the current locale.
- [ ] The active pilot route is marked in the navigation.
- [ ] Keyboard navigation and focus states work, with no new axe violations.
- [ ] A test covers the new links.

## How to Verify

```bash
cd apps/webapp
bun run lint && bun run type-check
bun test
```
