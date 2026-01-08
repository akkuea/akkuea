use crate::error::Error;
use crate::types::*;
use soroban_sdk::{Address, Env};

pub fn mint_credential_token(env: Env, caller: Address, user_id: u64) -> Result<u64, Error> {
    caller.require_auth();

    // Verify user exists and is verified
    let user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;
    if !user.verified {
        return Err(Error::NotVerified);
    }

    // Get next token ID
    let token_id = env
        .storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(1u64);
    env.storage()
        .instance()
        .set(&DataKey::NextTokenId, &(token_id + 1));

    // Create and store credential token
    let token = CredentialToken {
        user_id,
        token_id,
        issued_at: env.ledger().timestamp(),
    };
    env.storage()
        .instance()
        .set(&DataKey::Credential(token_id), &token);

    Ok(token_id)
}
