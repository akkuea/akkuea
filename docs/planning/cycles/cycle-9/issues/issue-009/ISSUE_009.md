# Whitelist onboarding and review screens are English-only in a bilingual app

| Field           | Value   |
| --------------- | ------- |
| ID              | C9-009  |
| Area            | WEBAPP  |
| Difficulty      | Medium  |
| Dependencies    | C6-008  |
| Estimated Lines | 200-350 |

## Context

Every other pilot component uses `useTranslations` with keys in `apps/webapp/messages/en.json` and `es.json`. Two do not: `WhitelistOnboardingForm.tsx` and `WhitelistReviewQueue.tsx` in `apps/webapp/src/components/pilot/`. Their text is written inline ("Review Pending", "Application Rejected", "Loading pending requests...", "Full Name", "Required if rejecting...", the option labels, the placeholders). The pages that host them, `pilot/onboarding/page.tsx` and `pilot/review/whitelist/page.tsx`, do not use translations either.

This is the first screen a Spanish-speaking investor sees.

## What Needs to Be Done

- Move every user-facing string in the two components and the two pages to `next-intl` keys, in both `en.json` and `es.json`.
- Include status headings, field labels, placeholders, option labels, button text, loading and empty states, and error messages.
- Keep the two message files at the same key set.
- Follow `docs/design-system/` for any markup that changes.
- Update the two Storybook stories and the Playwright specs that match on text.

## Scope

In scope: the two components, the two pages, message files, stories, affected tests.

Out of scope: redesigning the screens, the API error messages.

## Acceptance Criteria

- [ ] No hardcoded user-facing English remains in the four files.
- [ ] With the `es` locale, both screens render fully in Spanish, including pending, approved and rejected states.
- [ ] `en.json` and `es.json` have identical key sets.
- [ ] Existing unit and e2e tests pass.

## How to Verify

```bash
cd apps/webapp
bun run lint && bun run type-check
bun test
```
