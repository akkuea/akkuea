# Align Akkuea Land with the Webapp Design System

## Context

`docs/design-system/` documents a deliberate visual language: a high-contrast, near-monochrome terminal aesthetic with CSS custom properties for every color, a single accent color reserved for meaning, and a documented component library in `apps/webapp/src/components/ui`. `apps/akkuea-land` predates that documentation and does not follow it: it has its own, separate `globals.css`, and components like `GameShell.tsx` use default Tailwind palette classes (`text-green-600`, `text-red-600`) and generic `font-sans` styling instead of the design tokens. Akkuea Land is positioned, per `docs/strategy/product-brief.md`, as the pilot's visual and educational companion. A companion that looks like a different product undermines that positioning every time someone plays it.

## What Needs to Be Done

- Migrate `apps/akkuea-land`'s styling foundation onto the same CSS custom properties documented in `docs/design-system/foundations.md`: either import the token definitions from `apps/webapp/src/app/globals.css` directly (preferred, single source of truth) or extract the tokens into a shared location both apps import from, if build-tooling constraints make direct cross-app CSS imports impractical.
- Audit every component in `apps/akkuea-land/src/components/` for hardcoded colors, default Tailwind palette classes, and ad hoc typography, and replace them with the token-backed utilities (`bg-accent`, `text-muted-foreground`, `.font-mono` for on-chain values like LAND balances and contract addresses, etc.).
- Where a UI need in Akkuea Land genuinely overlaps with an existing `apps/webapp/src/components/ui` component (buttons, cards, modals, empty states, error boundaries), reuse it rather than reimplementing it. Where Akkuea Land has a genuinely game-specific need (the city map grid, property tiles), build a new component following the same conventions documented in `docs/design-system/components.md`, not a divergent style.
- Add the "this is a simulation, see the real pilot" call-to-action described in `docs/strategy/recommendations.md` directly into the game's UI (onboarding or dashboard), not just as prose in the docs.
- Update `docs/design-system/` to document the now-shared cross-app token system and note any Akkuea Land-specific components that were added.

## Acceptance Criteria

- `apps/akkuea-land` no longer has its own divergent color/typography system; it consumes the same tokens as `apps/webapp`.
- A visual side-by-side of both apps (included in the PR description) shows clear family resemblance: same background/foreground treatment, same accent color usage, same typography for numeric/on-chain values.
- No component in `apps/akkuea-land` uses a default Tailwind palette color (`emerald-*`, `zinc-*`, `amber-*`, etc.) where a design-system token exists for the same purpose.
- The "see the real pilot" call-to-action is live in the game UI and links to the pilot dashboard (or a waitlist, if the pilot dashboard from C6-002 hasn't merged yet).
- `docs/design-system/components.md` and `foundations.md` are updated to reflect the shared system.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is a visual-quality issue, and visual quality is judged by looking at it, not by counting tokens replaced. Every screen in Akkuea Land should be reviewed in both light and dark theme before this is considered done. Motion and micro-interaction conventions (the hover/tap scale values already established in `Button.tsx`) should carry over consistently rather than each component inventing its own feel.
