# C8-007: Bring Akkuea Land to the Webapp's Production Bar: Internationalization, Error Handling, and Accessibility

## Issue Metadata

| Attribute       | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Issue ID        | C8-007                                                                                                  |
| Area            | AKKUEA-LAND                                                                                             |
| Difficulty      | High                                                                                                    |
| Labels          | akkuea-land, frontend, a11y, high                                                                       |
| Dependencies    | C5-007, C6-005                                                                                          |
| Estimated Lines | 4,000-5,000 (i18n infrastructure and string sweep, translations, error routes, a11y remediation, tests) |

**Description**

Bring `apps/akkuea-land` up to the webapp's bar on language support, failure handling, and accessibility, so the pilot's onboarding companion works for the same audience as the product it introduces. The full context is in `ISSUE_007.md`.

**Requirements and context**

- Webapp reference setup: `apps/webapp/src/i18n/routing.ts`, `apps/webapp/src/i18n/request.ts`, `apps/webapp/messages/en.json`, `apps/webapp/messages/es.json`, the `app/[locale]/` segment, and `next-intl` 4.14.5 in `apps/webapp/package.json`. Use the same version in Akkuea Land.
- Akkuea Land routes today (`apps/akkuea-land/src/app/`): `page.tsx`, `layout.tsx`, `loading.tsx`, `(auth)/login/`, `dashboard/`, `map/`, `marketplace/`, `onboarding/`, and `api/game/`. The move to `app/[locale]/` must leave `api/game/` outside the locale segment.
- Components to sweep: `src/components/CityMap.tsx`, `GameShell.tsx`, `layout/`, `game/CityMap.tsx`, `game/PilotCta.tsx`, `game/PropertyPanel/`, and `game/onboarding/`. About 7,800 lines of TS/TSX in total.
- Loading routes that need an error sibling: `app/loading.tsx`, `marketplace/loading.tsx`, `dashboard/loading.tsx`, `map/loading.tsx`, and `(auth)/login/loading.tsx`.
- Error fallback reference: `apps/webapp/src/components/ui/ErrorBoundary.tsx`, `PageErrorFallback.tsx`, and `SectionErrorFallback.tsx`, plus `apps/webapp/src/app/[locale]/error.tsx`. C6-005's rule applies: reuse through the shared design system and do not fork a second component library.
- a11y reference: `apps/webapp/src/components/marketplace/__tests__/a11y.check.test.tsx` and `jest-axe` in `apps/webapp/package.json`. Akkuea Land has 22 `aria-` attributes today.

Example: locale-aware error route:

```tsx
// apps/akkuea-land/src/app/[locale]/map/error.tsx
"use client";
import { useTranslations } from "next-intl";
import { PageErrorFallback } from "@/components/ui/PageErrorFallback"; // shared design-system component

export default function MapError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("Errors");
  return (
    <PageErrorFallback
      title={t("map.title")}
      description={t("map.description")}
      onReset={reset}
    />
  );
}
```

```ts
// Key parity check, mirroring the webapp's.
import en from "../../messages/en.json";
import es from "../../messages/es.json";
expect(flattenKeys(es).sort()).toEqual(flattenKeys(en).sort());
```

**Suggested execution**

1. `git checkout -b feature/akkuea-land-production-parity`
2. Add `next-intl`, the routing and request config, and middleware, then move routes under `app/[locale]/` and confirm existing tests still pass before touching strings.
3. Sweep strings segment by segment (onboarding, map, property panel, marketplace, dashboard, auth) into `messages/en.json`, reusing webapp terminology for pilot concepts.
4. Write `messages/es.json`, have it reviewed by a fluent speaker, and add the parity test and a hardcoded-string lint rule or test.
5. Add a locale switcher in `GameShell` or the layout.
6. Add `error.tsx` per segment, plus `global-error.tsx` and `not-found.tsx`.
7. Add `jest-axe`, write axe checks per page and main component, and fix the findings. Make `CityMap` tiles focusable with arrow-key navigation and Enter or Space to open a tile's panel, and manage focus when `PropertyPanel` opens and closes.

**Test and commit**

- [ ] en and es parity test, plus a hardcoded-string guard
- [ ] Render tests in both locales for each page
- [ ] Error route and not-found tests
- [ ] axe checks with zero violations on every page and main component
- [ ] Keyboard navigation test for `CityMap` and focus test for `PropertyPanel`
- [ ] Existing onboarding tests (#1017) still passing
- [ ] All five CI workflows green

Example commit:
`git commit -m "feat(akkuea-land): add en/es i18n, error routes, and accessibility checks"`

**Guidelines**

- Follow `docs/design-system/` for every UI change, including the locale switcher and error screens.
- Do not introduce a second component library (C6-005).
- Translations must be reviewed by a fluent speaker. Machine output alone is not acceptable.
