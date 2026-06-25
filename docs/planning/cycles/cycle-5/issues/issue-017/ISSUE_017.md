# Write Game Rules Guide and Developer Setup Documentation

## Context

Two audiences need documentation for Akkuea Land. Players need to understand the game rules and economy without reading a word about Stellar, Soroban, or smart contracts. Developers who want to contribute or run the game locally need a setup guide that works on a fresh machine.

## What Needs to Be Done

Create `docs/game/GAME_RULES.md` written entirely for players. It must explain the city grid, LAND tokens and how to get them, how to buy and sell properties, how rental income works, what building improvements do and cost, and a short strategy section. No technical terms beyond "wallet."

Create `docs/game/DEVELOPER_SETUP.md` for contributors. It must cover: prerequisites (Rust, Stellar CLI, Bun, a Pollar API key), how to run the four game contracts locally in tests, how to run `apps/akkuea-land` with mock data for frontend-only development, how to run it against real testnet contracts, and how to run the full test suite.

Both documents must be kept short. GAME_RULES.md should not exceed two pages. DEVELOPER_SETUP.md should have every command copy-pasteable and tested.

## Acceptance Criteria

- `docs/game/GAME_RULES.md` covers all game mechanics with no blockchain jargon.
- `docs/game/DEVELOPER_SETUP.md` allows a new contributor to run the game from scratch.
- All shell commands in the developer guide are verified to work.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Every command in the developer guide must be tested on a clean environment before committing. A guide that lists commands that do not work is worse than no guide. For game rules: if you have to explain what a term means, either define it plainly on first use or replace it with a simpler word.
