# C7-004: Generate Typed Soroban TypeScript Client Bindings for the Pilot Contract Suite

## Issue Metadata

| Attribute       | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Issue ID        | C7-004                                                      |
| Area            | SHARED                                                      |
| Difficulty      | High                                                        |
| Labels          | shared, typescript, dx, high                                |
| Dependencies    | C6-001                                                      |
| Estimated Lines | 400-600 (mostly generated code, plus wrapper/scripts/tests) |

**Description**

Close the typed-client gap between the pilot contract suite and every other contract system in this repository by generating and integrating TypeScript bindings for `pilot-income-token`, `pilot-whitelist`, and `pilot-payout-split` in `@akkuea/shared`.

**Requirements and context**

- Existing pattern to mirror: `apps/shared/src/contracts/game/generated/engine/{src,dist}`, `.../land-token/`, `.../marketplace/`, `.../property-nft/` - each a self-contained generated package. Inspect one of these (e.g. `property-nft`) to confirm the exact `stellar contract bindings typescript` invocation and output shape used, and replicate it for the three pilot contracts rather than inventing a new structure.
- Contract IDs to bind against are already recorded: `apps/shared/src/contracts.testnet.json` has `PILOT_WHITELIST`, `PILOT_INCOME_TOKEN`, `PILOT_PAYOUT_SPLIT`. Confirm whether `contracts.mainnet.json` needs equivalent placeholder entries (likely not yet, since no mainnet pilot deployment exists - state this explicitly rather than guessing).
- `apps/shared/src/contracts/clientConfig.ts` already provides `resolveSorobanRpcUrl`, `createNodeContractSigner`, and shared `SorobanClientConfig` plumbing used across contract clients in this package - the new pilot clients should consume this existing config layer, not duplicate RPC-URL or signer resolution logic.
- Check `apps/api/src/config/contracts.ts` and `apps/api/src/services/StellarService.ts` (referenced by `WhitelistService.approveRequest`) to understand today's hand-rolled invocation pattern before deciding the wrapper layer's shape - the new bindings should be a strict improvement on what that code already does, not a parallel, incompatible abstraction.

**Suggested execution**

1. `git checkout -b feature/pilot-contract-typescript-bindings`
2. Run `stellar contract bindings typescript` for each of the three pilot contracts against their testnet contract IDs, matching the exact flags/output layout used for the `game/generated` packages.
3. Place output under `apps/shared/src/contracts/pilot/generated/{income-token,whitelist,payout-split}/`.
4. Wire each generated package into `apps/shared`'s build (`package.json`, `tsconfig` references) following the game packages' existing wiring.
5. Add a wrapper module (or export the generated clients directly, per the decision above) and export it from `apps/shared`'s public surface.
6. Add a `bun run` script (e.g. `generate:pilot-bindings`) that re-runs step 2 for all three contracts from a single command, and document it.
7. Write the verification test/transcript described in the acceptance criteria.
8. Update `apps/shared`'s README (or `CONTRIBUTING.md`) with the regeneration instructions.

**Test and commit**

- [ ] `bun run build` succeeds in `apps/shared` with zero TypeScript errors
- [ ] Generated bindings are not hand-edited (diff only shows the generator's actual output plus the wrapper/script/docs)
- [ ] At least one live-read test or documented manual verification against the testnet `is_approved` call
- [ ] Regeneration script exists, is documented, and re-running it produces no unexpected diff
- [ ] `shared-ci.yml` and all other four required CI workflows pass

Example commit:
`git commit -m "feat(shared): generate typed clients for pilot contract suite"`

**Guidelines**

- Do not hand-write a client that reimplements what `stellar contract bindings typescript` already generates correctly; use the tool, don't work around it.
- Keep the migration of existing `apps/api` pilot contract calls to the new clients as an explicitly scoped decision (in-scope or documented fast-follow) - don't leave it silently undone without saying so in the PR.
- Consider bundle-size impact for webapp consumers, consistent with this package's existing guidance for shared-library work.
