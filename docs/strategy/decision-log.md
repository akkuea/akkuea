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

## Soroswap swap-venue verification (C7-001, EURC settlement)

**Adopted:** Soroswap AMM router as the on-chain swap venue for USDC-to-EURC conversion in the pilot payout-split contract.

**What was verified (primary sources, not marketing claims):**

1. **Repository:** `github.com/soroswap/core` (Apache-2.0 license, 1,332 commits, 21 stars). The `contracts/router` crate exposes `swap_exact_tokens_for_tokens`, the single-hop exact-input function Akkuea's payout contract calls. The function signature matches the `SoroswapRouterClient` trait declared in `pilot-payout-split/src/lib.rs`.
2. **Deployed contract IDs (read from `public/mainnet.contracts.json` and `public/testnet.contracts.json` in the Soroswap repo):**
   - Testnet Router: `CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD`
   - Mainnet Router: `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`
3. **Audit:** OtterSec, dated 2024-02-22, available at `github.com/soroswap/core/blob/main/audits/2024-02-22_soroswap_ottersec_audit.pdf`. The audit covers the Router, Factory, and Pair contracts.
4. **Fee model:** Constant-product with a 0.3% fee (997/1000 numerator), consistent with the fee math in the `MockSoroswapRouter` test double. The mock's `get_amount_out` formula (`(in*997*out_reserve) / (in_reserve*1000 + in*997)`) matches the Soroswap library implementation.
5. **Integration pattern:** The payout contract pulls `path[0]` (USDC) from its own address and receives `path[1]` (EURC) back, matching the router's `to` address semantics. This is the same pull-from-caller pattern used by every Soroswap SDK consumer.

**Why Soroswap over alternatives:**
- Soroswap is the most widely deployed and audited Soroban AMM on Stellar. The router is already used by the Soroswap aggregator, which routes across Soroswap, Phoenix, Aquarius, and Stellar DEX.
- Building a bespoke swap mechanism is explicitly ruled out by this project's own principle of verifying before integrating and never building from scratch what already exists and is audited.
- The contract interface is simple (single-hop exact-input swap) and maps cleanly to the payout contract's settlement needs.

**Not hardcoded:** The router address is stored in contract storage at initialization (like `income_token` and `whitelist`), never hardcoded. This allows upgrading the venue without redeploying the payout contract.

## Exit-state reason representation (C7-002, ally/property exit)

**Adopted: free-text string stored on-chain** for the exit reason on `pilot-payout-split` (`exit`) and the mirrored `pilot-income-token` marker (`mark_wound_down`), recorded as `ExitRecord { reason: String, at: u64 }` / `WoundDownRecord { reason: String, at: u64 }`.

**Why a string rather than a bounded enum:** real-world exit causes cannot be enumerated up front (ally bankruptcy, property sale, regulatory pressure, mutual agreement, operational failure, and combinations). An enum would force the dashboard to misclassify or carry an `Other` catch-all anyway, and adding a variant later requires a contract upgrade. The string is renderable directly from on-chain state, which is exactly what the issue requires ("render why and when the exit happened without any off-chain state").

**Why a string rather than a hash-plus-off-chain-link:** the evidence records in this same contract deliberately use a link-plus-hash pattern because evidence is a large artifact that belongs off-chain. An exit reason is a short human fact; linking it off-chain would re-introduce the off-chain dependency the issue explicitly rules out for this feature and would make the terminal state unreadable to a client that only reads the chain.

**Why the mirrored `pilot-income-token` marker is a separate admin-gated write rather than auto-propagated from `pilot-payout-split`'s `exit`:** the issue requires `exit` to be gated by exactly the same two-signer authorization as `execute_distribution` (operator + ally). Auto-propagating the marker would force one of two bad options: (a) require the income-token admin (a third key) to co-sign every exit, silently widening the documented two-signer gate, or (b) make the token trust the payout-split contract as a configured authority, adding a deployment-order coupling where a misconfigured authority strands exit entirely. Keeping the two writes independent means each contract's terminal state is set by the party that owns that contract's keys (operator + ally for the payout-split exit, the token admin for the wind-down marker), and both states remain independently readable with no cross-contract call at read time. The dashboard/operator tooling issues both calls when ending a pilot; a later cycle can add an orchestration contract if atomicity is ever required.

## Jurisdiction

**Resolved by sequencing, not by picking one option outright.** Brazil + an existing CVM-authorized platform is the target regulatory path, pursued explicitly as Phase 2 - not a Phase 1 prerequisite. Negotiating a distribution partnership with a regulated platform is itself a slow BD process that could strand the already-verified Stellar-native architecture if required before the pilot can launch. Full research findings (Brazil, Marshall Islands, El Salvador ruled out as heavy-touch, Mexico ruled out as unfavorable) are in [`roadmap.md`](roadmap.md).

## Pilot contract admin safety and recoverability (C8-003)

Addresses two open risks recorded elsewhere in this folder: Known Risk #7 in
`product-brief.md` (single admin key, no second-party check) and Known Risk
#5 (exit mechanism, fund recovery, undefined).

### Two-step admin transfer, gated by the admin alone

**Adopted:** `transfer_admin_start` / `transfer_admin_accept` /
`transfer_admin_cancel` added to `pilot-income-token`, `pilot-whitelist`, and
`pilot-payout-split`, carrying over the pattern already built for `defi-rwa`
(`access/admin.rs`, documented in `docs/operations/runbook-role-management.md`).
The current admin starts a transfer, the named new admin accepts it with
their own signature, and the current admin can cancel any time before
acceptance. The old admin loses every privilege the instant `transfer_admin_accept`
succeeds, because `require_admin` on all three contracts compares against a
single stored admin address that the accept call overwrites.

**Adopted: admin transfer on `pilot-payout-split` is gated by the admin
alone, not by the operator+ally two-signer model.** The issue asked us to
decide this explicitly, since `record_evidence`, `execute_distribution`, and
`exit` already require both signers.

Reasoning: the admin role is Akkuea's own platform key, used for `pause`,
`mint_fixed_supply` correction transfers, and now admin succession. It is a
different role from `operator` (Akkuea's pilot operations signer) and `ally`
(the real estate agency), which jointly gate the business-level actions that
move or approve money. Requiring the ally's co-signature on an admin-key
rotation would give a counterparty, who has no custody of the admin key and
no operational stake in Akkuea's internal key management, veto power over
Akkuea's ability to recover from a lost or compromised admin key. That is the
exact failure mode this feature exists to close: if the admin key is
compromised at the same moment the ally is unreachable, uncooperative, or
itself compromised, a two-signer admin-transfer requirement would strand the
contract instead of recovering it. Keeping admin transfer to a single-role,
two-step flow (current admin starts and can cancel, only the named new admin
can accept) already prevents the two failure modes the issue is worried
about: an attacker with one key cannot transfer admin without also
controlling the new-admin key to accept, and a mistake by the current admin
is reversible via `transfer_admin_cancel` until accepted. Widening the gate
to the ally would trade a recoverability fix for a new outage mode without
closing any additional attack the two-step design does not already close.

The same reasoning applies to `pilot-income-token` and `pilot-whitelist`,
which have no operator/ally concept at all: their only two parties are the
admin and the investors they administer, so a single-role transfer is the
only structure available.

### Pause parity across all three pilot contracts

**Adopted:** `pause` / `unpause` / `is_paused` added to `pilot-income-token`
and `pilot-whitelist`, matching the reversible, admin-gated pattern already
shipped on `pilot-payout-split`. `mint_fixed_supply`, `transfer`, and
`mark_wound_down` reject with `IncomeTokenError::ContractPaused` while
paused; `approve` and `revoke` reject with `WhitelistError::ContractPaused`.
Every read-only function on both contracts (`balance`, `name`, `symbol`,
`decimals`, `total_supply`, `holders`, `admin`, `wound_down_status`,
`is_approved`) keeps working while paused, so an investor dashboard stays
readable during an incident.

`mark_wound_down` is deliberately included in the paused set, even though it
is a terminal, one-way action: pausing exists to stop every state-changing
effect while an incident is under review, and ending the pilot is a decision
the admin can still make immediately after an explicit `unpause`. `pause`,
`unpause`, and the admin-transfer functions are deliberately **not** blocked
by pause on any of the three contracts, matching `defi-rwa`'s
`AdminControl`/`PauseControl` split and `pilot-payout-split`'s existing
`pause`/`unpause`: the whole point of these functions is to remain usable
for recovery while the contract is paused.

This is the pilot's own simple, immediately-reversible pause, not `defi-rwa`'s
24-hour-timelocked `emergency_pause`. The pilot has no equivalent timelock;
see `docs/operations/runbook-pilot-emergency-pause.md`.

### Upgrade decision: deliberate immutability, not a WASM-upgrade entry point

**Adopted: the three pilot contracts remain immutable.** No upgrade entry
point was added. Instead, a documented, once-rehearsed migration-and-recovery
procedure is recorded in `docs/operations/runbook-pilot-contract-migration.md`.

**What was considered:** a WASM-upgrade entry point gated by a two-signer
rule (for example, admin plus operator, or admin plus a second held key),
calling `env.deployer().update_current_contract_wasm(new_wasm_hash)`, with
tests proving a single signer cannot upgrade.

**Why immutability instead, for this first pass:**

1. **Proportionality.** This issue's other four items (admin succession on
   three contracts, pause parity on two, client regeneration, and pilot
   runbooks) are already a large, security-sensitive change. A correct
   upgradeable-contract mechanism is not a small addition on top: it needs
   its own signer-quorum storage, its own tests proving a single signer
   cannot invoke it, and its own audit attention, on contracts that will hold
   real investor funds once the pilot goes live. Adding it now would roughly
   double the audit surface of this change for a benefit (fixing a future bug
   in place) that immutability's migration path also achieves, just with an
   explicit, deliberate step instead of a silent one.
2. **Threat model fit.** An upgradeable entry point turns "the admin key is
   compromised" (already the risk this issue is closing with two-step
   transfer) into "the admin key is compromised and the attacker can replace
   the entire contract's logic," which is a strictly worse outcome than
   today's already-bad single-key risk. A two-signer upgrade gate mitigates
   this, but only if the second key is genuinely independent and
   consistently available, which does not exist yet for a single-ally pilot
   with a two-person operator/ally structure that is itself new. Immutability
   removes this escalation path entirely: a compromised admin key can pause,
   mint-correct, or attempt (and fail, per `SignerCollision` and the
   whitelist gate) to move funds, but it can never change what the contract's
   code does.
3. **No existing precedent to build on safely.** Neither `defi-rwa` nor any
   other contract in this repository implements a WASM upgrade path today
   (verified by reading `defi-rwa/src/lib.rs` and its `access/` module in
   full: no `update_current_contract_wasm` call anywhere in the codebase).
   Building the pilot's first upgrade mechanism from scratch, under this
   issue's time budget, on the contracts closest to real money, is exactly
   the situation this project's own principle of verifying before building
   and not inventing novel security-critical mechanisms under time pressure
   argues against.
4. **Small, known state.** The pilot caps distribution at `MAX_HOLDERS = 10`
   and is scoped to a single ally and a single property for this phase (see
   `product-brief.md`). A full state migration (redeploy, re-approve the
   whitelist, re-mint the exact same holder balances via `mint_fixed_supply`,
   re-initialize `pilot-payout-split` pointed at the new contracts) is a
   bounded, auditable, one-afternoon operation at this scale. That
   calculation changes if the pilot later scales to many allies or a much
   larger holder set, at which point this decision should be revisited.

**What immutability requires in exchange, and what has and has not been
done:** an unrehearsed migration procedure is worse than no procedure at
all, because the first time anyone runs it would be during a real incident.
`docs/operations/runbook-pilot-contract-migration.md` was written to the
same command-by-command precision as the deployment guide, using only
functions that exist on the three contracts today (verified against
`pilot-whitelist/src/lib.rs`, `pilot-income-token/src/lib.rs`, and
`pilot-payout-split/src/lib.rs` directly, not from memory). **It has not yet
been executed on testnet.** This PR does not include transaction hashes from
a live rehearsal, because the environment this change was built in has no
funded Stellar testnet operator or admin key and no path to acquire one. The
runbook is marked accordingly and needs a funded key holder to actually run
it and record the resulting transaction hashes before it can be considered
verified rather than merely written.

## Naming

Project renamed from the working title "Pili" to **Akkuea** (spelled letter-by-letter: A-K-K-U-E-A, double K) partway through this strategy's development.

## Documentation standard

All downstream artifacts (architecture docs, API references, UX specs, pitch materials) are held to a professional bar: clearly structured, precisely defined, illustrated with proper diagrams rather than prose-only descriptions. A standing requirement, not a one-time pass - see `product-brief.md`.

---

## See also

- [`product-brief.md`](product-brief.md)
- [`roadmap.md`](roadmap.md)
- [`integration-decisions.md`](integration-decisions.md)
