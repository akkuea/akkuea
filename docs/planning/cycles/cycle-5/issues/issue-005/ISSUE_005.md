# Implement GameMarketplace Soroban Contract

## Context

Players need to buy and sell properties with each other, not just from the game treasury. The GameMarketplace contract handles this by holding properties in escrow when listed, releasing them to buyers on purchase, and returning them to sellers on cancellation.

This contract is the economic heart of Akkuea Land. Its correctness is critical: a bug in the escrow logic can result in permanently locked properties or stolen tokens.

## What Needs to Be Done

Implement the `game-marketplace` Soroban contract. When a seller lists a property, the marketplace calls `transfer_from` on the PropertyNFT contract to take custody of the NFT (the seller must have approved the marketplace contract first). When a buyer purchases, the marketplace transfers the LAND tokens from buyer to seller and the NFT from escrow to buyer in the same atomic operation. When a seller cancels, the NFT is returned from escrow to the seller.

The contract stores active listings as a map from property ID to `Listing` struct. Use Cougr's `ExecutionGuard` to serialize the buy flow and prevent re-entrancy.

The contract exposes: `list` (create a listing), `buy` (purchase a listed property), `cancel` (remove a listing), `get_listing` (read a single listing), and `get_all_listings` (paginated list of active listings for the frontend).

## Acceptance Criteria

- List, buy, and cancel flows work correctly end-to-end in tests.
- A property cannot be sold twice (the listing is removed atomically with the transfer).
- Buying with insufficient LAND balance fails and leaves the listing intact.
- `cargo test` covers all three flows plus error cases.
- All CI workflows pass on the submitted pull request.

## Quality Standard

The buy function must be atomic. The LAND transfer and the NFT transfer must either both succeed or both fail. Do not use `.unwrap()` in non-test code. Test with the actual PropertyNFT and LandToken contract clients in tests, not mocks.
