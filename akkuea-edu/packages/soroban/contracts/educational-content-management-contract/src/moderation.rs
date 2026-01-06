use crate::storage::{AdvDataKey, Dispute, Flag, ModerationAction, ModerationStatus};
use soroban_sdk::{symbol_short, Address, Env, String, Vec};

// Flag content as inappropriate
pub fn flag_content(env: &Env, content_id: u64, flagger: Address, reason: String) {
    let mut flags: Vec<Flag> = env
        .storage()
        .instance()
        .get(&AdvDataKey::Flag(content_id))
        .unwrap_or(Vec::new(env));
    let flag = Flag {
        content_id,
        flagger: flagger.clone(),
        reason,
        timestamp: env.ledger().timestamp(),
    };
    flags.push_back(flag);
    env.storage()
        .instance()
        .set(&AdvDataKey::Flag(content_id), &flags);
    env.events()
        .publish((symbol_short!("FLAG"), content_id, flagger), ());
}

// Get flags of a content
pub fn get_flags(env: &Env, content_id: u64) -> Vec<Flag> {
    env.storage()
        .instance()
        .get(&AdvDataKey::Flag(content_id))
        .unwrap_or(Vec::new(env))
}

// Moderator action on flagged content
pub fn moderate_content(
    env: &Env,
    content_id: u64,
    moderator: Address,
    action: ModerationStatus,
    reason: String,
) {
    let mut history: Vec<ModerationAction> = env
        .storage()
        .instance()
        .get(&AdvDataKey::Moderation(content_id))
        .unwrap_or(Vec::new(env));
    let moderation = ModerationAction {
        content_id,
        moderator: moderator.clone(),
        action: action.clone(),
        reason,
        timestamp: env.ledger().timestamp(),
    };
    history.push_back(moderation);
    env.storage()
        .instance()
        .set(&AdvDataKey::Moderation(content_id), &history);
    env.events().publish(
        (symbol_short!("MODERATE"), content_id, moderator),
        action as u32,
    );
}

// Get moderation history of a content
pub fn get_moderation_history(env: &Env, content_id: u64) -> Vec<ModerationAction> {
    env.storage()
        .instance()
        .get(&AdvDataKey::Moderation(content_id))
        .unwrap_or(Vec::new(env))
}

// Create dispute on a moderation action
pub fn create_dispute(env: &Env, content_id: u64, creator: Address, reason: String) -> u64 {
    let dispute_id = env
        .storage()
        .instance()
        .get(&AdvDataKey::DisputeCounter)
        .unwrap_or(0u64);
    let dispute = Dispute {
        dispute_id,
        content_id,
        creator: creator.clone(),
        reason,
        status: ModerationStatus::UnderDispute,
        created_at: env.ledger().timestamp(),
        resolved_at: None,
        resolver: None,
    };
    env.storage()
        .instance()
        .set(&AdvDataKey::Dispute(dispute_id), &dispute);
    env.storage()
        .instance()
        .set(&AdvDataKey::DisputeCounter, &(dispute_id + 1));
    env.events()
        .publish((symbol_short!("DISPUTE"), content_id, creator), dispute_id);
    dispute_id
}

// Resolve dispute
pub fn resolve_dispute(env: &Env, dispute_id: u64, resolver: Address, approve: bool) {
    let mut dispute: Dispute = env
        .storage()
        .instance()
        .get(&AdvDataKey::Dispute(dispute_id))
        .expect("Dispute not found");
    if dispute.status != ModerationStatus::UnderDispute {
        panic!("Dispute already resolved");
    }
    dispute.status = if approve {
        ModerationStatus::Approved
    } else {
        ModerationStatus::Rejected
    };
    dispute.resolved_at = Some(env.ledger().timestamp());
    dispute.resolver = Some(resolver.clone());
    env.storage()
        .instance()
        .set(&AdvDataKey::Dispute(dispute_id), &dispute);
    env.events().publish(
        (symbol_short!("RESLV_DSP"), dispute.content_id, resolver),
        approve as u32,
    );
}

// Get dispute
pub fn get_dispute(env: &Env, dispute_id: u64) -> Option<Dispute> {
    env.storage()
        .instance()
        .get(&AdvDataKey::Dispute(dispute_id))
}
