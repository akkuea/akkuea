#![allow(deprecated)]

use soroban_sdk::{contracttype, symbol_short, Address, Env, String};

use crate::DistributionSummary;

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
