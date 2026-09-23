# Bring Akkuea Land to the Webapp's Production Bar: Internationalization, Error Handling, and Accessibility

| Attribute       | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Issue ID        | C8-007                                                                                                  |
| Area            | AKKUEA-LAND                                                                                             |
| Difficulty      | High                                                                                                    |
| Labels          | akkuea-land, frontend, a11y, high                                                                       |
| Dependencies    | C5-007, C6-005                                                                                          |
| Estimated Lines | 4,000-5,000 (i18n infrastructure and string sweep, translations, error routes, a11y remediation, tests) |

## Context

The product brief repositions `apps/akkuea-land` as "the pilot's educational/visual onboarding tool," the place a prospective investor or ally goes to "feel the mechanics of the real pilot" before committing capital. C6-005 brought it onto the webapp's visual tokens. It is still well below the webapp on the three things that decide whether that audience can actually use it. They share one theme: parity with the product it introduces.

- **English only.** `apps/webapp` ships `next-intl` with `messages/en.json` and `messages/es.json` and an `app/[locale]/` segment. `apps/akkuea-land` has no i18n library, no message files, and no locale routing, and its roughly 7,800 lines of TS/TSX contain hardcoded strings. The onboarding tool for a bilingual product cannot be read by half its audience.
- **No error handling.** `apps/akkuea-land/src/app` has `loading.tsx` in five segments but no `error.tsx`, `global-error.tsx`, or `not-found.tsx`. The app depends on live Soroban reads and Pollar wallet and auth, both real failure surfaces. The webapp already solved this with `ErrorBoundary`, `PageErrorFallback`, and `SectionErrorFallback` (C4-011).
- **No accessibility bar.** `docs/design-system/foundations.md` commits the whole product to WCAG AA. The webapp has `jest-axe` and an a11y test. Akkuea Land has neither, and it has 22 `aria-` attributes across the whole app. Its core interaction, the tile-based `CityMap`, has not been checked for keyboard operability.

## What Needs to Be Done

- Add `next-intl` with locale routing that mirrors the webapp's setup (`apps/webapp/src/i18n/routing.ts`, `request.ts`), move every user-facing string in `apps/akkuea-land/src` into `messages/en.json` and `messages/es.json`, and add a locale switcher. Where the game explains a pilot concept (income cycles, evidence review, payouts), reuse the webapp's terminology so the two apps describe the same thing the same way.
- Add a key-parity check (en and es) to Akkuea Land's tests, matching the parity the webapp keeps.
- Add `error.tsx` for each route segment that has a `loading.tsx`, plus `global-error.tsx` and `not-found.tsx`. Reuse the webapp's error-fallback patterns through the shared design-system components wherever the two apps overlap. Do not introduce a second component library, which is C6-005's own rule.
- Add `jest-axe` and axe checks for every page and the main game components. Fix what they find, including keyboard navigation and focus management on `CityMap` and the property panel, labels on game controls, and color contrast against the design tokens.

## Acceptance Criteria

- Every user-facing string in `apps/akkuea-land/src` comes from a message file. A test or lint rule fails on new hardcoded strings in components, and the en and es key sets match exactly.
- The app renders fully in English and Spanish through locale routing, and the locale persists across navigation.
- A thrown error in any route segment renders a design-system-consistent fallback with a retry action, unknown routes render a proper not-found page, and tests cover both.
- axe checks pass with zero violations on every page and on the main game components, and `CityMap` tiles can be reached and activated by keyboard alone. Tests cover both.
- No new component library is introduced, and shared UI comes from the existing design system.
- The existing Akkuea Land onboarding tests (C5-016, #1017) still pass.
- All five required CI workflows pass on the pull request.

## Quality Standard

Akkuea Land exists to build trust before someone puts real money into the pilot. A crash with no fallback, a screen a Spanish speaker cannot read, or a map a keyboard user cannot operate works against that purpose. Follow `docs/design-system/` for every UI change. Keep translations accurate and consistent with the webapp's existing Spanish copy, and have them reviewed by a fluent speaker, not just machine-generated.
