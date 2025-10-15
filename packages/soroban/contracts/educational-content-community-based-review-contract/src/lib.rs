#![no_std]

mod moderation;
mod utils;

use core::option::Option;
use moderation::{flag_review_impl, get_flag_impl, vote_moderation_impl};
use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Symbol};
use utils::{
    ModerationFlag, ADMIN, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD, MODERATION_FLAGS,
    REPUTATION_CONTRACT,
};

#[contract]
pub struct CommunityModeration;

#[contractimpl]
impl CommunityModeration {
    pub fn initialize(env: Env, admin: Address, reputation_contract: Address) {
        if env.storage().persistent().has(&ADMIN) {
            panic!("Already initialized");
        }
        env.storage().persistent().set(&ADMIN, &admin);
        env.storage().persistent().extend_ttl(
            &ADMIN,
            INSTANCE_LIFETIME_THRESHOLD,
            INSTANCE_BUMP_AMOUNT,
        );

        env.storage()
            .persistent()
            .set(&REPUTATION_CONTRACT, &reputation_contract);
        env.storage().persistent().extend_ttl(
            &REPUTATION_CONTRACT,
            INSTANCE_LIFETIME_THRESHOLD,
            INSTANCE_BUMP_AMOUNT,
        );

        env.storage()
            .persistent()
            .set(&MODERATION_FLAGS, &Map::<u64, ModerationFlag>::new(&env));
        env.storage().persistent().extend_ttl(
            &MODERATION_FLAGS,
            INSTANCE_LIFETIME_THRESHOLD,
            INSTANCE_BUMP_AMOUNT,
        );
    }

    pub fn flag_review(env: Env, flagger: Address, review_id: u64, reason: String) {
        flag_review_impl(env, flagger, review_id, reason);
    }

    pub fn vote_moderation(env: Env, voter: Address, review_id: u64, approve: bool) {
        vote_moderation_impl(env, voter, review_id, approve);
    }

    pub fn get_flag(env: Env, review_id: u64) -> Option<ModerationFlag> {
        get_flag_impl(env, review_id)
    }

    pub fn admin_resolve(env: Env, review_id: u64, approve: bool) {
        let admin: Address = env.storage().persistent().get(&ADMIN).unwrap();
        admin.require_auth();

        let mut flags: Map<u64, ModerationFlag> =
            env.storage().persistent().get(&MODERATION_FLAGS).unwrap();
        let mut flag = flags
            .get(review_id)
            .unwrap_or_else(|| panic!("Flag not found"));

        if flag.resolved {
            panic!("Moderation already resolved");
        }

        flag.resolved = true;
        flags.set(review_id, flag);
        env.storage().persistent().set(&MODERATION_FLAGS, &flags);

        env.events().publish(
            (Symbol::new(&env, "moderation_resolved"),),
            (review_id, approve),
        );
    }
}

#[cfg(test)]
mod test;
