# C6-003: Integrate the Phase 1a Treasury Track (DeFindex + EtherFuse)

## Issue Metadata

| Attribute       | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Issue ID        | C6-003                                                             |
| Area            | API                                                                |
| Difficulty      | High                                                               |
| Labels          | backend, soroban, high                                             |
| Dependencies    | None                                                               |
| Estimated Lines | 4000-5000 (service layer, integration tests, API routes, panel UI) |

**Description**

Implement `TreasuryService`, wiring real deposits and position reads against DeFindex's Blend strategy and EtherFuse's Stablebonds, plus the API surface and a UI panel to make the resulting on-chain activity visible.

**Requirements and context**

- New service: `apps/api/src/services/TreasuryService.ts`, following the existing `StellarService.ts` pattern for how contract calls are built, signed, and submitted.
- DeFindex integration: deposit into the `Blend` strategy of `defindex-io/stellar-contracts` (verify current contract addresses directly from their repo or deployment records, per this project's standing verify-before-integrating rule; do not assume an address from memory or an outdated source).
- EtherFuse integration: acquire Stablebonds (CETES or another EtherFuse-issued asset) as a classic Stellar asset via SDEX, consistent with how EtherFuse assets are documented as trading in `docs/strategy/roadmap.md`.
- New endpoints: `GET /internal/operations/treasury` (position summary, admin-gated like the existing `/internal/operations/properties` pattern), `POST /internal/operations/treasury/deposit` (admin-gated, triggers a deposit).
- New panel component in `apps/webapp` (place under `components/treasury/`, or under `components/pilot/` if C6-002 has already established that directory structure).

**Suggested execution**

1. `git checkout -b feature/treasury-defindex-etherfuse-integration`
2. Verify DeFindex's current mainnet/testnet contract addresses and interface directly from `defindex-io/stellar-contracts`, not from this issue's description (addresses can change).
3. Verify EtherFuse's current Stablebond asset issuers and trading path directly from their published documentation or stellar.expert, following the same verification standard.
4. Implement the deposit and position-read paths in `TreasuryService`, one integration at a time, with integration tests against each before moving to the next.
5. Add the two admin-gated API routes.
6. Build the treasury panel UI, reusing `FreshnessIndicator` for position data and linking out to stellar.expert for the underlying contract.

**Test and commit**

- [ ] Integration tests exercise the actual DeFindex and EtherFuse contract call paths (real testnet or mainnet contracts, not mocks)
- [ ] Unit tests cover TreasuryService's error handling for each documented external failure mode
- [ ] API routes return correct status codes and are admin-gated the same way existing `/internal/operations/*` routes are
- [ ] Treasury panel renders real position data and correctly links to stellar.expert
- [ ] Soroban interaction errors are mapped to appropriate HTTP status codes, consistent with the existing error-mapping convention in `apps/api/src/errors/`

Example commit:
`git commit -m "feat(api): integrate DeFindex Blend and EtherFuse Stablebonds treasury deposits"`

**Guidelines**

- Never commit secrets, private keys, or hardcoded credentials.
- Use the existing service-layer patterns already established for `defi-rwa` interactions in `StellarService.ts`.
- All new endpoints must have OpenAPI documentation, consistent with the rest of the API.
- Keep controller methods short and focused; push contract-interaction complexity into the service layer.
