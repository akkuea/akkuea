# Decision Log

Chronological record of how the pilot strategy in this folder was arrived at. Condensed from the working brief's full decision log; kept for anyone who needs the reasoning behind a decision, not just the decision itself.

## Business model

- **Rejected:** vertically-integrated agency (running real estate operations directly). Reason: limited available team time; running an agency is a full-time operational commitment independent of the tech build.
- **Rejected for this phase:** multi-tenant platform from day one. Building for N future agencies before validating one is premature platformization.
- **Adopted:** B2B tokenization-as-a-service, single-ally revenue-share pilot. Keeps the team in the infrastructure/technology role, delegates real estate operations to an existing operator, validates demand with one relationship before any platform investment.

## What gets tokenized

**Rental-income / revenue-participation right, not equity or title.** Lighter legal/securities exposure than fractional property ownership; a debt-like instrument rather than an ownership stake. (Legal classification still not fully settled - see Known Risk #2 in `product-brief.md`.)

## Core product decisions (resolved 2026-08-14, cross-validated across independent review angles)

- **Token is non-transferable in this phase.** One decision that simultaneously resolves three independent findings: an undefined product decision (transferability), an unresolved architecture problem (holder-snapshot logic only exists if the token is transferable), and the single biggest time sink identified in the contract build. Secondary market deferred to post-pilot.
- **Evidence reference = link + hash (string) written on-chain, no file-storage pipeline.** The cheapest correct answer to "where does evidence live" and "is 'auditable' real or just marketing" - this is what makes the auditability claim true in the shipped product, not just in this document.
- **Investor custody is self-custody via wallet** (Freighter / Stellar Wallets Kit). No custodial layer built.
- **Investor dashboard is read-only over on-chain events/RPC.** No accounts, no database. Reduces "the dashboard is secretly a full-stack app" risk while still supporting per-cycle status visibility (on-time / late / disputed / ally-gone-dark) as read-only flags derived from the same on-chain state.
- **KYC/whitelist: minimum defensible, not a compliance product.** Manual human review plus a simple on-chain approved/not-approved contract. Explicitly not a general-purpose compliance engine before validating one ally.

## Deal economics

**Adopted: 10% of each distributed income cycle**, taken by the payout-split contract before the remaining 90% is distributed pro-rata to token holders.

Reasoning: comparable real-estate income/crowdfunding structures typically take 10–15% of distributed income (or a smaller ongoing AUM-style fee). 10% sits at the accessible end of that range, is transparent (visible on-chain every cycle rather than negotiated privately), is trivial to implement (a fee line ahead of the existing pro-rata split), and is sized to actually cover real operating costs - infrastructure and the recurring monthly evidence-review time already flagged as a bottleneck.

## Two-track phasing

- **Testnet / mainnet split** (within Phase 1): isolates product-logic risk from integration and real-money risk. Lets the team build and validate cheaply before taking on integration and real-money complexity.
- **Phase 1a / Phase 1b split** (Phase 1 internal structure, added later): Phase 1a (treasury: DeFindex + EtherFuse, fast, parallel) and Phase 1b (the core pilot, unchanged scope) run **in parallel**, not sequentially. Phase 1a does not block or compress Phase 1b's timeline.
- **Phase 1 / Phase 2 split** (product scope over time, distinct from the above): Phase 1 stays informal and Stellar-native; Phase 2 is where jurisdiction formalization, transferability, multi-tenancy, and oracle automation get built - only after Phase 1 validates.

## Integration decisions

See [`integration-decisions.md`](integration-decisions.md) for the full verification matrix (Trustless Work dropped, DeFindex adopted for treasury / deferred for the token yield layer, EtherFuse reclassified as a treasury instrument, Spydra discarded).

**Trustless Work was dropped from the core pilot entirely**, correcting the original 2026-08-12 "integrate day one" recommendation, which was based on the existence and name of a repo rather than its actual contents. When directly asked "do we actually need this," reading the README in full showed a bilateral single-recipient escrow that doesn't fit pro-rata distribution to N holders, requires its own hosted backend, and stacks its own fee on top of Akkuea's. Replaced by Akkuea's own payout-split contract.

## Jurisdiction

**Resolved by sequencing, not by picking one option outright.** Brazil + an existing CVM-authorized platform is the target regulatory path, pursued explicitly as Phase 2 - not a Phase 1 prerequisite. Negotiating a distribution partnership with a regulated platform is itself a slow BD process that could strand the already-verified Stellar-native architecture if required before the pilot can launch. Full research findings (Brazil, Marshall Islands, El Salvador ruled out as heavy-touch, Mexico ruled out as unfavorable) are in [`roadmap.md`](roadmap.md).

## Naming

Project renamed from the working title "Pili" to **Akkuea** (spelled letter-by-letter: A-K-K-U-E-A, double K) partway through this strategy's development.

## Documentation standard

All downstream artifacts (architecture docs, API references, UX specs, pitch materials) are held to a professional bar: clearly structured, precisely defined, illustrated with proper diagrams rather than prose-only descriptions. A standing requirement, not a one-time pass - see `product-brief.md`.

---

## See also

- [`product-brief.md`](product-brief.md)
- [`roadmap.md`](roadmap.md)
- [`integration-decisions.md`](integration-decisions.md)
