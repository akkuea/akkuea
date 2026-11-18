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

## Files and Locations

| File                                                           | What is there today                                     |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/webapp/src/components/pilot/WhitelistOnboardingForm.tsx` | Inline English at 121, 147, 179, 232, 252, 261 and more |
| `apps/webapp/src/components/pilot/WhitelistReviewQueue.tsx`    | Inline English at 79, 166, 172, 184, 202 and more       |
| `apps/webapp/src/app/[locale]/pilot/onboarding/page.tsx`       | No translations                                         |
| `apps/webapp/src/app/[locale]/pilot/review/whitelist/page.tsx` | No translations                                         |
| `apps/webapp/src/components/pilot/EvidenceReviewQueue.tsx`     | A pilot component that already uses `useTranslations`   |
| `apps/webapp/messages/en.json`, `es.json`                      | Message files, 417 lines each                           |

## Implementation Steps

1. Add a `pilot.whitelist` namespace to both message files.
2. Replace each literal with `t("...")`, including `aria-label`, `placeholder` and option text.
3. Update stories and tests that match on text.

## Code Example

```tsx
const t = useTranslations("pilot.whitelist");

<h2 className="text-2xl font-bold text-white">{t("status.pendingTitle")}</h2>
<input placeholder={t("form.fullNamePlaceholder")} />
```

## Testing Guidance

- Add a test that compares the key sets of `en.json` and `es.json` if none exists.
- Render both components with the `es` locale and assert no English literal from the old code remains.
