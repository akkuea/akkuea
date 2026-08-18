# Integration Decisions

Standing rule for this project: every third-party integration is verified via primary sources - GitHub repository contents and READMEs, not marketing sites - before being adopted or discarded. Several marketing sites for ecosystem projects are JS-heavy SPAs that don't yield reliable claims via automated fetching, which is itself a reason not to trust them as evidence. SCF (Stellar Community Fund) grant history is explicitly **not** treated as evidence of an actual Stellar integration - see Spydra below.

---

## Verification matrix

| Project            | Verified status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Verdict                                                                                                                                                                                               | Evidence                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Trustless Work** | Real, Stellar-native, audited escrow product exists. **Correction (2026-08-14):** the original "integrate day one" verdict was based only on the existence and name of `trustlesswork-agency-escrow-template`, not its actual contents. The README shows it's a bilateral, single-milestone, single-recipient escrow (one client funds one agency, one release) - explicitly excludes multi-recipient/partial releases in its own stated MVP scope - requires its own hosted API/backend, and charges its own platform fee on top of Akkuea's. Does not fit pro-rata distribution to N whitelisted holders. | **Dropped from the pilot entirely.** Akkuea's own payout-split contract handles distribution instead, gated by manual approval (extensible to a native two-signer check, no external service needed). | `Trustless-Work/trustlesswork-agency-escrow-template` README + full repo contents |
| **DeFindex**       | Real, audited (OtterSec), mainnet-deployed. Now `defindex-io/stellar-contracts` (formerly `paltalabs/defindex`, archived and migrated). `/strategies` only contains pre-built on-chain DeFi strategies (`blend`, `soroswap`, `hodl`, `xycloans`, `fixed_apr`, `core`, `external_wasms`, `unsafe_hodl`) - no path for a custom off-chain real-estate-yield strategy without building a new strategy module against their `core` trait.                                                                                                                                                                       | **Adopted for Phase 1a treasury** (Blend strategy, already-audited, no new code needed). **Deferred to Phase 2** for the income-token liquidity layer, which needs a custom strategy module.          | GitHub repo contents + README, both orgs                                          |
| **EtherFuse**      | Verified real and genuinely Stellar-compatible - shipped 2025, active on-chain trading, SDF-backed seed investor, Anchorage Digital custody (June 2026). Issues tokenized sovereign bonds (Stablebonds - CETES, US Treasuries), not a tokenization SDK for third parties.                                                                                                                                                                                                                                                                                                                                   | **Adopted for Phase 1a/Phase 2 as a treasury/yield instrument** for idle platform funds, alongside DeFindex - not a replacement for Akkuea's own payout-split/whitelist contracts.                    | stellar.expert on-chain data, stellar.org / Anchorage press coverage              |
| **Spydra**         | Received real SCF funding (round 31, $132,000, confirmed in LumenLoop catalog). GitHub/website verification shows their actual tokenization product runs on **Hyperledger Fabric** with bridges to Polygon/Ethereum/Tether - no Stellar deployment found.                                                                                                                                                                                                                                                                                                                                                   | **Discarded entirely.** SCF funding is not evidence of an actual Stellar integration - a standing lesson applied to every other project on this list.                                                 | LumenLoop catalog record + GitHub/website check                                   |

---

## Why DeFindex over building a custom yield module now

This is the specific comparison the founder raised directly: integrating an already-audited DeFi index/vault layer versus building a proprietary yield mechanism in-house.

**DeFindex wins on the treasury use case (Phase 1a), unconditionally:**

- Already audited by OtterSec - Akkuea inherits that audit rather than paying for one on brand-new code.
- Already deployed on mainnet - zero new contract code, zero new attack surface.
- The `Blend` strategy is a known, real yield source, not a black box.
- Turns idle platform-fee balance into visible, checkable on-chain activity almost immediately - directly useful for both operator confidence and any future investor/grant conversation.

**DeFindex does _not_ fit the core tokenization/payout engine (Phase 1b), and that's fine:**

- Its strategies are pre-built on-chain DeFi yield sources (lending markets, AMMs). The pilot's actual yield source is **off-chain rental income**, verified by human review of bank statements - there is no DeFindex strategy for that, and building one against their `core` trait is real, non-trivial engineering.
- Forcing the pilot's payout logic through a DeFindex strategy wrapper it wasn't designed for would trade a small amount of saved effort now for a worse fit and a dependency on someone else's upgrade cadence.

The resolution already reflects this: DeFindex is adopted immediately for treasury (where it's a clean fit) and deferred to Phase 2 for the income-token yield layer (where it isn't a fit yet, but could become one once there's a custom strategy module and real payout history to build against). This is the same discipline applied to every entry in the matrix above - verify the actual fit before adopting, and build custom only where nothing off-the-shelf actually matches the shape of the problem.

---

## See also

- [`product-brief.md`](product-brief.md)
- [`roadmap.md`](roadmap.md)
- [`recommendations.md`](recommendations.md) - independent follow-on analysis
