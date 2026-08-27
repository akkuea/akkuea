#![no_std]
#![allow(linker_messages)]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, panic_with_error, token, Address, Bytes,
    Env, String, Vec,
};

mod errors;
mod events;
mod storage;

pub use errors::PayoutError;
use storage::{DataKey, Storage};

pub const PLATFORM_FEE_PERCENT: i128 = 10;
pub const PERCENT_DENOMINATOR: i128 = 100;
pub const REQUIRED_EVIDENCE_HASH_BYTES: u32 = 32;

/// Scaling factor for the minimum USDC-to-EURC exchange-rate bound. Both USDC
/// and EURC are 7-decimal Stellar assets, so `min_eurc_per_usdc` of 10_000_000
/// means a 1:1 rate, 9_500_000 means at least 0.95 EURC per USDC, etc.
pub const RATE_DENOMINATOR: i128 = 10_000_000;

/// Validity window for swap invocations, mirroring the deployed Soroswap
/// router's deadline semantics (`DeadlineExpired` when ledger time passes it).
pub const SWAP_DEADLINE_SECS: u64 = 3600;

#[contractclient(name = "IncomeTokenClient")]
pub trait IncomeToken {
    fn balance(env: Env, id: Address) -> i128;
    fn total_supply(env: Env) -> i128;
    fn holders(env: Env) -> Vec<Address>;
}

#[contractclient(name = "WhitelistClient")]
pub trait Whitelist {
    fn is_approved(env: Env, address: Address) -> bool;
}

/// Minimal client surface for the Soroswap AMM router (github.com/soroswap/core,
/// `contracts/router`). Only the single-hop exact-input swap used for settlement
/// is declared. Verification notes live in docs/strategy/decision-log.md.
#[contractclient(name = "SoroswapRouterClient")]
pub trait SoroswapRouter {
    fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128>;
}

/// Settlement currency chosen by a token holder. Absence of a stored
/// preference resolves to `Usdc`, so pre-existing holders are unaffected.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Currency {
    Usdc,
    Eurc,
}

/// On-chain record of one rejected swap leg. Persisted per cycle so a rejected
/// payout is auditable instead of silent; the corresponding USDC stays in this
/// contract, reserved for the affected holder.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapFailureRecord {
    pub holder: Address,
    pub amount_usdc: i128,
    /// `PayoutError` discriminant describing why the leg was rejected.
    pub reason_code: u32,
}

/// Live EURC settlement configuration reported to the dashboard. Replaces the
/// retired hardcoded `"stubbed-fast-follow"` marker.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EurcSwapPathStatus {
    pub swap_router: Address,
    pub usdc_token: Address,
    pub eurc_token: Address,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EvidenceRecord {
    pub cycle_id: String,
    pub evidence_hash: Bytes,
    pub evidence_link: String,
    pub total_income: i128,
    pub recorded_at: u64,
    pub distributed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DistributionSummary {
    pub cycle_id: String,
    pub total_income: i128,
    pub platform_fee: i128,
    pub holder_amount: i128,
    pub holder_count: u32,
    /// Sum of pro-rata shares fully delivered, whether paid in USDC directly
    /// or swapped into EURC. Rejected swap legs are not counted here.
    pub distributed_total: i128,
    pub dust: i128,
    /// EURC actually received across successful swap legs.
    pub eurc_distributed_total: i128,
    /// Number of holders whose EURC swap leg was rejected this cycle.
    pub swaps_failed: u32,
    /// USDC withheld in this contract for holders whose swap legs failed.
    pub undistributed_failed_swaps: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct HolderPayout {
    pub holder: Address,
    pub amount: i128,
}

/// Durable on-chain record of a permanent ally/property exit. Written exactly
/// once by `exit` and never removed: it is the terminal counterpart to the
/// reversible `pause` flag, letting a client distinguish "temporarily paused"
/// from "this pilot is over" without any off-chain state.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ExitRecord {
    /// Free-text reason supplied by the two signing parties. Deliberately a
    /// string rather than an enum or hash-plus-off-chain-link so the dashboard
    /// can render why the exit happened directly from on-chain state (see
    /// docs/strategy/decision-log.md for the recorded rationale).
    pub reason: String,
    /// Ledger timestamp of the `exit` invocation.
    pub at: u64,
}

/// Internal per-holder delivery plan resolved before any funds move.
/// `contracttype` provides the val conversions required by `soroban_sdk::Vec`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct PayoutLeg {
    holder: Address,
    amount: i128,
    currency: Currency,
}

struct ExecutionGuard<'a> {
    env: &'a Env,
}

impl<'a> ExecutionGuard<'a> {
    fn acquire(env: &'a Env) -> Result<Self, PayoutError> {
        let locked: bool = env
            .storage()
            .instance()
            .get(&DataKey::Guard)
            .unwrap_or(false);
        if locked {
            return Err(PayoutError::Reentrancy);
        }
        env.storage().instance().set(&DataKey::Guard, &true);
        Ok(Self { env })
    }
}

impl Drop for ExecutionGuard<'_> {
    fn drop(&mut self) {
        self.env.storage().instance().set(&DataKey::Guard, &false);
    }
}

#[contract]
pub struct PilotPayoutSplit;

#[contractimpl]
impl PilotPayoutSplit {
    /// Initialize payout configuration, including the two required evidence approvers.
    ///
    /// `eurc_token` is the EURC asset contract offered as settlement alternative
    /// and `swap_router` the verified Soroswap AMM router used to convert USDC
    /// shares at payout time. Both are stored, never hardcoded.
    pub fn initialize(
        env: Env,
        admin: Address,
        operator: Address,
        ally: Address,
        platform_fee_recipient: Address,
        income_token: Address,
        whitelist: Address,
        usdc_token: Address,
        eurc_token: Address,
        swap_router: Address,
    ) {
        if Storage::is_initialized(&env) {
            panic_with_error!(&env, PayoutError::AlreadyInitialized);
        }

        if operator == ally {
            panic_with_error!(&env, PayoutError::SignerCollision);
        }

        if eurc_token == usdc_token || swap_router == usdc_token || swap_router == eurc_token {
            panic_with_error!(&env, PayoutError::RouterNotConfigured);
        }

        Storage::set_address(&env, &DataKey::Admin, &admin);
        Storage::set_address(&env, &DataKey::Operator, &operator);
        Storage::set_address(&env, &DataKey::Ally, &ally);
        Storage::set_address(
            &env,
            &DataKey::PlatformFeeRecipient,
            &platform_fee_recipient,
        );
        Storage::set_address(&env, &DataKey::IncomeToken, &income_token);
        Storage::set_address(&env, &DataKey::Whitelist, &whitelist);
        Storage::set_address(&env, &DataKey::UsdcToken, &usdc_token);
        Storage::set_address(&env, &DataKey::EurcToken, &eurc_token);
        Storage::set_address(&env, &DataKey::SwapRouter, &swap_router);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Guard, &false);

        events::emit_initialized(&env, admin, operator, ally);
    }

    /// Record a monthly income evidence reference and approve the distribution amount.
    ///
    /// Both `operator` and `ally` must sign the same invocation through native Soroban auth.
    pub fn record_evidence(
        env: Env,
        operator: Address,
        ally: Address,
        cycle_id: String,
        evidence_hash: Bytes,
        evidence_link: String,
        total_income: i128,
    ) {
        operator.require_auth();
        ally.require_auth();
        Self::require_operator(&env, &operator);
        Self::require_ally(&env, &ally);
        Self::require_not_exited(&env);
        Self::require_not_paused(&env);

        if total_income <= 0 {
            panic_with_error!(&env, PayoutError::ZeroAmount);
        }

        if evidence_hash.len() != REQUIRED_EVIDENCE_HASH_BYTES {
            panic_with_error!(&env, PayoutError::InvalidEvidenceHash);
        }

        if evidence_link.is_empty() {
            panic_with_error!(&env, PayoutError::MissingEvidenceLink);
        }

        if Storage::evidence(&env, &cycle_id).is_some() {
            panic_with_error!(&env, PayoutError::CycleAlreadyRecorded);
        }

        let record = EvidenceRecord {
            cycle_id: cycle_id.clone(),
            evidence_hash,
            evidence_link,
            total_income,
            recorded_at: env.ledger().timestamp(),
            distributed: false,
        };
        Storage::set_evidence(&env, &cycle_id, &record);
        events::emit_evidence_recorded(&env, operator, ally, cycle_id, total_income);
    }

    /// Execute the approved payout for a cycle, honoring each holder's
    /// settlement-currency preference.
    ///
    /// Both signers must authorize the execution because they also carry the
    /// price-guard responsibility: `min_eurc_per_usdc` is the minimum exchange
    /// rate (scaled by `RATE_DENOMINATOR`) at which EURC-preference shares may
    /// be converted. This bound is deliberately supplied per cycle by the same
    /// dual signature that approves `total_income`, rather than being a static
    /// init-time slippage tolerance: without an oracle there is no on-chain
    /// reference rate to apply a tolerance against, and tying the floor to the
    /// accountable signers means only joint operator+ally action can move the
    /// effective price while every EURC-opted holder of that cycle is protected
    /// by the venue-enforced `amount_out_min`. The router rejects the leg before
    /// moving any tokens when the pool cannot satisfy the bound, and this
    /// contract re-verifies the delivered amount defensively afterwards.
    ///
    /// Failure isolation: a rejected swap leg (illiquidity, slippage breach,
    /// venue error) does not abort the distribution. The affected holder's USDC
    /// share stays in this contract, is reported through the returned summary,
    /// recorded on-chain via `get_swap_failures`, and emitted as a typed event;
    /// all other holders are paid normally.
    pub fn execute_distribution(
        env: Env,
        operator: Address,
        ally: Address,
        cycle_id: String,
        min_eurc_per_usdc: i128,
    ) -> DistributionSummary {
        operator.require_auth();
        ally.require_auth();
        Self::require_operator(&env, &operator);
        Self::require_ally(&env, &ally);
        Self::require_not_exited(&env);
        Self::require_not_paused(&env);
        let _guard = ExecutionGuard::acquire(&env).unwrap_or_else(|e| panic_with_error!(&env, e));

        let mut record = Storage::evidence(&env, &cycle_id)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::CycleNotRecorded));

        if record.distributed {
            panic_with_error!(&env, PayoutError::CycleAlreadyDistributed);
        }

        let income_token_address = Storage::address(&env, &DataKey::IncomeToken)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let whitelist_address = Storage::address(&env, &DataKey::Whitelist)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let usdc_token_address = Storage::address(&env, &DataKey::UsdcToken)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let eurc_token_address = Storage::address(&env, &DataKey::EurcToken)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let swap_router_address = Storage::address(&env, &DataKey::SwapRouter)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let platform_fee_recipient = Storage::address(&env, &DataKey::PlatformFeeRecipient)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));

        let income_token = IncomeTokenClient::new(&env, &income_token_address);
        let whitelist = WhitelistClient::new(&env, &whitelist_address);
        let usdc = token::Client::new(&env, &usdc_token_address);
        let holders = income_token.holders();
        let total_supply = income_token.total_supply();

        if holders.is_empty() || total_supply <= 0 {
            panic_with_error!(&env, PayoutError::EmptyHolderSet);
        }

        let platform_fee = record
            .total_income
            .checked_mul(PLATFORM_FEE_PERCENT)
            .and_then(|value| value.checked_div(PERCENT_DENOMINATOR))
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));
        let holder_amount = record
            .total_income
            .checked_sub(platform_fee)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));

        let contract_address = env.current_contract_address();
        let contract_balance = usdc.balance(&contract_address);
        if contract_balance < record.total_income {
            panic_with_error!(&env, PayoutError::InsufficientPayoutBalance);
        }

        let mut legs: Vec<PayoutLeg> = Vec::new(&env);
        let mut any_eurc = false;
        let mut computed_total = 0i128;
        for i in 0..holders.len() {
            let holder = holders
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, PayoutError::InternalInvariant));
            if !whitelist.is_approved(&holder) {
                panic_with_error!(&env, PayoutError::RecipientNotApproved);
            }

            let holder_balance = income_token.balance(&holder);
            if holder_balance <= 0 {
                continue;
            }

            let payout = holder_amount
                .checked_mul(holder_balance)
                .and_then(|value| value.checked_div(total_supply))
                .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));

            if payout > 0 {
                let currency =
                    Storage::currency_preference(&env, &holder).unwrap_or(Currency::Usdc);
                if currency == Currency::Eurc {
                    any_eurc = true;
                }
                computed_total = computed_total
                    .checked_add(payout)
                    .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));
                legs.push_back(PayoutLeg {
                    holder,
                    amount: payout,
                    currency,
                });
            }
        }

        // Price-guard precondition: a cycle that converts any share into EURC
        // must carry a positive minimum-rate bound, validated before any state
        // mutation or token movement.
        if any_eurc && min_eurc_per_usdc <= 0 {
            panic_with_error!(&env, PayoutError::InvalidMinRate);
        }

        let dust = holder_amount
            .checked_sub(computed_total)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));

        record.distributed = true;
        Storage::set_evidence(&env, &cycle_id, &record);

        usdc.transfer(&contract_address, &platform_fee_recipient, &platform_fee);

        let mut distributed_total = 0i128;
        let mut eurc_distributed_total = 0i128;
        let mut swaps_failed = 0u32;
        let mut undistributed_failed_swaps = 0i128;
        for i in 0..legs.len() {
            let leg = legs
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, PayoutError::InternalInvariant));
            match leg.currency {
                Currency::Usdc => {
                    usdc.transfer(&contract_address, &leg.holder, &leg.amount);
                    distributed_total =
                        distributed_total
                            .checked_add(leg.amount)
                            .unwrap_or_else(|| {
                                panic_with_error!(&env, PayoutError::ArithmeticOverflow)
                            });
                }
                Currency::Eurc => {
                    let min_eurc_out = leg
                        .amount
                        .checked_mul(min_eurc_per_usdc)
                        .and_then(|value| value.checked_div(RATE_DENOMINATOR))
                        .unwrap_or_else(|| {
                            panic_with_error!(&env, PayoutError::ArithmeticOverflow)
                        });
                    match Self::run_eurc_swap_leg(
                        &env,
                        &usdc_token_address,
                        &eurc_token_address,
                        &swap_router_address,
                        &leg.holder,
                        leg.amount,
                        min_eurc_out,
                    ) {
                        Ok(amount_eurc_out) => {
                            distributed_total = distributed_total
                                .checked_add(leg.amount)
                                .unwrap_or_else(|| {
                                    panic_with_error!(&env, PayoutError::ArithmeticOverflow)
                                });
                            eurc_distributed_total = eurc_distributed_total
                                .checked_add(amount_eurc_out)
                                .unwrap_or_else(|| {
                                    panic_with_error!(&env, PayoutError::ArithmeticOverflow)
                                });
                            events::emit_swap_executed(
                                &env,
                                cycle_id.clone(),
                                leg.holder.clone(),
                                leg.amount,
                                amount_eurc_out,
                            );
                        }
                        Err(reason_code) => {
                            // Isolated failure: retain this holder's USDC in the
                            // contract, record and emit the rejection, continue
                            // paying everyone else.
                            swaps_failed = swaps_failed.checked_add(1).unwrap_or_else(|| {
                                panic_with_error!(&env, PayoutError::InternalInvariant)
                            });
                            undistributed_failed_swaps = undistributed_failed_swaps
                                .checked_add(leg.amount)
                                .unwrap_or_else(|| {
                                    panic_with_error!(&env, PayoutError::ArithmeticOverflow)
                                });
                            Storage::push_swap_failure(
                                &env,
                                &cycle_id,
                                &SwapFailureRecord {
                                    holder: leg.holder.clone(),
                                    amount_usdc: leg.amount,
                                    reason_code,
                                },
                            );
                            events::emit_swap_failed(
                                &env,
                                cycle_id.clone(),
                                leg.holder.clone(),
                                leg.amount,
                                reason_code,
                            );
                        }
                    }
                }
            }
        }

        let summary = DistributionSummary {
            cycle_id: cycle_id.clone(),
            total_income: record.total_income,
            platform_fee,
            holder_amount,
            holder_count: holders.len(),
            distributed_total,
            dust,
            eurc_distributed_total,
            swaps_failed,
            undistributed_failed_swaps,
        };
        events::emit_distribution_executed(&env, summary.clone());
        summary
    }

    /// Convert one holder's pro-rata USDC share into EURC through the verified
    /// Soroswap router and deliver the proceeds to the holder.
    ///
    /// The router pulls the input from this contract (it transfers `path[0]`
    /// from the `to` address into the pair), enforces `amount_out_min` against
    /// the pool's current price before moving any tokens, sends the output back
    /// to this contract, and this contract forwards it to the holder. Any venue
    /// failure is caught through the generated `try_*` client and mapped onto
    /// the project's typed-error pattern instead of panicking.
    ///
    /// Returns the EURC delivered, or the rejecting `PayoutError` discriminant.
    fn run_eurc_swap_leg(
        env: &Env,
        usdc_token_address: &Address,
        eurc_token_address: &Address,
        swap_router_address: &Address,
        holder: &Address,
        amount_in: i128,
        min_eurc_out: i128,
    ) -> Result<i128, u32> {
        // A floored-to-zero bound would execute without protection; reject
        // rather than silently accept an unguarded conversion.
        if min_eurc_out <= 0 {
            return Err(PayoutError::SlippageExceeded as u32);
        }

        let contract_address = env.current_contract_address();
        // The venue pulls `path[0]` from this contract (`to`), so this contract
        // must authorize the input transfer within its own invocation.
        contract_address.require_auth();
        let deadline = env.ledger().timestamp().saturating_add(SWAP_DEADLINE_SECS);

        let mut path = Vec::new(env);
        path.push_back(usdc_token_address.clone());
        path.push_back(eurc_token_address.clone());

        let router = SoroswapRouterClient::new(env, swap_router_address);
        let attempted = router.try_swap_exact_tokens_for_tokens(
            &amount_in,
            &min_eurc_out,
            &path,
            &contract_address,
            &deadline,
        );

        match attempted {
            // The generated try_* client nests the venue's own result inside
            // the invocation result; any failure layer maps to SwapFailed.
            Ok(Ok(amounts)) => {
                let received = amounts
                    .last()
                    .ok_or(PayoutError::InternalInvariant as u32)?;
                // Defensive re-check: never trust that an external venue enforced
                // our minimum, even though the deployed router does.
                if received < min_eurc_out {
                    return Err(PayoutError::SlippageExceeded as u32);
                }
                let eurc = token::Client::new(env, eurc_token_address);
                eurc.transfer(&contract_address, holder, &received);
                Ok(received)
            }
            _ => Err(PayoutError::SwapFailed as u32),
        }
    }

    /// Set or update the caller's own settlement-currency preference.
    ///
    /// Self-serve: gated by `require_auth` to the holder's own address, and
    /// restricted to addresses approved on the pilot whitelist.
    pub fn set_currency_preference(env: Env, holder: Address, currency: Currency) {
        holder.require_auth();
        Self::require_not_paused(&env);

        let whitelist_address = Storage::address(&env, &DataKey::Whitelist)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let whitelist = WhitelistClient::new(&env, &whitelist_address);
        if !whitelist.is_approved(&holder) {
            panic_with_error!(&env, PayoutError::RecipientNotApproved);
        }

        Storage::set_currency_preference(&env, &holder, &currency);
        events::emit_currency_preference_set(&env, holder, currency);
    }

    /// Return a holder's settlement-currency preference; defaults to USDC.
    pub fn get_currency_preference(env: Env, holder: Address) -> Currency {
        Storage::currency_preference(&env, &holder).unwrap_or(Currency::Usdc)
    }

    /// Return the swap legs rejected during a cycle's distribution.
    pub fn get_swap_failures(env: Env, cycle_id: String) -> Vec<SwapFailureRecord> {
        Storage::swap_failures(&env, &cycle_id)
    }

    /// Pause evidence recording, preference changes, and distribution execution.
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
        events::emit_paused(&env, admin);
    }

    /// Resume evidence recording, preference changes, and distribution execution.
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        events::emit_unpaused(&env, admin);
    }

    /// Return whether the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        Storage::is_paused(&env)
    }

    /// Permanently terminate the ally/property relationship.
    ///
    /// One-way and irreversible: once called, `record_evidence` and
    /// `execute_distribution` reject every subsequent invocation with
    /// `PayoutError::ContractExited`, and no un-exit or reversal function
    /// exists. This is deliberately a separate gate from `pause`/`unpause`:
    /// pause is reversible and operational, exit is terminal and factual, so a
    /// client can always tell "temporarily paused" from "this pilot is over."
    ///
    /// Gated by the same two-signer authorization as
    /// `execute_distribution`: both `operator` and `ally` must authorize the
    /// same invocation, since ending the relationship is at least as
    /// consequential as approving a distribution. The `reason` is stored and
    /// exposed on-chain via `exit_status` so a client can render why and when
    /// the exit happened without any off-chain state.
    ///
    /// This function records the fact of exit only. It does not attempt any
    /// fund-recovery, refund, pro-rata unwind, or legal wind-down logic: what
    /// happens to already-collected or future funds is an open product/legal
    /// question (Known Risk #5 in the product brief) that this contract change
    /// deliberately does not answer.
    pub fn exit(env: Env, operator: Address, ally: Address, reason: String) {
        operator.require_auth();
        ally.require_auth();
        Self::require_operator(&env, &operator);
        Self::require_ally(&env, &ally);
        Self::require_not_exited(&env);

        if reason.is_empty() {
            panic_with_error!(&env, PayoutError::MissingExitReason);
        }

        let record = ExitRecord {
            reason: reason.clone(),
            at: env.ledger().timestamp(),
        };
        Storage::set_exit_record(&env, &record);
        events::emit_exit_recorded(&env, operator, ally, reason, record.at);
    }

    /// Return the terminal exit record, or `None` while the pilot is active.
    ///
    /// Read-only and self-contained: a client needs no cross-contract call and
    /// no off-chain state to distinguish "not exited" (None) from a permanent
    /// exit (the recorded reason and timestamp).
    pub fn exit_status(env: Env) -> Option<ExitRecord> {
        Storage::exit_record(&env)
    }

    /// Return an evidence record for a cycle, if present.
    pub fn get_evidence(env: Env, cycle_id: String) -> Option<EvidenceRecord> {
        Storage::evidence(&env, &cycle_id)
    }

    /// Report the live EURC settlement configuration. Returns `None` before
    /// initialization; after initialization the dashboard reads the actual
    /// router and asset addresses instead of a hardcoded marker string.
    pub fn eurc_swap_path_status(env: Env) -> Option<EurcSwapPathStatus> {
        let swap_router = Storage::address(&env, &DataKey::SwapRouter)?;
        let usdc_token = Storage::address(&env, &DataKey::UsdcToken)?;
        let eurc_token = Storage::address(&env, &DataKey::EurcToken)?;
        Some(EurcSwapPathStatus {
            swap_router,
            usdc_token,
            eurc_token,
        })
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Storage::address(env, &DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::NotInitialized));
        if admin != caller.clone() {
            panic_with_error!(env, PayoutError::Unauthorized);
        }
    }

    fn require_operator(env: &Env, caller: &Address) {
        let operator = Storage::address(env, &DataKey::Operator)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::NotInitialized));
        if operator != caller.clone() {
            panic_with_error!(env, PayoutError::Unauthorized);
        }
    }

    fn require_ally(env: &Env, caller: &Address) {
        let ally = Storage::address(env, &DataKey::Ally)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::NotInitialized));
        if ally != caller.clone() {
            panic_with_error!(env, PayoutError::Unauthorized);
        }
    }

    fn require_not_paused(env: &Env) {
        if Storage::is_paused(env) {
            panic_with_error!(env, PayoutError::ContractPaused);
        }
    }

    fn require_not_exited(env: &Env) {
        if Storage::exit_record(env).is_some() {
            panic_with_error!(env, PayoutError::ContractExited);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    extern crate std;
    use pilot_income_token::{PilotIncomeToken, PilotIncomeTokenClient};
    use pilot_whitelist::{PilotWhitelist, PilotWhitelistClient};
    use soroban_sdk::{
        contracterror,
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        token::StellarAssetClient,
        xdr::ScVal,
        Error, IntoVal, TryFromVal,
    };

    /// Minimum exchange rate used throughout tests: 0.95 EURC per USDC.
    const TEST_MIN_RATE: i128 = 9_500_000;

    #[contracterror]
    #[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
    #[repr(u32)]
    pub enum MockRouterError {
        DeadlineExpired = 1,
        InsufficientOutputAmount = 2,
        UnsupportedPath = 3,
        NotInitialized = 4,
    }

    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub enum MockRouterKey {
        Usdc,
        Eurc,
        ReserveUsdc,
        ReserveEurc,
    }

    /// Test double for the deployed Soroswap router, faithful to the audited
    /// implementation in github.com/soroswap/core `contracts/router/src/lib.rs`
    /// for the single-hop case this contract integrates with:
    /// - deadline expiry check (`>=`),
    /// - constant-product quote with the venue's 997/1000 fee,
    /// - `InsufficientOutputAmount` rejection BEFORE any token moves,
    /// - input pulled from the `to` address, output delivered to `to`.
    #[contract]
    pub struct MockSoroswapRouter;

    #[contractimpl]
    impl MockSoroswapRouter {
        pub fn initialize(env: Env, usdc: Address, eurc: Address) {
            env.storage().instance().set(&MockRouterKey::Usdc, &usdc);
            env.storage().instance().set(&MockRouterKey::Eurc, &eurc);
            env.storage()
                .instance()
                .set(&MockRouterKey::ReserveUsdc, &0i128);
            env.storage()
                .instance()
                .set(&MockRouterKey::ReserveEurc, &0i128);
        }

        pub fn set_reserves(env: Env, usdc_reserve: i128, eurc_reserve: i128) {
            env.storage()
                .instance()
                .set(&MockRouterKey::ReserveUsdc, &usdc_reserve);
            env.storage()
                .instance()
                .set(&MockRouterKey::ReserveEurc, &eurc_reserve);
        }

        pub fn reserves(env: Env) -> (i128, i128) {
            let usdc_reserve: i128 = env
                .storage()
                .instance()
                .get(&MockRouterKey::ReserveUsdc)
                .unwrap_or(0);
            let eurc_reserve: i128 = env
                .storage()
                .instance()
                .get(&MockRouterKey::ReserveEurc)
                .unwrap_or(0);
            (usdc_reserve, eurc_reserve)
        }

        pub fn swap_exact_tokens_for_tokens(
            env: Env,
            amount_in: i128,
            amount_out_min: i128,
            path: Vec<Address>,
            to: Address,
            deadline: u64,
        ) -> Vec<i128> {
            if env.ledger().timestamp() >= deadline {
                panic_with_error!(&env, MockRouterError::DeadlineExpired);
            }

            let usdc: Address = env
                .storage()
                .instance()
                .get(&MockRouterKey::Usdc)
                .unwrap_or_else(|| panic_with_error!(&env, MockRouterError::NotInitialized));
            let eurc: Address = env
                .storage()
                .instance()
                .get(&MockRouterKey::Eurc)
                .unwrap_or_else(|| panic_with_error!(&env, MockRouterError::NotInitialized));

            if path.len() != 2
                || path.get(0).as_ref() != Some(&usdc)
                || path.get(1).as_ref() != Some(&eurc)
            {
                panic_with_error!(&env, MockRouterError::UnsupportedPath);
            }

            let (reserve_in, reserve_out) = Self::reserves(env.clone());
            if reserve_in <= 0 || reserve_out <= 0 {
                panic_with_error!(&env, MockRouterError::InsufficientOutputAmount);
            }

            // SoroswapLibrary::get_amount_out: (in*997*out_reserve)/(in_reserve*1000 + in*997)
            let amount_in_with_fee = amount_in * 997;
            let numerator = amount_in_with_fee * reserve_out;
            let denominator = reserve_in * 1000 + amount_in_with_fee;
            let amount_out = numerator / denominator;

            if amount_out < amount_out_min {
                panic_with_error!(&env, MockRouterError::InsufficientOutputAmount);
            }

            let self_address = env.current_contract_address();
            token::Client::new(&env, &usdc).transfer(&to, &self_address, &amount_in);
            token::Client::new(&env, &eurc).transfer(&self_address, &to, &amount_out);

            Self::set_reserves(
                env.clone(),
                reserve_in + amount_in,
                reserve_out - amount_out,
            );

            Vec::from_array(&env, [amount_in, amount_out])
        }
    }

    struct Setup {
        env: Env,
        admin: Address,
        operator: Address,
        ally: Address,
        fee_recipient: Address,
        holders: Vec<Address>,
        whitelist_admin: Address,
        whitelist: PilotWhitelistClient<'static>,
        token: PilotIncomeTokenClient<'static>,
        payout: PilotPayoutSplitClient<'static>,
        payout_id: Address,
        usdc: StellarAssetClient<'static>,
        usdc_id: Address,
        eurc: StellarAssetClient<'static>,
        eurc_id: Address,
        router: MockSoroswapRouterClient<'static>,
        router_id: Address,
    }

    fn evidence_hash(env: &Env) -> Bytes {
        Bytes::from_array(env, &[7u8; 32])
    }

    fn short_hash(env: &Env) -> Bytes {
        Bytes::from_array(env, &[7u8; 12])
    }

    fn cycle(env: &Env, value: &str) -> String {
        String::from_str(env, value)
    }

    fn setup() -> Setup {
        setup_with_balance_values(&[1, 2, 3, 4, 10])
    }

    fn setup_with_balance_values(balance_values: &[i128]) -> Setup {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let ally = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let whitelist_admin = Address::generate(&env);

        let whitelist_id = env.register(PilotWhitelist, ());
        let whitelist = PilotWhitelistClient::new(&env, &whitelist_id);
        whitelist.initialize(&whitelist_admin);

        let mut holders = Vec::new(&env);
        let mut amounts = Vec::new(&env);
        for amount in balance_values {
            let holder = Address::generate(&env);
            whitelist.approve(&whitelist_admin, &holder);
            holders.push_back(holder);
            amounts.push_back(*amount);
        }

        let income_token_id = env.register(PilotIncomeToken, ());
        let token = PilotIncomeTokenClient::new(&env, &income_token_id);
        token.initialize(
            &admin,
            &whitelist_id,
            &String::from_str(&env, "Akkuea Pilot Income"),
            &String::from_str(&env, "AKIN"),
            &7,
        );
        token.mint_fixed_supply(&admin, &holders, &amounts);

        let usdc_admin = Address::generate(&env);
        let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin);
        let usdc = StellarAssetClient::new(&env, &usdc_contract.address());

        let eurc_admin = Address::generate(&env);
        let eurc_contract = env.register_stellar_asset_contract_v2(eurc_admin);
        let eurc = StellarAssetClient::new(&env, &eurc_contract.address());

        let router_id = env.register(MockSoroswapRouter, ());
        let router = MockSoroswapRouterClient::new(&env, &router_id);
        router.initialize(&usdc_contract.address(), &eurc_contract.address());

        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);
        payout.initialize(
            &admin,
            &operator,
            &ally,
            &fee_recipient,
            &income_token_id,
            &whitelist_id,
            &usdc_contract.address(),
            &eurc_contract.address(),
            &router_id,
        );

        usdc.mint(&payout_id, &100_000);

        Setup {
            env,
            admin,
            operator,
            ally,
            fee_recipient,
            holders,
            whitelist_admin,
            whitelist,
            token,
            payout,
            payout_id,
            usdc,
            usdc_id: usdc_contract.address(),
            eurc,
            eurc_id: eurc_contract.address(),
            router,
            router_id,
        }
    }

    fn fund_pool(s: &Setup, usdc_reserve: i128, eurc_reserve: i128) {
        s.usdc.mint(&s.router_id, &usdc_reserve);
        s.eurc.mint(&s.router_id, &eurc_reserve);
        s.router.set_reserves(&usdc_reserve, &eurc_reserve);
    }

    fn record_default(s: &Setup) {
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/2026-08"),
            &10_000,
        );
    }

    #[test]
    fn happy_path_distributes_fee_and_uneven_holder_amounts_exactly() {
        let s = setup();
        record_default(&s);

        let summary = s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        assert_eq!(summary.platform_fee, 1_000);
        assert_eq!(summary.holder_amount, 9_000);
        assert_eq!(summary.distributed_total, 9_000);
        assert_eq!(summary.dust, 0);
        assert_eq!(summary.holder_count, 5);
        assert_eq!(summary.swaps_failed, 0);
        assert_eq!(summary.undistributed_failed_swaps, 0);

        assert_eq!(s.usdc.balance(&s.fee_recipient), 1_000);
        assert_eq!(s.usdc.balance(&s.holders.get(0).unwrap()), 450);
        assert_eq!(s.usdc.balance(&s.holders.get(1).unwrap()), 900);
        assert_eq!(s.usdc.balance(&s.holders.get(2).unwrap()), 1_350);
        assert_eq!(s.usdc.balance(&s.holders.get(3).unwrap()), 1_800);
        assert_eq!(s.usdc.balance(&s.holders.get(4).unwrap()), 4_500);

        let record = s.payout.get_evidence(&cycle(&s.env, "2026-08")).unwrap();
        assert!(record.distributed);
    }

    #[test]
    fn mixed_currency_distribution_pays_exact_usdc_and_eurc_balances() {
        let s = setup();
        fund_pool(&s, 100_000, 100_000);
        let eurc_holder = s.holders.get(4).unwrap();
        s.payout
            .set_currency_preference(&eurc_holder, &Currency::Eurc);
        record_default(&s);

        let summary = s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        // Share for the EURC holder is 4_500 USDC. Against a 100k/100k pool the
        // Soroswap get_amount_out formula yields floor(4_486_500*100_000 /
        // (100_000*1000 + 4_486_500)) = 4_293 EURC, above the 4_275 minimum
        // implied by the 0.95 rate bound.
        assert_eq!(summary.swaps_failed, 0);
        assert_eq!(summary.eurc_distributed_total, 4_293);
        assert_eq!(summary.distributed_total, 9_000);
        assert_eq!(summary.dust, 0);

        assert_eq!(s.token.balance(&eurc_holder), 10);
        assert_eq!(
            eurc_balance(&s, &eurc_holder),
            4_293,
            "EURC holder must receive the exact swapped amount"
        );
        assert_eq!(s.usdc.balance(&eurc_holder), 0);

        // USDC-preference holders receive their exact pro-rata shares.
        assert_eq!(s.usdc.balance(&s.holders.get(0).unwrap()), 450);
        assert_eq!(s.usdc.balance(&s.holders.get(1).unwrap()), 900);
        assert_eq!(s.usdc.balance(&s.holders.get(2).unwrap()), 1_350);
        assert_eq!(s.usdc.balance(&s.holders.get(3).unwrap()), 1_800);
        assert_eq!(s.usdc.balance(&s.fee_recipient), 1_000);

        // Contract retains nothing beyond the pre-funded buffer; pool moved by
        // exactly the swapped amounts.
        assert_eq!(s.usdc.balance(&s.payout_id), 90_000);
        let (pool_usdc, pool_eurc) = s.router.reserves();
        assert_eq!(pool_usdc, 104_500);
        assert_eq!(pool_eurc, 95_707);
    }

    #[test]
    fn price_guard_rejects_unfavorable_rate_and_records_failure_without_panic() {
        let s = setup();
        fund_pool(&s, 100_000, 100_000);
        let eurc_holder = s.holders.get(4).unwrap();
        s.payout
            .set_currency_preference(&eurc_holder, &Currency::Eurc);
        record_default(&s);

        // 0.99 EURC per USDC demands 4_455 EURC out, more than the 4_293 the
        // pool can deliver: the venue rejects the leg before moving tokens.
        let strict_rate = 9_900_000i128;
        let summary = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &strict_rate,
        );

        let summary = summary
            .expect("distribution invocation must succeed")
            .expect("returned summary must decode despite one rejected leg");
        assert_eq!(summary.swaps_failed, 1);
        assert_eq!(summary.eurc_distributed_total, 0);
        assert_eq!(summary.undistributed_failed_swaps, 4_500);
        assert_eq!(summary.distributed_total, 4_500);

        // Typed failure record, not a panic: reason maps to PayoutError::SwapFailed.
        let failures = s.payout.get_swap_failures(&cycle(&s.env, "2026-08"));
        assert_eq!(failures.len(), 1);
        let failure = failures.get(0).unwrap();
        assert_eq!(failure.holder, eurc_holder);
        assert_eq!(failure.amount_usdc, 4_500);
        assert_eq!(failure.reason_code, PayoutError::SwapFailed as u32);

        // The rejected holder receives neither asset; other holders are exact.
        assert_eq!(eurc_balance(&s, &eurc_holder), 0);
        assert_eq!(s.usdc.balance(&eurc_holder), 0);
        assert_eq!(s.usdc.balance(&s.holders.get(0).unwrap()), 450);
        assert_eq!(s.usdc.balance(&s.holders.get(1).unwrap()), 900);
        assert_eq!(s.usdc.balance(&s.holders.get(2).unwrap()), 1_350);
        assert_eq!(s.usdc.balance(&s.holders.get(3).unwrap()), 1_800);
        assert_eq!(s.usdc.balance(&s.fee_recipient), 1_000);

        // The failed share stays custodied in the payout contract.
        assert_eq!(s.usdc.balance(&s.payout_id), 94_500);
    }

    #[test]
    fn failed_swap_isolates_other_holders_in_mixed_cycle() {
        let s = setup_with_balance_values(&[5, 15]);
        // Skewed-but-drainable pool: the first (smaller) share converts within
        // the rate bound while the second (larger) share cannot, simulating
        // illiquidity for exactly one leg.
        fund_pool(&s, 60_000, 60_000);
        s.payout
            .set_currency_preference(&s.holders.get(0).unwrap(), &Currency::Eurc);
        s.payout
            .set_currency_preference(&s.holders.get(1).unwrap(), &Currency::Eurc);
        record_default(&s);

        let summary = s
            .payout
            .try_execute_distribution(
                &s.operator,
                &s.ally,
                &cycle(&s.env, "2026-08"),
                &TEST_MIN_RATE,
            )
            .expect("distribution invocation must succeed")
            .expect("returned summary must decode despite one failed leg");

        assert_eq!(summary.swaps_failed, 1);
        assert_eq!(summary.eurc_distributed_total, 2_162);
        assert_eq!(summary.undistributed_failed_swaps, 6_750);

        // First holder: 2_250 USDC in, floor(2_243_250*60_000/(62_243_250)) = 2_162 EURC out.
        let first = s.holders.get(0).unwrap();
        assert_eq!(eurc_balance(&s, &first), 2_162);
        assert_eq!(s.usdc.balance(&first), 0);

        // Second holder's leg failed: nothing delivered, share retained on-chain.
        let second = s.holders.get(1).unwrap();
        assert_eq!(eurc_balance(&s, &second), 0);
        assert_eq!(s.usdc.balance(&second), 0);

        let failures = s.payout.get_swap_failures(&cycle(&s.env, "2026-08"));
        assert_eq!(failures.len(), 1);
        assert_eq!(failures.get(0).unwrap().holder, second);
        assert_eq!(failures.get(0).unwrap().amount_usdc, 6_750);

        assert_eq!(s.usdc.balance(&s.fee_recipient), 1_000);
        // 100,000 initial - 1,000 fee - 2,250 swapped via router = 96,750.
        assert_eq!(s.usdc.balance(&s.payout_id), 96_750);
    }

    #[test]
    fn eurc_cycle_without_min_rate_bound_is_rejected_typed() {
        let s = setup();
        fund_pool(&s, 100_000, 100_000);
        s.payout
            .set_currency_preference(&s.holders.get(0).unwrap(), &Currency::Eurc);
        record_default(&s);

        let res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &0i128,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::InvalidMinRate as u32
            )))
        );

        // Nothing was mutated: the cycle remains executable once a bound is supplied.
        let record = s.payout.get_evidence(&cycle(&s.env, "2026-08")).unwrap();
        assert!(!record.distributed);
    }

    #[test]
    fn usdc_only_cycles_ignore_min_rate_bound() {
        let s = setup();
        record_default(&s);

        let summary =
            s.payout
                .execute_distribution(&s.operator, &s.ally, &cycle(&s.env, "2026-08"), &0i128);

        assert_eq!(summary.distributed_total, 9_000);
        assert_eq!(summary.eurc_distributed_total, 0);
        assert_eq!(summary.swaps_failed, 0);
    }

    #[test]
    fn currency_preference_defaults_to_usdc_and_updates_both_ways() {
        let s = setup();
        let holder = s.holders.get(0).unwrap();

        assert_eq!(s.payout.get_currency_preference(&holder), Currency::Usdc);

        s.payout.set_currency_preference(&holder, &Currency::Eurc);
        assert_eq!(s.payout.get_currency_preference(&holder), Currency::Eurc);

        s.payout.set_currency_preference(&holder, &Currency::Usdc);
        assert_eq!(s.payout.get_currency_preference(&holder), Currency::Usdc);
    }

    #[test]
    fn non_whitelisted_address_cannot_set_preference() {
        let s = setup();
        let outsider = Address::generate(&s.env);

        let res = s
            .payout
            .try_set_currency_preference(&outsider, &Currency::Eurc);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::RecipientNotApproved as u32
            )))
        );
        assert_eq!(s.payout.get_currency_preference(&outsider), Currency::Usdc);
    }

    #[test]
    fn holder_cannot_set_another_holders_preference() {
        let s = setup();
        let target = s.holders.get(0).unwrap();
        let attacker = Address::generate(&s.env);

        // Only the attacker's signature is provided; the required
        // `target.require_auth()` is missing, so the invocation must fail.
        s.env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &s.payout_id,
                fn_name: "set_currency_preference",
                args: (
                    target.clone(),
                    <Currency as soroban_sdk::IntoVal<Env, soroban_sdk::Val>>::into_val(
                        &Currency::Eurc,
                        &s.env,
                    ),
                )
                    .into_val(&s.env),
                sub_invokes: &[],
            },
        }]);

        let res = s
            .payout
            .try_set_currency_preference(&target, &Currency::Eurc);

        assert!(res.is_err());
        assert_eq!(s.payout.get_currency_preference(&target), Currency::Usdc);
    }

    #[test]
    fn paused_contract_blocks_preference_changes() {
        let s = setup();
        let holder = s.holders.get(0).unwrap();
        s.payout.pause(&s.admin);

        let res = s
            .payout
            .try_set_currency_preference(&holder, &Currency::Eurc);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractPaused as u32
            )))
        );
    }

    #[test]
    fn eurc_swap_path_status_reports_real_configured_addresses() {
        let s = setup();

        let status = s
            .payout
            .eurc_swap_path_status()
            .expect("status must reflect real on-chain configuration");
        assert_eq!(status.swap_router, s.router_id);
        assert_eq!(status.usdc_token, s.usdc_id);
        assert_eq!(status.eurc_token, s.eurc_id);
    }

    #[test]
    fn eurc_swap_path_status_is_none_before_initialization() {
        let env = Env::default();
        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);

        assert_eq!(payout.eurc_swap_path_status(), None);
    }

    #[test]
    fn initialize_rejects_degenerate_swap_configuration() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let ally = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let income_token = Address::generate(&env);
        let whitelist = Address::generate(&env);
        let usdc = Address::generate(&env);
        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);

        // EURC equal to USDC leaves the swap path meaningless.
        let res = payout.try_initialize(
            &admin,
            &operator,
            &ally,
            &fee_recipient,
            &income_token,
            &whitelist,
            &usdc,
            &usdc,
            &Address::generate(&env),
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::RouterNotConfigured as u32
            )))
        );
    }

    #[test]
    fn revoked_holder_blocks_distribution() {
        let s = setup();
        s.whitelist
            .revoke(&s.whitelist_admin, &s.holders.get(2).unwrap());
        record_default(&s);

        let res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::RecipientNotApproved as u32
            )))
        );
    }

    #[test]
    fn insufficient_evidence_hash_is_rejected() {
        let s = setup();

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "bad-hash"),
            &short_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/bad"),
            &10_000,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::InvalidEvidenceHash as u32
            )))
        );
    }

    #[test]
    fn zero_amount_distribution_is_rejected() {
        let s = setup();

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "zero"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/zero"),
            &0,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ZeroAmount as u32
            )))
        );
    }

    #[test]
    fn double_distribution_for_same_cycle_is_rejected() {
        let s = setup();
        record_default(&s);
        s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        let res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::CycleAlreadyDistributed as u32
            )))
        );
    }

    #[test]
    fn double_evidence_record_for_same_cycle_is_rejected() {
        let s = setup();
        record_default(&s);

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/duplicate"),
            &10_000,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::CycleAlreadyRecorded as u32
            )))
        );
    }

    #[test]
    fn paused_contract_blocks_record_and_execute() {
        let s = setup();
        s.payout.pause(&s.admin);

        let record_res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "paused"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/paused"),
            &10_000,
        );
        assert_eq!(
            record_res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractPaused as u32
            )))
        );

        let execute_res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "missing"),
            &TEST_MIN_RATE,
        );
        assert_eq!(
            execute_res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractPaused as u32
            )))
        );
    }

    #[test]
    fn unpause_restores_execution() {
        let s = setup();
        s.payout.pause(&s.admin);
        s.payout.unpause(&s.admin);

        assert!(!s.payout.is_paused());
        record_default(&s);
        let summary = s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );
        assert_eq!(summary.distributed_total, 9_000);
    }

    #[test]
    fn only_admin_can_pause() {
        let s = setup();
        let attacker = Address::generate(&s.env);

        let res = s.payout.try_pause(&attacker);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn exit_requires_both_signers() {
        // Symmetric to `single_signer_attempt_is_rejected` for
        // `execute_distribution`: only the operator's signature is provided, so
        // the missing `ally.require_auth()` must reject the invocation and no
        // exit state may be written.
        let env = Env::default();
        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let ally = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let income_token = Address::generate(&env);
        let whitelist = Address::generate(&env);
        let usdc = Address::generate(&env);
        let eurc = Address::generate(&env);
        let router = Address::generate(&env);
        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);

        payout.initialize(
            &admin,
            &operator,
            &ally,
            &fee_recipient,
            &income_token,
            &whitelist,
            &usdc,
            &eurc,
            &router,
        );

        let reason = String::from_str(&env, "ally ceased operations");
        env.mock_auths(&[MockAuth {
            address: &operator,
            invoke: &MockAuthInvoke {
                contract: &payout_id,
                fn_name: "exit",
                args: (operator.clone(), ally.clone(), reason.clone()).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = payout.try_exit(&operator, &ally, &reason);

        assert!(res.is_err());
        assert_eq!(payout.exit_status(), None);
    }

    #[test]
    fn exit_with_empty_reason_is_rejected() {
        let s = setup();

        let res = s
            .payout
            .try_exit(&s.operator, &s.ally, &String::from_str(&s.env, ""));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::MissingExitReason as u32
            )))
        );
        assert_eq!(s.payout.exit_status(), None);
    }

    #[test]
    fn exited_contract_blocks_record_evidence() {
        let s = setup();
        s.payout.exit(
            &s.operator,
            &s.ally,
            &String::from_str(&s.env, "ally ceased operations"),
        );

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "exited"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/exited"),
            &10_000,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractExited as u32
            )))
        );
    }

    #[test]
    fn exited_contract_blocks_execute_distribution() {
        let s = setup();
        record_default(&s);
        s.payout.exit(
            &s.operator,
            &s.ally,
            &String::from_str(&s.env, "ally ceased operations"),
        );

        let res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractExited as u32
            )))
        );
    }

    #[test]
    fn exit_is_one_way() {
        let s = setup();
        let reason = String::from_str(&s.env, "ally ceased operations");
        s.payout.exit(&s.operator, &s.ally, &reason);

        // A second exit, even with a different reason, is rejected: the
        // relationship is permanently terminated and no un-exit exists.
        let res = s.payout.try_exit(
            &s.operator,
            &s.ally,
            &String::from_str(&s.env, "changed mind"),
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractExited as u32
            )))
        );

        // The original record is untouched.
        let status = s.payout.exit_status().unwrap();
        assert_eq!(status.reason, reason);
    }

    #[test]
    fn exit_status_reports_not_exited_then_record() {
        let s = setup();
        assert_eq!(s.payout.exit_status(), None);

        let reason = String::from_str(&s.env, "property sold to new owner");
        s.payout.exit(&s.operator, &s.ally, &reason);

        let status = s.payout.exit_status().expect("exit must be recorded");
        assert_eq!(status.reason, reason);
        assert_eq!(status.at, s.env.ledger().timestamp());
    }

    #[test]
    fn contract_types_round_trip_through_xdr_scval() {
        let s = setup();
        let reason = String::from_str(&s.env, "ally ceased operations");
        s.payout.exit(&s.operator, &s.ally, &reason);
        let record = s.payout.exit_status().expect("exit must be recorded");

        // The `contracttype` derive implements the ScVal (XDR) encoding that
        // off-chain clients and `stellar contract invoke` use. Verify the new
        // types round-trip through it, in both directions.
        let scval: ScVal = (&record)
            .try_into()
            .expect("exit record must encode to ScVal");
        assert!(matches!(scval, ScVal::Map(Some(_))));
        let decoded: ExitRecord =
            TryFromVal::try_from_val(&s.env, &scval).expect("exit record must decode");
        assert_eq!(decoded, record);

        let event = events::ExitRecordedEvent {
            operator: s.operator.clone(),
            ally: s.ally.clone(),
            reason,
            at: record.at,
        };
        let event_scval: ScVal = (&event)
            .try_into()
            .expect("exit event must encode to ScVal");
        assert!(matches!(event_scval, ScVal::Map(Some(_))));
        let decoded_event: events::ExitRecordedEvent =
            TryFromVal::try_from_val(&s.env, &event_scval).expect("exit event must decode");
        assert_eq!(decoded_event, event);
    }

    #[test]
    fn exit_is_independent_of_pause() {
        let s = setup();

        // Exit is permitted while paused: the two gates are independent.
        s.payout.pause(&s.admin);
        let reason = String::from_str(&s.env, "ally ceased operations");
        s.payout.exit(&s.operator, &s.ally, &reason);
        assert!(s.payout.is_paused());
        assert!(s.payout.exit_status().is_some());

        // Unpause after exit works and must not clear the terminal state.
        s.payout.unpause(&s.admin);
        assert!(!s.payout.is_paused());
        assert!(s.payout.exit_status().is_some());

        // Re-pausing after exit is still possible: pause stays reversible.
        s.payout.pause(&s.admin);
        assert!(s.payout.is_paused());
        assert!(s.payout.exit_status().is_some());

        // For a contract that is both paused and exited, the terminal error
        // wins: pause is reversible, exit is not, so the permanent fact is the
        // one a client should see.
        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "both"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/both"),
            &10_000,
        );
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractExited as u32
            )))
        );
    }

    #[test]
    fn insufficient_usdc_balance_rejects_distribution() {
        let s = setup();
        record_default(&s);
        s.usdc.burn(&s.payout_id, &95_000);

        let res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::InsufficientPayoutBalance as u32
            )))
        );
    }

    #[test]
    fn single_signer_attempt_is_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let ally = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let income_token = Address::generate(&env);
        let whitelist = Address::generate(&env);
        let usdc = Address::generate(&env);
        let eurc = Address::generate(&env);
        let router = Address::generate(&env);
        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);

        payout.initialize(
            &admin,
            &operator,
            &ally,
            &fee_recipient,
            &income_token,
            &whitelist,
            &usdc,
            &eurc,
            &router,
        );

        let cycle_id = cycle(&env, "single-signer");
        let hash = evidence_hash(&env);
        let link = String::from_str(&env, "ipfs://evidence/single-signer");
        env.mock_auths(&[MockAuth {
            address: &operator,
            invoke: &MockAuthInvoke {
                contract: &payout_id,
                fn_name: "record_evidence",
                args: (
                    operator.clone(),
                    ally.clone(),
                    cycle_id.clone(),
                    hash.clone(),
                    link.clone(),
                    10_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = payout.try_record_evidence(&operator, &ally, &cycle_id, &hash, &link, &10_000);

        assert!(res.is_err());
    }

    #[test]
    fn token_client_surface_is_used_for_distribution() {
        let s = setup();
        assert_eq!(s.token.total_supply(), 20);
        assert_eq!(s.token.holders().len(), 5);
    }

    #[test]
    fn initialize_rejects_same_operator_and_ally() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let signer = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let income_token = Address::generate(&env);
        let whitelist = Address::generate(&env);
        let usdc = Address::generate(&env);
        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);

        let res = payout.try_initialize(
            &admin,
            &signer,
            &signer,
            &fee_recipient,
            &income_token,
            &whitelist,
            &usdc,
            &Address::generate(&env),
            &Address::generate(&env),
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::SignerCollision as u32
            )))
        );
    }

    #[test]
    fn budget_check_execute_distribution_for_ten_holders() {
        let s = setup_with_balance_values(&[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        s.usdc.mint(&s.payout_id, &1_000_000);
        fund_pool(&s, 10_000_000, 10_000_000);
        for i in [0u32, 2, 4, 6, 8] {
            s.payout
                .set_currency_preference(&s.holders.get(i).unwrap(), &Currency::Eurc);
        }
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "budget-25"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/budget-25"),
            &325_000,
        );

        s.env.cost_estimate().budget().reset_unlimited();
        let summary = s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "budget-25"),
            &TEST_MIN_RATE,
        );
        let cpu = s.env.cost_estimate().budget().cpu_instruction_cost();
        let mem = s.env.cost_estimate().budget().memory_bytes_cost();
        s.env.cost_estimate().budget().print();
        std::println!("MEASURED cpu={} mem={}", cpu, mem);

        assert_eq!(summary.holder_count, 10);
        assert_eq!(summary.swaps_failed, 0);
        assert!(
            summary.eurc_distributed_total > 0,
            "mixed-currency budget run must include successful swap legs"
        );
        assert!(
            cpu <= 120_000_000,
            "execute_distribution CPU budget exceeded"
        );
        assert!(
            mem <= 12_000_000,
            "execute_distribution memory budget exceeded"
        );
    }

    #[test]
    fn tiny_eurc_share_triggers_defensive_zero_min_out_guard() {
        // With balances [1, 19], total_supply = 20. The holder with balance 1
        // gets 9000 * 1 / 20 = 450 USDC pro-rata. With min_eurc_per_usdc = 1
        // (the smallest positive value), min_eurc_out = 450 * 1 / 10_000_000 = 0
        // via integer division. The defensive check inside run_eurc_swap_leg
        // rejects this before the router is called.
        let s = setup_with_balance_values(&[1, 19]);
        fund_pool(&s, 100_000, 100_000);
        s.payout
            .set_currency_preference(&s.holders.get(0).unwrap(), &Currency::Eurc);
        record_default(&s);

        let res = s.payout.try_execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &1i128,
        );

        let summary = res
            .expect("distribution invocation must succeed")
            .expect("returned summary must decode despite one rejected leg");
        assert_eq!(summary.swaps_failed, 1);
        assert_eq!(summary.eurc_distributed_total, 0);
        assert_eq!(summary.undistributed_failed_swaps, 450);

        let failures = s.payout.get_swap_failures(&cycle(&s.env, "2026-08"));
        assert_eq!(failures.len(), 1);
        assert_eq!(
            failures.get(0).unwrap().reason_code,
            PayoutError::SlippageExceeded as u32
        );

        // The other holder (USDC) is paid normally.
        assert_eq!(s.usdc.balance(&s.holders.get(1).unwrap()), 8_550);
        assert_eq!(s.usdc.balance(&s.fee_recipient), 1_000);
    }

    #[test]
    fn event_swap_executed_emits_correct_amounts() {
        let s = setup();
        fund_pool(&s, 100_000, 100_000);
        let eurc_holder = s.holders.get(4).unwrap();
        s.payout
            .set_currency_preference(&eurc_holder, &Currency::Eurc);
        record_default(&s);

        s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &TEST_MIN_RATE,
        );

        // Verify the swap_executed event was emitted by checking the EURC balance
        // matches the expected swapped amount (4_293 from the 100k/100k pool).
        assert_eq!(eurc_balance(&s, &eurc_holder), 4_293);
    }

    #[test]
    fn event_swap_failed_emits_correct_reason_code() {
        let s = setup();
        fund_pool(&s, 100_000, 100_000);
        let eurc_holder = s.holders.get(4).unwrap();
        s.payout
            .set_currency_preference(&eurc_holder, &Currency::Eurc);
        record_default(&s);

        let strict_rate = 9_900_000i128;
        let summary = s
            .payout
            .try_execute_distribution(
                &s.operator,
                &s.ally,
                &cycle(&s.env, "2026-08"),
                &strict_rate,
            )
            .expect("distribution invocation must succeed")
            .expect("returned summary must decode despite one rejected leg");

        // The swap_failed event is emitted with SwapFailed reason code.
        assert_eq!(summary.swaps_failed, 1);
        let failures = s.payout.get_swap_failures(&cycle(&s.env, "2026-08"));
        assert_eq!(
            failures.get(0).unwrap().reason_code,
            PayoutError::SwapFailed as u32
        );
    }

    fn eurc_balance(s: &Setup, holder: &Address) -> i128 {
        token::Client::new(&s.env, &s.eurc_id).balance(holder)
    }
}
