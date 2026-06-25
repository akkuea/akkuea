# Generate Typed Soroban Clients for Game Contracts

## Context

Raw XDR construction for Soroban contract calls is error-prone and produces unreadable code. The Quasar typed client generator (C4-015) produces TypeScript wrappers that make contract calls look like ordinary async function calls, with full type checking on arguments and return values.

Once the four game contracts are deployed to testnet, their contract IDs are used by Quasar to generate typed clients that the frontend and the API indexer use to interact with the game.

## What Needs to Be Done

After game contracts are deployed in C5-015, run the Quasar generator against all four contract WASM artifacts. Place the generated clients in `apps/shared/src/contracts/game/`. Export them from the shared package so both the webapp and the API can import them.

Verify that the generated clients compile without errors, match the entry points defined in the contract source code, and can be called in a unit test against a mock Soroban RPC.

## Acceptance Criteria

- Generated clients exist for PropertyNFT, LandToken, GameMarketplace, and GameEngine.
- Clients are exported from `apps/shared`.
- `bun run type-check` passes in `apps/shared`.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Do not hand-write the clients. Use the Quasar generator as documented in C4-015. If the generator output needs minor adjustments (type aliases, renamed fields), apply them as a post-processing step and document why in a comment at the top of the affected file. No `any` casts.
