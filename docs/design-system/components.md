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

This means these components will not automatically track a future token change (e.g., adjusting `--accent` app-wide), and their colors don't strictly follow the "accent is the one constant signal color" rule in `foundations.md`. Since tokens now live in `apps/shared/src/styles/tokens.css` and are shared with `apps/akkuea-land`, the cost of these holdouts is higher than it was: a colour change made once in the shared file reaches both apps except through these components. Recorded here rather than silently worked around - when touching any of these components next, migrate their hardcoded colors to the token-backed Tailwind utilities (`bg-accent`, `border-border`, `text-accent-secondary`, etc.) instead of adding more hardcoded values on top.

## Akkuea Land components

Game-specific components under `apps/akkuea-land/src/components/`. These are not part of the `apps/webapp` `ui/` library and are not importable from it, but they now draw on the same token values, imported from `@akkuea/shared/styles/tokens.css` and aliased onto the `--land-*` layer described in [`foundations.md`](foundations.md#cross-app-token-usage). They follow the same conventions otherwise: `lucide-react` icons, `framer-motion` at the established 1.02 hover / 0.98 tap scale.

- **GameShell** (`components/layout/GameShell.tsx`): Top navigation bar with wallet connection status, LAND balance display, and the theme toggle. Uses `bg-land-surface` header, `font-mono` for wallet address and balance.
- **ThemeToggle** (`components/layout/ThemeToggle.tsx`): Sun/moon button that flips between the shared light and dark token sets. Rendered in the `GameShell` header and, separately, in the dashboard header, because `dashboard/page.tsx` renders its own chrome rather than wrapping in `GameShell`.
- **CityMap** (`components/game/CityMap.tsx`, styles in `CityMap.css`): 20x20 tile grid. Unowned tiles use `--tile-empty`; treasury tiles use `--land-gold`; player-owned tiles are coloured per-owner by `addressToHSL` (`lib/colorHash.ts`) so ownership is distinguishable at a glance, which is why they are not a single token. Building-level badges use `--tile-empty`, `--land-success`, `--land-accent`, and `--tile-listed` for levels 0 to 3. Note that `--tile-owned` and `--tile-treasury` are declared in `globals.css` but are not consumed by this component; they are only referenced by the dead `components/CityMap.tsx` below.
- **PropertyPanel** (`components/game/PropertyPanel/`): Slide-in panel showing property details. Uses `bg-land-bg/95` backdrop, `border-land-border` border. Status-specific panels (OwnedPanel, UnownedPanel, ListedPanel) use success/gold/listed tokens respectively. Their primary action buttons are solid fills, so they take the `-fill` tokens with `text-land-on-accent` on top.
- **OnboardingGate** (`components/game/onboarding/`): Three-step onboarding flow. Progress dots use `bg-land-accent` (active) and `bg-land-border` (inactive).
- **PilotCta** (`components/game/PilotCta.tsx`): The "this is a simulation, see the real pilot" call-to-action from `docs/strategy/recommendations.md` (section 2b). Two variants: `banner` (end of onboarding) and `compact` (dashboard footer). Both render the same copy and link, so the funnel message is defined once rather than per surface.

**Choosing a colour utility:** a solid button or badge takes a `-fill` token (`bg-land-accent-fill`) paired with `text-land-on-accent`. Coloured type, 1px borders, and translucent washes take the plain token (`text-land-accent`, `border-land-accent/30`, `bg-land-accent/10`). The two are the same value in the dark theme, so getting this wrong is invisible until someone switches to light. See [Fill versus text](foundations.md#fill-versus-text).

**Note:** `components/GameShell.tsx` and `components/CityMap.tsx` (outside the `layout/` and `game/` subdirectories) are an earlier, unreferenced pair - `GameShell.tsx` is imported by nothing, and imports the old `CityMap.tsx`. They were migrated to tokens along with everything else rather than left as a source of stale patterns, but they are dead code and are candidates for deletion.
