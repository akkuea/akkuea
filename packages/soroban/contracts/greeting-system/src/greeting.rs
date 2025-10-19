use crate::{
    events::emit_multimedia_greeting_created, has_user_profile, verify_user_authorization, Error,
};
use soroban_sdk::{contracttype, Address, Bytes, Env, String};

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Greeting {
    pub greeting_id: u64,
    pub creator: Address,
    pub text: String,
    pub media_hash: Option<Bytes>, // Optional multimedia reference
}

// ==================== Core Functions ====================

/// Create a multimedia greeting (text + media reference)
pub fn create_multimedia_greeting(
    env: &Env,
    greeting_id: u64,
    text: String,
    media_hash: Bytes,
    creator: Address,
) -> Result<(), Error> {
    verify_user_authorization(env, &creator)?;

    if !has_user_profile(env, &creator) {
        return Err(Error::UserNotFound);
    }

    if text.is_empty() {
        return Err(Error::InvalidGreeting);
    }

    if media_hash.len() < 10 {
        return Err(Error::InvalidMediaHash);
    }

    // Save greeting
    let greeting = Greeting {
        greeting_id,
        creator: creator.clone(),
        text: text.clone(),
        media_hash: Some(media_hash.clone()),
    };
    save_multimedia_greeting(env, &greeting)?;

    emit_multimedia_greeting_created(env, &creator, greeting_id, &media_hash)?;

    Ok(())
}

/// Retrieve the multimedia hash for a greeting
pub fn get_greeting_media(env: &Env, greeting_id: u64) -> Result<Bytes, Error> {
    let greeting = load_multimedia_greeting(env, greeting_id)?;
    match greeting.media_hash {
        Some(hash) => Ok(hash),
        None => Err(Error::MediaNotFound),
    }
}

// ==================== Storage Helpers ====================

pub fn save_multimedia_greeting(env: &Env, greeting: &Greeting) -> Result<(), Error> {
    let key = (greeting.greeting_id,);
    // specify key and value types explicitly: key is (u64,) and value is Greeting
    env.storage()
        .persistent()
        .set::<(u64,), Greeting>(&key, greeting);
    Ok(())
}

pub fn load_multimedia_greeting(env: &Env, greeting_id: u64) -> Result<Greeting, Error> {
    let key = (greeting_id,);
    env.storage()
        .persistent()
        .get::<(u64,), Greeting>(&key)
        .ok_or(Error::GreetingNotFound)
}
