# Akkuea Design System

This documents the visual and interaction system actually implemented in [`apps/webapp`](../../apps/webapp) - extracted from the running code (`src/app/globals.css`, `src/context/ThemeContext.tsx`, `src/components/ui/`), not a separate aspirational spec. If the code and this document ever disagree, the code is correct and this document is stale - update it.

## Design principles

The implemented system reads as **terminal / monospace-technical**, not a generic SaaS look:

- **High-contrast, near-monochrome base** (pure black/white in dark mode, off-white/near-black in light mode) with a single accent color doing all the signaling work.
- **Signal color, not decoration.** The accent (`--accent`, a red-orange) and the secondary accent (`--accent-secondary`, green) are reserved for meaning - status, calls to action, live indicators - not general decoration. This matters specifically for a product whose core trust claim is "you can see the real state of your investment": color should always be reporting a real status (on-time, late, disputed, approved), never just styling.
- **Terminal-native texture**, deliberately: scanline overlays, ASCII-style borders, noise textures, monospace tabular numerals (`font-feature-settings: "tnum" 1`), a blinking terminal cursor utility. This is a considered aesthetic choice, not an accident - it signals "infrastructure," which fits a product whose credibility argument is about verifiable on-chain state rather than a polished consumer-fintech veneer.
- **Dark-first.** `getStoredTheme()` in `ThemeContext.tsx` defaults to `"dark"` unless the OS explicitly prefers light or the user has toggled it before. Design and QA in dark mode first; verify light mode second.
- **Every visual effect is theme-aware.** Every custom CSS property in `globals.css` is redefined inside `.light`, not just the primary background/foreground pair. Any new token added to the system must follow this pattern - see [`foundations.md`](foundations.md).

## What "auditable" looks like in this system

The pilot's central credibility claim (see [`../strategy/product-brief.md`](../strategy/product-brief.md)) is that trust is visible and auditable, not asserted. That has direct design consequences documented in [`components.md`](components.md):

- Status is always shown as a small, explicit, textual/iconic state (see `FreshnessIndicator`, `.status-dot`) - never implied only by color.
- Multi-step flows (whitelist review, evidence review, payout cycles) use the `Stepper` component to show progress against an explicit sequence, not just a spinner.
- Empty and error states are first-class components (`EmptyState`, `ErrorBoundary`, `PageErrorFallback`, `SectionErrorFallback`), not blank screens - a dashboard whose job is to build trust cannot fail silently.

## Structure of this folder

- [`foundations.md`](foundations.md) - color tokens, typography, spacing/effects primitives, light/dark theming rules
- [`components.md`](components.md) - the actual component inventory in `apps/webapp/src/components/ui`, conventions for using and extending it

## Where the source of truth lives

- Tokens: `apps/webapp/src/app/globals.css`
- Theme switching logic: `apps/webapp/src/context/ThemeContext.tsx`
- Components: `apps/webapp/src/components/ui/*.tsx` (each with a co-located `.stories.tsx` - run `bun run storybook` from `apps/webapp` to browse them live)
