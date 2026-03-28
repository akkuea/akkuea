#![no_std]

// Operational Assumptions (REQ-006):
// - Off-chain cashflow is collected by the property admin, who then calls
//   `create_distribution` with the total amount available for distribution.
// - Token holders call `claim_distribution` to record their entitlement on-chain.
// - Actual payment settlement occurs off-chain or via a separate token contract.
// - The `period` field is a reference identifier (e.g. 202601 for Jan 2026)
//   and is not enforced on-chain.
// - Integer division rounding: the last claimer may receive 1 less unit
//   (sub-stroop), which is acceptable for real estate distribution amounts.

use soroban_sdk::{contract, contractimpl, Address, Env};

pub mod events;
pub mod storage;

use events::{
    emit_distribution_claimed, emit_distribution_created, emit_property_registered,
    emit_shareholder_registered,
};
use storage::{DataKey, Distribution, PropertyInfo};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn register_property(env: Env, admin: Address, property_id: u64, total_shares: u32) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }

        let info = PropertyInfo {
            id: property_id,
            admin: admin.clone(),
            total_shares,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Property(property_id), &info);
        env.storage()
            .persistent()
            .set(&DataKey::DistCount(property_id), &0u32);

        emit_property_registered(&env, property_id, total_shares);
    }

    pub fn register_shareholder(
        env: Env,
        admin: Address,
        property_id: u64,
        holder: Address,
        shares: u32,
    ) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }

        let _info: PropertyInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Property(property_id))
            .expect("property not found");

        env.storage()
            .persistent()
            .set(&DataKey::Shares(property_id, holder.clone()), &shares);

        emit_shareholder_registered(&env, property_id, holder, shares);
    }

    pub fn create_distribution(
        env: Env,
        admin: Address,
        property_id: u64,
        total_amount: i128,
        period: u64,
    ) -> u32 {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }

        let info: PropertyInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Property(property_id))
            .expect("property not found");

        let dist_id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::DistCount(property_id))
            .unwrap_or(0);

        let dist = Distribution {
            id: dist_id,
            property_id,
            total_amount,
            period,
            total_shares: info.total_shares,
            claimed_amount: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Dist(property_id, dist_id), &dist);
        env.storage()
            .persistent()
            .set(&DataKey::DistCount(property_id), &(dist_id + 1));

        emit_distribution_created(&env, property_id, dist_id, total_amount, period);

        dist_id
    }

    pub fn claim_distribution(env: Env, holder: Address, property_id: u64, dist_id: u32) -> i128 {
        holder.require_auth();

        let claimed_key = DataKey::Claimed(property_id, dist_id, holder.clone());
        if env.storage().persistent().has(&claimed_key) {
            panic!("already claimed");
        }

        let shares: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Shares(property_id, holder.clone()))
            .expect("no shares registered");

        if shares == 0 {
            panic!("no shares registered");
        }

        let mut dist: Distribution = env
            .storage()
            .persistent()
            .get(&DataKey::Dist(property_id, dist_id))
            .expect("distribution not found");

        let amount = (dist.total_amount * shares as i128) / dist.total_shares as i128;

        dist.claimed_amount += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Dist(property_id, dist_id), &dist);
        env.storage().persistent().set(&claimed_key, &true);

        emit_distribution_claimed(&env, property_id, dist_id, holder, amount);

        amount
    }

    pub fn get_distribution(env: Env, property_id: u64, dist_id: u32) -> Distribution {
        env.storage()
            .persistent()
            .get(&DataKey::Dist(property_id, dist_id))
            .expect("distribution not found")
    }

    pub fn get_claimable(env: Env, holder: Address, property_id: u64, dist_id: u32) -> i128 {
        let claimed_key = DataKey::Claimed(property_id, dist_id, holder.clone());
        if env.storage().persistent().has(&claimed_key) {
            return 0;
        }

        let shares: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Shares(property_id, holder))
            .unwrap_or(0);

        if shares == 0 {
            return 0;
        }

        let dist: Distribution = match env
            .storage()
            .persistent()
            .get(&DataKey::Dist(property_id, dist_id))
        {
            Some(d) => d,
            None => return 0,
        };

        (dist.total_amount * shares as i128) / dist.total_shares as i128
    }
}

mod test;
