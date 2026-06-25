# Build Property Detail Panel and Action Flows

## Context

When a player taps or clicks a property tile on the city map, they need to understand what they are looking at and take meaningful action on it: buy it, improve it, list it, or claim income from it. This panel is the primary action surface of the game and the most frequently used UI in the entire product.

The quality of this panel determines whether players feel empowered or confused.

## What Needs to Be Done

Build `src/components/game/PropertyPanel.tsx` inside `apps/akkuea-land`. On desktop, the panel slides in from the right as a fixed-width sidebar when a tile is selected. On mobile, it rises as a bottom sheet with a drag handle.

The panel has two sections. The top section shows the property state: a miniature tile preview with the ownership color, the coordinates, the building level shown as a visual progression bar (four steps: Vacant, Residential, Commercial, Skyscraper with the current step highlighted), the owner address (abbreviated, with a copy button), and the accrued rental income if the viewer owns this property.

The bottom section renders actions contextually:

- Unowned, viewer connected: "Buy from Treasury" button with the price in LAND.
- Owned by viewer: "Improve" button showing the cost and the next level, a "List for Sale" inline form with a price input, and "Claim Income" showing the earned amount.
- Listed by another player: the asking price and a "Buy" button.
- Viewer not connected: a single "Connect Wallet" prompt that triggers the Pollar login flow.

Every action that triggers a contract invocation must show a clear pending state while `pollar.signAndSubmitTx` is processing, and resolve to either a success state (with a visual confirmation on the tile) or a descriptive error message.

## Acceptance Criteria

- All four ownership states render the correct action set.
- Panel slides in on desktop and rises as a bottom sheet on mobile.
- Building level progression bar is correct for all four levels.
- Action buttons show pending, success, and error states.
- All CI workflows pass on the submitted pull request.

## Quality Standard

No action requiring a signature should be visually reachable when the wallet is not connected. Pending states must tell the player what is happening, not just spin. On success, the corresponding map tile must update immediately (optimistic UI) without waiting for an event from the indexer. Test all four ownership states with mock data before marking this done.
