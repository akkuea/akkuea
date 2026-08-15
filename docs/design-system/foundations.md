# Foundations

Source: `apps/webapp/src/app/globals.css` (Tailwind CSS v4, `@theme inline` token mapping) and `apps/webapp/src/context/ThemeContext.tsx`.

## Theming model

Two themes, `dark` (default) and `light`, toggled by adding/removing a `.light` class on `<html>`. All color tokens are CSS custom properties defined once in `:root` (dark values) and overridden inside `.light`. Tailwind consumes them through `@theme inline` (`--color-background: var(--background)`, etc.), so every token below is available as a Tailwind utility (`bg-background`, `text-foreground`, `border-border`, ...).

`ThemeProvider` persists the choice to `localStorage` under the `theme` key and falls back to `prefers-color-scheme` on first load. It intentionally renders `null` until mounted to avoid a hydration mismatch - any new theme-dependent UI must follow the same pattern rather than reading `theme` during SSR.

## Color tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `--background` | `#000000` | `#ffffff` | Page background |
| `--foreground` | `#fafafa` | `#0a0a0a` | Primary text |
| `--card` | `#0a0a0a` | `#fafafa` | Card/panel surfaces |
| `--card-foreground` | `#fafafa` | `#0a0a0a` | Text on cards |
| `--primary` | `#ffffff` | `#0a0a0a` | Primary buttons/emphasis |
| `--primary-foreground` | `#000000` | `#ffffff` | Text on primary surfaces |
| `--secondary` | `#141414` | `#f5f5f5` | Secondary surfaces |
| `--muted` | `#1a1a1a` | `#f0f0f0` | De-emphasized surfaces |
| `--muted-foreground` | `#737373` | `#737373` | De-emphasized text (same in both themes) |
| `--accent` | `#ff3e00` | `#ff3e00` | Primary signal color - same in both themes |
| `--accent-secondary` | `#00ff88` | `#00c969` | Secondary signal color (success/positive) |
| `--destructive` | `#ff4444` | `#ff4444` | Errors, destructive actions |
| `--border` / `--border-hover` | `#262626` / `#404040` | `#e5e5e5` / `#d4d4d4` | Default and hover border states |
| `--input` | `#1a1a1a` | `#f5f5f5` | Form control backgrounds |
| `--ring` | `#ffffff` | `#0a0a0a` | Focus ring color |
| `--glow-primary` / `--glow-accent` | rgba variants | rgba variants | Used by `.glow` / `.glow-accent` box-shadow utilities |

**Rule:** `--accent` (red-orange) is the only color that does not change between themes - it is the one constant signal across both modes. Do not introduce a second theme-invariant color without a specific reason; the whole point is that everything else adapts to context except the one color meant to always mean "pay attention here."

## Typography

- `--font-geist-sans`: `"Avenir Next", "Segoe UI", "Helvetica Neue", system-ui, sans-serif` - body/UI text.
- `--font-geist-mono`: `"SFMono-Regular", "IBM Plex Mono", "Menlo", "Monaco", monospace` - used for on-chain values (addresses, tx hashes, contract IDs, amounts), timestamps, and anything the terminal aesthetic should touch.
- `.font-mono` additionally sets `font-feature-settings: "tnum" 1, "zero" 1` - tabular figures with a slashed zero, so numeric columns (balances, cycle amounts) align and `0`/`O` never get confused. Always apply `.font-mono` (not just a generic monospace class) to any numeric on-chain value.

## Effects and texture primitives

All defined in `globals.css`, theme-aware unless noted:

| Utility | Purpose |
|---|---|
| `.noise-bg` | Subtle SVG fractal-noise overlay (`--noise-opacity`, lower in light mode) |
| `.grid-pattern` / `.grid-pattern-dense` | Background grid lines at 60px / 20px, using `--border` |
| `.dot-pattern` | Radial-dot background grid |
| `.scanlines` | CRT-style repeating horizontal line overlay |
| `.glow` / `.glow-accent` / `.glow-text` | Box-shadow / text-shadow glow using `--glow-primary` / `--glow-accent` |
| `.border-glow` | Animated gradient border sweep on hover |
| `.gradient-text` / `.gradient-text-accent` | Clipped gradient text fills |
| `.glass` | Backdrop-blur translucent surface, theme-aware background alpha |
| `.hover-lift` / `.card-hover` | Standard hover elevation/border-color transitions |
| `.status-dot` / `.status-dot-pulse` | Small glowing dot for live status, using `--accent-secondary` |
| `.terminal-cursor::after` | Blinking `_` cursor, for terminal-style inputs/prompts |

Animation keyframes available as utility classes: `.animate-flicker`, `.animate-pulse-subtle`, `.animate-float`, `.animate-rotate-slow`, `.animate-gradient-x`, `.animate-blink`, `.animate-shimmer`.

**Convention:** these are texture, not information. Never make a status distinction (approved vs. pending, on-time vs. late) depend solely on which glow/scanline/noise utility is applied - pair it with explicit text or an icon, consistent with the "auditable, not just styled" principle in the [design-system README](README.md).

## Interaction basics

- `cursor: pointer` is applied globally to `button`, `a`, `[role="button"]`, and submit/button inputs - don't re-add it manually.
- `:focus-visible` uses a 2px `--accent` outline with 2px offset - do not override focus styling per-component; extend the shared rule if a component needs different focus treatment.
- Scrollbars are custom-styled (6px, `--border` thumb, transparent track) - this is global, not per-component.
