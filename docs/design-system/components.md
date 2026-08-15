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
