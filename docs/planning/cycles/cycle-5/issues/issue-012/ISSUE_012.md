# Build Player Dashboard and Income Tracker

## Context

Players need a single place to understand their position in the game: how many properties they own, how much LAND they are earning, and what their transaction history looks like. The dashboard also surfaces the most frequent recurring action in the game (claiming rental income), so it should be the fastest path to that outcome.

## What Needs to Be Done

Build `src/app/dashboard/page.tsx` inside `apps/akkuea-land`. The page has three sections.

The top section is the portfolio summary: LAND token balance displayed prominently, total accrued income across all owned properties, and a single "Claim All" button. The "Claim All" button sends claim transactions for every owned property that has unclaimed income. While processing, it shows a progress count ("Claiming 3 of 5..."). When complete, the income counter resets to zero and the LAND balance updates.

The middle section is the property grid: every property the player owns, shown as cards with the tile color, coordinates, building level, and the individual accrued income for that property. Cards with unclaimed income show a subtle green glow. Clicking a card navigates to the city map with that property selected.

The bottom section is the transaction history: a list of the player's recent game events (buys, improvements, listings, claims) fetched from the event endpoint built in C5-014. Each entry shows the event type, coordinates, amount if relevant, and the ledger number. The list paginates with a "Load more" button.

If the player owns no properties, the portfolio and property sections show a friendly empty state with a link to the city map and a note about the starter claim from onboarding.

## Acceptance Criteria

- Portfolio summary shows correct balance and accrued income totals.
- "Claim All" processes all claimable properties and reflects the updated balance.
- Property cards navigate to the map on click.
- Transaction history renders correctly with pagination.
- Empty state shown when the player owns no properties.
- All CI workflows pass on the submitted pull request.

## Quality Standard

"Claim All" must show real progress, not just a spinner. If a single claim fails mid-batch, the remaining claims should still proceed and the failures should be reported at the end. The income accrual amount per property must be calculated client-side from the last-claimed ledger and the current ledger (fetched from the Soroban RPC) so the display is always fresh, not stale from the last server response.
