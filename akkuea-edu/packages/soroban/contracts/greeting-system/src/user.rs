use soroban_sdk::{symbol_short, Address, Env, IntoVal, String, Symbol, Vec};

use crate::{
    emit_user_registered, get_current_timestamp, get_reputation_contract, has_user_profile,
    save_user_profile, validate_name, validate_preferences, verify_user_authorization, Error,
    UserProfile,
};

pub fn register(
    env: &Env,
    user: &Address,
    name: &String,
    preferences: &String,
) -> Result<(), Error> {
    verify_user_authorization(env, user)?;
    validate_name(name)?;
    validate_preferences(preferences)?;

    if has_user_profile(env, user) {
        return Err(Error::UserAlreadyRegistered);
    }

    let timestamp = get_current_timestamp(env);
    let profile = UserProfile {
        user: user.clone(),
        name: name.clone(),
        preferences: preferences.clone(),
        registered_at: timestamp,
    };

    save_user_profile(env, &profile)?;

    if let Some(rep_contract) = get_reputation_contract(env) {
        //  platform-user-reputation-contract.register(env, user, expertise)
        let expertise: Vec<Symbol> = Vec::new(env);
        let args = (user.clone(), expertise).into_val(env);
        let _res: () = env.invoke_contract(&rep_contract, &symbol_short!("register"), args);
    }

    emit_user_registered(env, &profile)?;
    Ok(())
}

pub fn get_profile(env: &Env, user: &Address) -> Result<UserProfile, Error> {
    crate::load_user_profile(env, user)
}
