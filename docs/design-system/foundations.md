# Foundations

Source: `apps/shared/src/styles/tokens.css` (the token values, shared by every app), `apps/webapp/src/app/globals.css` (Tailwind CSS v4 `@theme inline` mapping and effect utilities), and `apps/webapp/src/context/ThemeContext.tsx`.

**Token values are defined once, in `apps/shared/src/styles/tokens.css`.** Both `apps/webapp` and `apps/akkuea-land` import it. Do not redeclare a colour in an app's `globals.css`; add or change it in the shared file so both apps move together.

## Theming model

Two themes, `dark` (default) and `light`, toggled by adding/removing a `.light` class on `<html>`. All color tokens are CSS custom properties defined once in `:root` (dark values) and overridden inside `.light`. Tailwind consumes them through `@theme inline` (`--color-background: var(--background)`, etc.), so every token below is available as a Tailwind utility (`bg-background`, `text-foreground`, `border-border`, ...).

`ThemeProvider` persists the choice to `localStorage` under the `theme` key and falls back to `prefers-color-scheme` on first load. The webapp's provider intentionally renders `null` until mounted to avoid a hydration mismatch - any new theme-dependent UI in `apps/webapp` must follow the same pattern rather than reading `theme` during SSR. Akkuea Land has its own provider with the same public API but different internals; see [Theming in Akkuea Land](#theming-in-akkuea-land).

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
| `--foreground-subtle` | `#4d4d4d` | `#a3a3a3` | Third text tier: separators, disabled glyphs, empty-state fills. Not body copy |
| `--accent-tertiary` | `#f5a623` | `#f5a623` | Warm gold fill: token balances, treasury, prices |
| `--accent-quaternary` | `#b388ff` | `#b388ff` | Violet fill, categorical: marketplace listing state |
| `--warning` | `#ffab40` | `#ffab40` | Amber fill: advisory state between `--accent-secondary` and `--destructive` |
| `--accent-ink` | `#0a0a0a` | `#0a0a0a` | Text on any filled accent swatch. Theme-invariant by design |
| `--accent-text` and `-secondary` / `-tertiary` / `-quaternary` / `--warning-text` / `--destructive-text` | same as fill | darkened | The same hues set as type on the page background. See [Fill versus text](#fill-versus-text) |

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

## Cross-app token usage

Both `apps/webapp` and `apps/akkuea-land` import the same file:

```css
@import "@akkuea/shared/styles/tokens.css";
```

`apps/shared/src/styles/tokens.css` is the single source of truth for colour and typography. Neither app declares a palette value of its own. Change a colour there and it lands in both apps at once; that is the property the file exists to protect.

### How Akkuea Land consumes them

Akkuea Land keeps its `--land-*` and `--tile-*` names, but every one of them is now an alias onto a shared token rather than an independent value:

| Land token | Resolves to | Dark | Light |
|---|---|---|---|
| `--land-bg` | `--background` | `#000000` | `#ffffff` |
| `--land-surface` | `--card` | `#0a0a0a` | `#fafafa` |
| `--land-surface-raised` | `--secondary` | `#141414` | `#f5f5f5` |
| `--land-border` / `--land-border-hover` | `--border` / `--border-hover` | `#262626` / `#404040` | `#e5e5e5` / `#d4d4d4` |
| `--land-fg` | `--foreground` | `#fafafa` | `#0a0a0a` |
| `--land-fg-muted` | `--muted-foreground` | `#737373` | `#737373` |
| `--land-fg-subtle` | `--foreground-subtle` | `#4d4d4d` | `#a3a3a3` |
| `--land-accent` | `--accent-text` | `#ff3e00` | `#c23100` |
| `--land-gold` | `--accent-tertiary-text` | `#f5a623` | `#8a5200` |
| `--land-success` | `--accent-secondary-text` | `#00ff88` | `#00734a` |
| `--land-danger` | `--destructive-text` | `#ff4444` | `#c62828` |
| `--land-warning` | `--warning-text` | `#ffab40` | `#9a5800` |
| `--tile-listed` | `--accent-quaternary-text` | `#b388ff` | `#5b2fb8` |
| `--font-game` | `--font-geist-sans` | Avenir Next stack | Avenir Next stack |

The alias names are kept because they carry game meaning the core palette does not: "the colour of a treasury tile" is a more useful thing to write in a component than "accent tertiary". What changed is where the values come from.

The practical result is that Akkuea Land's primary accent is now the same red-orange as the webapp's, and both apps set type in the same stack. They read as one product.

### Fill versus text

A single colour cannot clear WCAG AA against both a near-black and a near-white ground. So each signal colour has two roles:

- **Fill** (`--accent`, `--accent-tertiary`, `--land-accent-fill`, `--land-gold-fill`, ...): the vivid swatch, used as a solid background with `--accent-ink` / `--land-on-accent` on top. Fill values are deliberately identical in both themes, which is what lets the ink token stay a single fixed value (`#0a0a0a`) rather than flipping per theme.
- **Text** (`--accent-text`, `--land-accent`, ...): the same hue set on the page background. In dark it is the fill value, which already clears AA on `--background`. In light it darkens.

Rule of thumb: a solid button or badge takes the fill token; coloured type, 1px borders, and translucent washes (10 to 20 percent) take the text token, so a wash and the type sitting on it move together.

Measured contrast in the light theme, against `#ffffff` and the `#fafafa` card surface: accent 5.39, secondary 5.67, tertiary 6.12, quaternary 7.91, warning 5.34, destructive 5.39. All clear AA for normal text. Dark ink on every fill clears AA in both themes (lowest is 5.60, ink on `--accent`).

### Theming in Akkuea Land

`apps/akkuea-land/src/context/ThemeContext.tsx` exposes the same API as the webapp's (`ThemeProvider`, `useTheme`, the same `theme` localStorage key), so a user who switches between apps keeps their choice, and a `storage` event in one propagates to the other.

The internals differ, deliberately. The webapp provider holds theme in React state and renders `null` until mounted. Land instead treats the class on `<html>` as an external store and reads it with `useSyncExternalStore`. Two reasons:

1. Land renders `OnboardingGate` at the root. Returning `null` until mounted would blank the server-rendered markup on first paint.
2. `THEME_INIT_SCRIPT` applies the stored class before first paint, so the DOM already holds the answer; reading it back is more direct than mirroring it into state, and avoids a setState-in-effect (which `react-hooks/set-state-in-effect` rejects).

Anything new that is theme-dependent should read `useTheme()` rather than sniffing the class directly.

### What is still Akkuea Land specific

Layout and motion, not colour: `--tile-size`, `--tile-gap`, `--tile-radius`, the `.tile-grid` utility, and the `tile-flash` / `pulse-glow` / `slide-up` keyframes. Player-owned tiles are also coloured per owner by `addressToHSL` (`lib/colorHash.ts`) rather than by a token, because the point of that colour is to distinguish one owner from another, not to carry brand meaning.

Both apps additionally share the same scrollbar treatment, the same `.scanlines` / `.glass` / `.animate-shimmer` utility pattern, and the same `.font-mono` treatment for on-chain numeric values.
