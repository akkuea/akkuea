use crate::error::Error;
use crate::types::*;
use soroban_sdk::{Address, Env, Map, String};

pub fn update_expertise_areas(
    env: Env,
    caller: Address,
    user_id: u64,
    expertise_areas: Map<String, u32>,
) -> Result<(), Error> {
    caller.require_auth();

    // Verify user exists
    let mut user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;

    // Update expertise areas
    user.expertise_areas = expertise_areas;
    env.storage().instance().set(&DataKey::User(user_id), &user);
    Ok(())
}

pub fn get_expertise_areas(env: Env, user_id: u64) -> Result<Map<String, u32>, Error> {
    let user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;
    Ok(user.expertise_areas)
}
