use crate::storage::{
    get_content, save_content, AdvDataKey, Delegation, VerificationLevel, VerificationRecord,
};
use soroban_sdk::{symbol_short, Address, Env, Vec};

// Verify educational content with different tiers
pub fn verify_content(
    env: &Env,
    content_id: u64,
    verifier: Address,
    level: VerificationLevel,
) -> VerificationLevel {
    let mut content = get_content(env, content_id);

    // Prevent overwriting a higher verification level with a lower one
    if level <= content.verification_level {
        panic!("cannot overwrite a higher or equal verification level");
    }

    // Update the verification level
    content.verification_level = level;

    save_content(env, &content);

    // Emit verification event with the new level
    env.events()
        .publish((symbol_short!("VERIFY"),), (content_id, verifier, level));

    content.verification_level
}

// Verify content with reputation check and delegation
pub fn verify_content_advanced(
    env: &Env,
    content_id: u64,
    verifier: Address,
    level: VerificationLevel,
    delegated_by: Option<Address>,
    min_reputation: u32,
    expiration_secs: Option<u64>,
) -> VerificationLevel {
    // 1. Reputation check (mock: reputation always 100)
    let reputation = 100u32;
    if reputation < min_reputation {
        panic!("Verifier does not meet minimum reputation");
    }

    // 2. Delegation check if applicable
    if let Some(ref delegator) = delegated_by {
        let delegations: Vec<Delegation> = env
            .storage()
            .instance()
            .get(&AdvDataKey::Delegation(delegator.clone()))
            .unwrap_or(Vec::new(env));
        let now = env.ledger().timestamp();
        let valid = delegations
            .iter()
            .any(|d| d.delegatee == verifier && (d.until.is_none() || d.until.unwrap() > now));
        if !valid {
            panic!("Delegation not valid");
        }
    }

    // 3. Prevent downgrade
    let mut content = get_content(env, content_id);
    if level <= content.verification_level {
        panic!("cannot overwrite a higher or equal verification level");
    }

    // 4. Register VerificationRecord
    let mut records: Vec<VerificationRecord> = env
        .storage()
        .instance()
        .get(&AdvDataKey::VerificationRecord(content_id))
        .unwrap_or(Vec::new(env));
    let now = env.ledger().timestamp();
    let expiration = expiration_secs.map(|secs| now + secs);
    let record = VerificationRecord {
        verifier: verifier.clone(),
        level,
        timestamp: now,
        expiration,
        delegated_by: delegated_by.clone(),
        reputation_snapshot: Some(reputation),
    };
    records.push_back(record);
    env.storage()
        .instance()
        .set(&AdvDataKey::VerificationRecord(content_id), &records);

    // 5. Update verification_level in Content
    content.verification_level = level;
    save_content(env, &content);

    // 6. Emit event
    env.events().publish(
        (symbol_short!("ADV_VRFY"), content_id, verifier),
        level as u32,
    );

    level
}

// Renew verification (if expired or about to expire)
pub fn renew_verification(env: &Env, content_id: u64, verifier: Address, new_expiration_secs: u64) {
    let mut records: Vec<VerificationRecord> = env
        .storage()
        .instance()
        .get(&AdvDataKey::VerificationRecord(content_id))
        .unwrap_or(Vec::new(env));
    let now = env.ledger().timestamp();
    let mut found = false;
    for i in 0..records.len() {
        let mut rec = records.get(i).unwrap();
        if rec.verifier == verifier {
            rec.expiration = Some(now + new_expiration_secs);
            records.set(i, rec);
            found = true;
        }
    }
    if !found {
        panic!("No verification record found for this verifier");
    }
    env.storage()
        .instance()
        .set(&AdvDataKey::VerificationRecord(content_id), &records);
    env.events().publish(
        (symbol_short!("RENEW_VRF"), content_id, verifier),
        new_expiration_secs,
    );
}

// Delegate verification rights
pub fn delegate_verification(
    env: &Env,
    delegator: Address,
    delegatee: Address,
    until: Option<u64>,
) {
    let mut delegations: Vec<Delegation> = env
        .storage()
        .instance()
        .get(&AdvDataKey::Delegation(delegator.clone()))
        .unwrap_or(Vec::new(env));
    let now = env.ledger().timestamp();
    let delegation = Delegation {
        delegator: delegator.clone(),
        delegatee: delegatee.clone(),
        since: now,
        until,
    };
    delegations.push_back(delegation);
    env.storage()
        .instance()
        .set(&AdvDataKey::Delegation(delegator), &delegations);
    env.events()
        .publish((symbol_short!("DELEGATE"), delegatee), until.unwrap_or(0));
}

// Revoke delegation
pub fn revoke_delegation(env: &Env, delegator: Address, delegatee: Address) {
    let delegations: Vec<Delegation> = env
        .storage()
        .instance()
        .get(&AdvDataKey::Delegation(delegator.clone()))
        .unwrap_or(Vec::new(env));
    let mut new_delegations = Vec::new(env);
    for d in delegations.iter() {
        if d.delegatee != delegatee {
            new_delegations.push_back(d.clone());
        }
    }
    env.storage()
        .instance()
        .set(&AdvDataKey::Delegation(delegator), &new_delegations);
    env.events()
        .publish((symbol_short!("REVOKE_DG"), delegatee), ());
}
