# Build City Map with Interactive Property Tiles

## Context

The city map is the central experience of Akkuea Land. It is the first thing players see after login, and the interface through which they discover, select, and act on properties. Its visual quality sets the tone for the entire product.

The map renders a 20x20 grid of 400 property tiles. Each tile communicates ownership, building level, and listing status at a glance. Clicking a tile opens the property detail panel. The map updates in real time as other players transact.

## What Needs to Be Done

Build `src/app/map/page.tsx` and its components inside `apps/akkuea-land`. The map is a CSS Grid of 400 tiles. Each tile is color-coded by owner address using a deterministic hash-to-HSL function so the same wallet always maps to the same color across sessions. Improvement level is shown as a tiered badge (V / R / C / S). Properties listed for sale show a pulsing amber indicator in the tile corner.

On hover, tiles lift slightly with a CSS scale transform and a tooltip appears showing coordinates, abbreviated owner address, improvement level, and listing price if applicable. On click, the selected tile gets a glowing selection ring and the property detail panel (C5-010) slides in from the right on desktop or from the bottom on mobile.

The map must perform well with all 400 tiles in the DOM. Use event delegation (one click handler on the grid container that reads `data-property-id` from the event target) rather than 400 individual listeners.

Fetch property data from the mock layer until contracts are deployed. When real-time events arrive (C5-014), animate the affected tile briefly to signal the change.

## Acceptance Criteria

- 20x20 grid renders with correct color-coding, badges, and listing indicators.
- Hover tooltip shows correct property data.
- Click opens the detail panel and applies a selection ring to the tile.
- Event delegation is used instead of per-tile listeners.
- Map is usable on screens from 375px wide up to ultrawide.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Performance is a requirement: 400 tiles must render without layout jank on mid-range hardware. Hover and selection transitions must be instant (CSS-only, no JavaScript animation on tiles). Test on a real mobile device, not just browser responsive mode. The map should feel alive, not static.
