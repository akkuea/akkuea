# Build Game Marketplace UI

## Context

The marketplace is where the game's economy becomes social. Players list properties they want to sell, browse what others have listed, and negotiate value based on location, building level, and income potential. A well-designed marketplace drives retention: it gives players a reason to check back even when they are not actively buying or improving.

## What Needs to Be Done

Build `src/app/marketplace/page.tsx` inside `apps/akkuea-land`. The page shows a grid of active listings. Each listing card shows a large color-coded tile preview, the property coordinates, the building level with its income rate, the asking price in LAND, the seller's abbreviated address, and the time since the listing was created.

Above the grid, filter chips allow filtering by improvement level. A sort control lets players sort by price (low to high, high to low) or by listing date (newest first). Both controls are instant: no request, client-side filtering on the fetched data.

Clicking a card opens a buy confirmation modal with a dark overlay. The modal shows the full property details, the price, and the player's current LAND balance. If the balance is sufficient, the "Confirm Purchase" button is active. If not, it is disabled and shows how much more LAND the player needs. Confirming calls `pollar.signAndSubmitTx()`, shows a loading state, and on success closes the modal, removes the listing from the grid with a fade-out animation, and shows a toast confirming ownership.

## Acceptance Criteria

- Listing grid renders with filter chips and sort control.
- Buy modal shows price and balance with the correct enabled or disabled state.
- Successful purchase animates the listing out and shows a confirmation toast.
- Empty states are shown when there are no listings or filters produce no results.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Empty states are not optional. If there are no listings: a clear message and a link to the city map. If filters produce no results: a "No listings match" message with a "Clear filters" button. The buy modal must be accessible: focusable with a keyboard, closable with Escape, and readable by screen readers. Test on a real mobile screen width.
