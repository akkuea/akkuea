# Recommendations

Independent analysis layered on top of the decisions in `product-brief.md`, `roadmap.md`, `integration-decisions.md`, and `decision-log.md`. These are suggestions, not adopted decisions - nothing here overrides the pilot's scope discipline unless and until it's folded into the documents above.

---

## 1. DeFindex over a custom yield module: agree, and go further

The call to use DeFindex instead of building a proprietary DeFi mechanism is correct, and the reasoning already in [`integration-decisions.md`](integration-decisions.md) holds: it's OtterSec-audited, already deployed on mainnet, and turns an idle fee balance into real, checkable on-chain activity with zero new attack surface. Building an equivalent yield mechanism in-house would mean absorbing audit cost and attack surface for a problem DeFindex has already solved - for the treasury use case specifically, there is no real counter-argument.

Two refinements worth adopting:

- **Treat the Phase 1a treasury deposit as a live credibility asset, not just internal plumbing.** Once the platform fee is sitting in DeFindex's Blend strategy, that's a real, stellar.expert-verifiable transaction history before a single pilot ally is signed. Surface it - a one-line "treasury reserve, audited via DeFindex" note with a link to the contract on stellar.expert belongs in any pitch deck, grant application, or investor-facing material from day one. This costs nothing beyond what Phase 1a already produces.
- **Don't let "DeFindex is a good fit for treasury" quietly become "DeFindex will eventually be a good fit for the core payout engine" without re-verifying.** The roadmap correctly defers the custom strategy-module work to Phase 2, gated on real payout history existing first. Worth keeping explicit: the treasury decision and the future token-liquidity decision are two separate DeFindex questions with two separate answers, and the second one still needs its own verification pass against whatever DeFindex's `core` trait looks like by the time Phase 2 starts (it may have changed).

---

## 2. Turn already-built features into pilot differentiators instead of parking them

The existing platform build (predating this pilot's scoping) contains two pieces of real, working technology that most rental-income-tokenization competitors don't have, and that fit the pilot's actual trust problem - the yield-evidence gap flagged as the central risk in `product-brief.md`.

### 2a. 3D property capture as investor-facing evidence, not just a listing feature

`docs/guides/property-3d-capture.md` documents a real, already-built Gaussian Splatting property viewer. As written, it's framed purely as a marketing nicety ("investors can virtually walk through your property"). Reframed for the pilot: it's a second, independent evidence channel alongside the hashed income statement - an investor can see the actual property generating the income they're being paid from, not just a document asserting it exists. This directly strengthens the "verifiable/auditable, not trustless" positioning that's already the pilot's core credibility argument. Low cost to include: the feature exists, it just needs to be pointed at the pilot ally's actual property once one is signed.

### 2b. Akkuea Land as an acquisition funnel, not only an internal teaching tool

The decision to keep `apps/akkuea-land` as an educational companion is right. Consider one extension: let it double as a public top-of-funnel. Someone who plays the game, understands the buy-property → earn-income → claim-income loop, and wants to see it work with real money is a warmer investor lead than someone reading a brief cold. A simple "this is a simulation - see the real pilot" call-to-action inside the game, linked to a waitlist or the ally-facing one-pager once it exists, costs a small UI addition against an app that's already built and live on testnet.

**Scope caution on both 2a and 2b:** neither should become a pre-pilot engineering project. Both are "point an existing, working feature at the pilot" moves, not new builds - consistent with the deliberate under-scoping this whole strategy is built on. If either starts requiring new contract work or a new backend, that's scope creep and should be re-evaluated against the pilot's actual timeline.

---

## 3. Close the single-admin-key gap before, not after, the first real payout

`product-brief.md` already flags this as Known Risk #7: fund-release approval is currently a single admin key with no second-party check. The brief proposes a two-signer model (operator + ally) as a cheap native addition using Soroban's own multi-sig auth. Recommendation: treat this as a testnet-track deliverable, not a mainnet-track nice-to-have. It's cheap specifically because it's native Soroban auth rather than an external service - there's no integration cost that would justify waiting. Shipping the pilot's first real mainnet payout on a single key when the fix is already scoped and low-cost is a credibility risk with exactly the kind of skeptical ally or investor this pilot is trying to convince.

---

## 4. Use the existing accessibility work as a pitch asset with institutional allies

`docs/a11y-checklist.md` documents real, already-completed accessibility work on the existing platform's marketplace and lending flows (focus trapping, keyboard navigation, screen-reader labeling, contrast). Property managers and real estate agencies - the pilot's target ally - are often more compliance-conscious than typical crypto counterparties and may specifically ask about accessibility, especially if any public or institutional capital is involved downstream. This is a "we already did the work" answer available at zero additional cost; worth a one-line mention in ally-facing pitch materials once Bri's jargon-free one-pager exists.

---

## See also

- [`product-brief.md`](product-brief.md)
- [`roadmap.md`](roadmap.md)
- [`integration-decisions.md`](integration-decisions.md)
- [`decision-log.md`](decision-log.md)
