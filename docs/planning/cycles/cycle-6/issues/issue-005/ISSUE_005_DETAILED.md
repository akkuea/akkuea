# C6-005: Align Akkuea Land with the Webapp Design System

## Issue Metadata

| Attribute       | Value                          |
| --------------- | ------------------------------- |
| Issue ID        | C6-005                          |
| Area            | WEBAPP (Akkuea Land)             |
| Difficulty      | High                             |
| Labels          | frontend, high                   |
| Dependencies    | None                              |
| Estimated Lines | 4000-6000 (spans every component file in apps/akkuea-land plus shared token wiring) |

**Description**

Migrate every styled surface in `apps/akkuea-land` onto the design tokens and component conventions documented in `docs/design-system/`, currently only implemented in `apps/webapp`.

**Requirements and context**

- Current state (confirmed by direct inspection): `apps/akkuea-land/src/app/globals.css` is a separate file from `apps/webapp/src/app/globals.css`; `apps/akkuea-land/src/components/GameShell.tsx` uses `text-green-600` / `text-red-600` and plain `font-sans` rather than any token.
- Target state: `apps/akkuea-land` reads color, typography, and effect values from the same source of truth as `apps/webapp`, documented in `docs/design-system/foundations.md`.
- Components known to need migration (confirmed present in the codebase; audit for others during implementation): `GameShell.tsx`, `CityMap.tsx` / `CityMap.css`, dashboard page, onboarding step components, property panel.
- `CityMap.css` is a plain CSS file, not Tailwind classes; decide during implementation whether to convert it to Tailwind + tokens or to keep it as CSS but reference the CSS custom properties (`var(--accent)`, etc.) directly, whichever produces cleaner, more maintainable code for a grid-heavy component. Either is acceptable as long as it consumes the shared tokens rather than hardcoded hex values.
- Reuse candidates from `apps/webapp/src/components/ui`: `Button`, `Card`, `Modal`, `Badge`, `Loader`, `Toggle`, `EmptyState`, `ErrorBoundary`, `Skeleton` family. Decide on a sharing mechanism: importing directly from `apps/webapp` across the workspace boundary, or extracting shared, framework-agnostic pieces into `apps/shared` if direct cross-app component imports prove impractical given each app's own bundler config. Document whichever approach is chosen in `docs/design-system/README.md` so future contributors don't reinvent it.

**Suggested execution**

1. `git checkout -b feature/akkuea-land-design-system-alignment`
2. Decide and implement the token-sharing mechanism first (import `globals.css` tokens into `apps/akkuea-land`, or extract to a shared location); get this working and verified before touching individual components.
3. Decide and implement the component-sharing mechanism for the `apps/webapp/src/components/ui` primitives that make sense to reuse.
4. Migrate `GameShell.tsx` as the first component, since it's the app's outermost shell and a good place to catch remaining issues early.
5. Work through the remaining components (`CityMap`, dashboard, onboarding steps, property panel) systematically, converting hardcoded/default-palette styling to token-backed utilities.
6. Add the "see the real pilot" call-to-action component, linking to the pilot dashboard route (or a placeholder/waitlist route if C6-002 hasn't merged yet).
7. Update `docs/design-system/foundations.md` and `components.md` to describe the shared system and note any Akkuea Land-specific additions.

**Test and commit**

- [ ] Visual regression check (manual screenshots, before and after) for every migrated screen, in both light and dark theme
- [ ] No component in `apps/akkuea-land` references a default Tailwind palette color where a design-system token exists for the same semantic purpose
- [ ] Existing `apps/akkuea-land` test suite still passes after the migration
- [ ] The "see the real pilot" CTA renders and links correctly

Example commit:
`git commit -m "feat(akkuea-land): migrate to the shared webapp design system"`

**Guidelines**

- Do not introduce a second, competing component library; extend or reuse the existing one.
- Preserve all existing game functionality; this is a styling and structural migration, not a behavior change. Any behavior change discovered as necessary along the way should be called out explicitly in the PR description, not silently bundled in.
- Keep the CSS Grid / no-canvas / no-WebGL constraint from the original Akkuea Land build (documented in the Cycle 5 overview) intact; this issue is about tokens and components, not the rendering approach.
