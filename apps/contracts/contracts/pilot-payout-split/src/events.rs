#![allow(deprecated)]

use soroban_sdk::{contracttype, symbol_short, Address, Env, String};

use crate::{Currency, DistributionSummary};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutInitializedEvent {
    pub admin: Address,
    pub operator: Address,
    pub ally: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceRecordedEvent {
    pub operator: Address,
    pub ally: Address,
    pub cycle_id: String,
    pub total_income: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CurrencyPreferenceSetEvent {
    pub holder: Address,
    pub currency: Currency,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapExecutedEvent {
    pub cycle_id: String,
    pub holder: Address,
    pub amount_usdc_in: i128,
    pub amount_eurc_out: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapFailedEvent {
    pub cycle_id: String,
    pub holder: Address,
    pub amount_usdc_retained: i128,
    /// `PayoutError` discriminant describing why the leg was rejected.
    pub reason_code: u32,
}

pub fn emit_initialized(env: &Env, admin: Address, operator: Address, ally: Address) {
    env.events().publish(
        (symbol_short!("init"),),
        PayoutInitializedEvent {
            admin,
            operator,
            ally,
        },
    );
}

pub fn emit_evidence_recorded(
    env: &Env,
    operator: Address,
    ally: Address,
    cycle_id: String,
    total_income: i128,
) {
    env.events().publish(
        (symbol_short!("evidence"),),
        EvidenceRecordedEvent {
            operator,
            ally,
            cycle_id,
            total_income,
        },
    );
}

pub fn emit_distribution_executed(env: &Env, summary: DistributionSummary) {
    env.events()
        .publish((symbol_short!("dist"), summary.cycle_id.clone()), summary);
}

pub fn emit_paused(env: &Env, admin: Address) {
    env.events().publish((symbol_short!("pause"),), admin);
}

pub fn emit_unpaused(env: &Env, admin: Address) {
    env.events().publish((symbol_short!("unpause"),), admin);
}

pub fn emit_currency_preference_set(env: &Env, holder: Address, currency: Currency) {
    env.events().publish(
        (symbol_short!("prefset"),),
        CurrencyPreferenceSetEvent { holder, currency },
    );
}

pub fn emit_swap_executed(
    env: &Env,
    cycle_id: String,
    holder: Address,
    amount_usdc_in: i128,
    amount_eurc_out: i128,
) {
    env.events().publish(
        (symbol_short!("swapout"),),
        SwapExecutedEvent {
            cycle_id,
            holder,
            amount_usdc_in,
            amount_eurc_out,
        },
    );
}

pub fn emit_swap_failed(
    env: &Env,
    cycle_id: String,
    holder: Address,
    amount_usdc_retained: i128,
    reason_code: u32,
) {
    env.events().publish(
        (symbol_short!("swapfail"),),
        SwapFailedEvent {
            cycle_id,
            holder,
            amount_usdc_retained,
            reason_code,
        },
    );
}

/// Emitted once when the ally/property relationship is permanently terminated.
/// Clients can watch this to render the terminal state without polling
/// `exit_status`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExitRecordedEvent {
    pub operator: Address,
    pub ally: Address,
    pub reason: String,
    pub at: u64,
}

pub fn emit_exit_recorded(env: &Env, operator: Address, ally: Address, reason: String, at: u64) {
    env.events().publish(
        (symbol_short!("exit"),),
        ExitRecordedEvent {
            operator,
            ally,
            reason,
            at,
        },
    );
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceSubmittedEvent {
    pub ally: Address,
    pub cycle_id: String,
    pub total_income: i128,
    pub submitted_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceReviewedEvent {
    pub operator: Address,
    pub cycle_id: String,
    pub approved: bool,
    pub reason: String,
    pub reviewed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceDisputedEvent {
    pub caller: Address,
    pub cycle_id: String,
    pub reason: String,
    pub disputed_at: u64,
}

/// Emitted when the ally submits evidence and the cycle enters review.
pub fn emit_evidence_submitted(
    env: &Env,
    ally: Address,
    cycle_id: String,
    total_income: i128,
    submitted_at: u64,
) {
    env.events().publish(
        (symbol_short!("submit"), cycle_id.clone()),
        EvidenceSubmittedEvent {
            ally,
            cycle_id,
            total_income,
            submitted_at,
        },
    );
}

/// Emitted when the operator opens a submitted cycle for review.
pub fn emit_review_started(env: &Env, operator: Address, cycle_id: String) {
    env.events()
        .publish((symbol_short!("review"), cycle_id), operator);
}

/// Emitted when the operator approves or rejects a cycle's evidence.
pub fn emit_evidence_reviewed(
    env: &Env,
    operator: Address,
    cycle_id: String,
    approved: bool,
    reason: String,
    reviewed_at: u64,
) {
    env.events().publish(
        (symbol_short!("reviewed"), cycle_id.clone()),
        EvidenceReviewedEvent {
            operator,
            cycle_id,
            approved,
            reason,
            reviewed_at,
        },
    );
}

/// Emitted when a cycle is flagged as disputed by the admin or the operator.
pub fn emit_evidence_disputed(
    env: &Env,
    caller: Address,
    cycle_id: String,
    reason: String,
    disputed_at: u64,
) {
    env.events().publish(
        (symbol_short!("dispute"), cycle_id.clone()),
        EvidenceDisputedEvent {
            caller,
            cycle_id,
            reason,
            disputed_at,
        },
    );
}
