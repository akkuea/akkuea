# C7-001: Implement the Real USDC-to-EURC Settlement Path in the Pilot Payout-Split Contract

## Issue Metadata

| Attribute       | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Issue ID        | C7-001                                                 |
| Area            | CONTRACT                                               |
| Difficulty      | High                                                   |
| Labels          | smart-contract, contracts, soroban, tokenization, high |
| Dependencies    | C6-001                                                 |
| Estimated Lines | 400-700 (implementation, tests, decision-log entry)    |

**Description**

Replace the literal stub in `pilot-payout-split/src/lib.rs` (`eurc_swap_path_status()` returning `"stubbed-fast-follow"`, currently declared around line 307-309) with a real on-chain USDC-to-EURC swap path, plus the per-holder currency preference the product brief describes as an investor-facing opt-in.

**Requirements and context**

- Cross-contract call pattern already exists in this file: `IncomeTokenClient` and `WhitelistClient` are declared via `#[contractclient(name = "...")]` around lines 21-29 and instantiated in `execute_distribution` around lines 196-197. Add a `SoroswapRouterClient` (or the equivalent for whichever verified venue is chosen) the same way.
- Currency preference: a small enum (`Usdc | Eurc`) keyed by holder address. Store it via the existing `Storage` module pattern (see `storage.rs`) rather than inventing a second storage convention. Default to `Usdc` for any holder without an explicit preference, so existing holders are unaffected.
- `execute_distribution`'s existing loop over the token contract's holder set (reading balances via `IncomeTokenClient`) is the natural place to branch: USDC-preference holders keep the current direct transfer; EURC-preference holders route their pro-rata share through the swap call first.
- Price guard: accept a `min_eurc_out` style bound per swap (either a fixed on-chain slippage tolerance set at contract init, admin-updatable, or supplied by the two signers at `execute_distribution` call time - pick one and document why in the PR, since this is a real design choice affecting who can move the price and who is protected).
- Failure isolation: wrap the per-holder swap-and-transfer in a way that a failure for holder N does not abort the whole loop for holders N+1..k. Soroban's `try_invoke` / catching a failed sub-invocation (rather than unwrapping) is the mechanism; confirm the current codebase's typed-error pattern (see `errors.rs`) extends cleanly to a new `SwapFailed` or `SlippageExceeded` variant.
- Verify Soroswap's actual deployed, audited contract before wiring it in - primary source (their GitHub repo and mainnet/testnet contract IDs), not marketing claims, per this project's own verification discipline (`docs/strategy/integration-decisions.md` is the template for how that verification gets documented).

**Suggested execution**

1. `git checkout -b feature/pilot-payout-split-eurc-swap`
2. Read `apps/contracts/contracts/pilot-payout-split/src/lib.rs` in full, focusing on `execute_distribution`, `eurc_swap_path_status`, and the existing `IncomeTokenClient`/`WhitelistClient` cross-contract pattern.
3. Verify Soroswap's testnet router contract ID and interface (or the chosen alternative), and add the verification writeup to `docs/strategy/decision-log.md`.
4. Add the currency-preference storage key and a `set_currency_preference(holder: Address, currency: Currency)` public function, `require_auth`-gated to `holder`, rejecting non-approved addresses via the existing `WhitelistClient` check already used elsewhere in this file.
5. Implement the swap-and-transfer branch inside `execute_distribution`, with the price guard and failure isolation described above.
6. Remove or repurpose `eurc_swap_path_status()`.
7. Extend the existing `#[cfg(test)] mod tests` block: a happy-path mixed-currency distribution test, a price-guard-rejection test, a failure-isolation test, and a preference-authorization test (non-holder or unapproved address cannot set a preference).
8. Update `docs/deployment/deploy-pilot-contracts.md` if the router contract address becomes a new constructor/init parameter.

**Test and commit**

- [ ] All unit tests pass (`cargo test`)
- [ ] New swap logic has explicit test coverage for the happy path, the price-guard rejection path, and the failure-isolation path
- [ ] `stellar contract build` succeeds (target `wasm32v1-none`)
- [ ] `cargo clippy -- -D warnings` clean
- [ ] Invocation budget for `execute_distribution` with a mixed-currency holder set is measured and documented in the PR description (the swap leg adds real cost)
- [ ] `docs/strategy/decision-log.md` gains an entry recording the swap-venue verification

Example commit:
`git commit -m "feat(contracts): implement usdc-to-eurc swap path in pilot payout-split"`

**Guidelines**

- Do not build a bespoke AMM or pricing curve. If no already-verified, deployed Stellar swap venue turns out to be usable from within a Soroban contract call, stop and flag that constraint rather than shipping custom swap math - that is a real architectural finding worth surfacing, not something to work around silently.
- Never hardcode a router contract address; read it from contract storage, set at initialization, consistent with how `income_token` and `whitelist` addresses are already handled.
- The price guard must be a hard on-chain check, not a client-side-only convention.
