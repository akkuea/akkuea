# Components

Source: `apps/webapp/src/components/ui/`. Every component has a co-located `*.stories.tsx` - browse them live with `bun run storybook` (from `apps/webapp`; also exposed at the root via `bun run storybook` / `bun run build-storybook`).

## Inventory

| Component | Purpose |
|---|---|
| `Button` | Primary interactive control. Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `accent`. Sizes: `sm`, `md`, `lg`. Supports `isLoading` (spinner replaces icon/label) and `isSecure` (shows a lock icon - use for wallet-signing or admin-gated actions). Built on `framer-motion` for hover/tap micro-interaction (1.01 / 0.99 scale). |
| `Card` | Surface container. |
| `Modal` | Dialog overlay - focus-trapped, closes on Escape (see `docs/a11y-checklist.md`). |
| `Input` | Form text input. |
| `Badge` | Inline status/label chip. |
| `Loader` | Loading spinner primitive. |
| `Toggle` | Boolean switch control. |
| `Stepper` | Multi-step progress indicator with full keyboard navigation (arrow keys, Home/End, Enter/Space) and `aria-current="step"`. Only lets users navigate back to completed steps, never forward. This is the component to use for the pilot's multi-step flows - whitelist review, evidence review, payout-cycle progress - anywhere the UI needs to show "here's exactly where this process stands," not just a spinner. |
| `FreshnessIndicator` | Shows live/connecting/offline data status plus "time since last update," with an optional manual refresh button. `role="status"` + `aria-live="polite"` so state changes are announced. This is the component for any on-chain-derived value that can go stale - directly relevant to the pilot's read-only, RPC-driven dashboard (see `docs/strategy/product-brief.md`), where investors are explicitly shown data freshness rather than assuming it's always current. |
| `EmptyState` | First-class "nothing here yet" state - not a blank screen. |
| `ErrorBoundary` / `PageErrorFallback` / `SectionErrorFallback` | Layered error handling: a page-level fallback and a smaller section-level fallback so one failing widget doesn't take down an entire page. |
| `Skeleton` (+ `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonAvatar`, `SkeletonPropertyCard`, `SkeletonPoolCard`) | Loading-state placeholders, including domain-specific shapes for property and pool cards. |

## Conventions

- Import from the barrel: `import { Button, Card, Stepper } from "@/components/ui"` (see `index.ts`) rather than deep-importing individual files.
- Class composition goes through the shared `cn()` helper (`@/lib/utils`), which merges Tailwind classes safely (clsx + tailwind-merge semantics) - always use it rather than string-concatenating `className`.
- Icons come from `lucide-react` exclusively - don't introduce a second icon library.
- Motion/microinteraction goes through `framer-motion`, already a project dependency - keep hover/tap scale values in the same range already established in `Button` (roughly 1.01 hover / 0.99 tap) rather than inventing new motion scales per component.
- Every interactive component needs a Storybook story. This isn't just documentation - it's the fastest way to visually check a component against both themes (`.light` / dark) before it ships.

## Known inconsistency - worth fixing, not yet fixed

Several existing components bypass the token system documented in [`foundations.md`](foundations.md) and hardcode raw hex values or default Tailwind palette colors instead of the CSS custom properties:

- `Button.tsx` hardcodes hex values (`#1a1a1a`, `#262626`, `#404040`, `#ff3e00`, ...) instead of the equivalent tokens (`--secondary`, `--border`, `--border-hover`, `--accent`).
- `Stepper.tsx` and `FreshnessIndicator.tsx` use default Tailwind palette colors (`emerald-500`, `amber-400`, `zinc-700`, ...) rather than `--accent-secondary` / `--accent` / `--border`.

This means these components will not automatically track a future token change (e.g., adjusting `--accent` app-wide), and their colors don't strictly follow the "accent is the one constant signal color" rule in `foundations.md`. Recorded here rather than silently worked around - when touching any of these components next, migrate their hardcoded colors to the token-backed Tailwind utilities (`bg-accent`, `border-border`, `text-accent-secondary`, etc.) instead of adding more hardcoded values on top.

## Akkuea Land components

Game-specific components under `apps/akkuea-land/src/components/`. These are not part of the `apps/webapp` `ui/` library and are not importable from it; they follow the same conventions (lucide-react icons, `framer-motion` at the established 1.02 hover / 0.98 tap scale) against the `--land-*` token layer described in [`foundations.md`](foundations.md#cross-app-token-usage).

- **GameShell** (`components/layout/GameShell.tsx`): Top navigation bar with wallet connection status and LAND balance display. Uses `bg-land-surface` header, `font-mono` for wallet address and balance.
- **CityMap** (`components/game/CityMap.tsx`): Tile grid using CSS custom property `--tile-size` (80px). Tile ownership states use semantic tokens: `--tile-owned` (success), `--tile-treasury` (gold), `--tile-listed` (purple), `--tile-empty` (subtle).
- **PropertyPanel** (`components/game/PropertyPanel/`): Slide-in panel showing property details. Uses `bg-land-bg/95` backdrop, `border-land-border` border. Status-specific panels (OwnedPanel, UnownedPanel, ListedPanel) use success/gold/listed tokens respectively.
- **OnboardingGate** (`components/game/onboarding/`): Three-step onboarding flow. Progress dots use `bg-land-accent` (active) and `bg-land-border` (inactive).
- **PilotCta** (`components/game/PilotCta.tsx`): The "this is a simulation, see the real pilot" call-to-action from `docs/strategy/recommendations.md` (section 2b). Two variants: `banner` (end of onboarding) and `compact` (dashboard footer). Both render the same copy and link, so the funnel message is defined once rather than per surface.

**Note:** `components/GameShell.tsx` and `components/CityMap.tsx` (outside the `layout/` and `game/` subdirectories) are an earlier, unreferenced pair - `GameShell.tsx` is imported by nothing, and imports the old `CityMap.tsx`. They were migrated to tokens along with everything else rather than left as a source of stale patterns, but they are dead code and are candidates for deletion.
