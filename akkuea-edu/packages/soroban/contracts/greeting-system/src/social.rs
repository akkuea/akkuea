use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Vec, vec};

use crate::utils;

/// Represents a social interaction (like or comment) on a greeting
#[derive(Clone)]
#[contracttype]
pub struct SocialInteraction {
    pub greeting_id: u64,
    pub user: Address,
    pub action: String,        // "like" or "comment"
    pub comment_text: String,  // Comment content (empty for likes)
    pub timestamp: u64,
}

// Like a greeting
// Prevents duplicate likes from the same user
// Returns the updated like count
pub fn like_greeting(env: Env, greeting_id: u64, user: Address) -> u64 {
    // Require authentication
    user.require_auth();

    // Check if greeting exists
    if !greeting_exists(&env, greeting_id) {
        panic!("Greeting not found");
    }

    // Check if user has already liked this greeting
    if has_user_liked(env.clone(), greeting_id, user.clone()) {
        panic!("User has already liked this greeting");
    }

    // Mark user as having liked this greeting
    let like_tracker_key = (symbol_short!("LIKE_TRK"), greeting_id, user.clone());
    env.storage().persistent().set(&like_tracker_key, &true);

    // Increment like count
    let like_count_key = (symbol_short!("LIKE_CNT"), greeting_id);
    let mut like_count: u64 = env.storage().persistent().get(&like_count_key).unwrap_or(0);

    // Check for integer overflow before incrementing
    if like_count == u64::MAX {
        panic!("Maximum number of likes reached");
    }

    like_count += 1;
    env.storage().persistent().set(&like_count_key, &like_count);

    // Emit LikeEvent
    env.events().publish(
        (symbol_short!("like"),),
        (greeting_id, user.clone(), env.ledger().timestamp()),
    );

    like_count
}

/// Comment on a greeting
/// Validates comment text and stores it
/// Returns the new comment count
pub fn comment_on_greeting(env: Env, greeting_id: u64, user: Address, text: String) -> u64 {
    // Require authentication
    user.require_auth();

    // Check if greeting exists
    if !greeting_exists(&env, greeting_id) {
        panic!("Greeting not found");
    }

    // Validate comment using utils module
    utils::validate_comment(&text);

    // Create the social interaction
    let interaction = SocialInteraction {
        greeting_id,
        user: user.clone(),
        action: String::from_str(&env, "comment"),
        comment_text: text.clone(),
        timestamp: env.ledger().timestamp(),
    };

    // Get existing comments or create new vector
    let comments_key = (symbol_short!("COMMENTS"), greeting_id);
    let mut comments: Vec<SocialInteraction> = env
        .storage()
        .persistent()
        .get(&comments_key)
        .unwrap_or(vec![&env]);

    // Check comment limit (max 100 comments per greeting)
    if comments.len() >= 100 {
        panic!("Maximum comment limit reached (100 comments)");
    }

    // Add the new comment
    comments.push_back(interaction);

    // Store updated comments
    env.storage().persistent().set(&comments_key, &comments);

    // Emit CommentEvent
    env.events().publish(
        (symbol_short!("comment"),),
        (greeting_id, user.clone(), text, env.ledger().timestamp()),
    );

    comments.len() as u64
}

/// Get the like count for a greeting
pub fn get_like_count(env: Env, greeting_id: u64) -> u64 {
    let like_count_key = (symbol_short!("LIKE_CNT"), greeting_id);
    env.storage().persistent().get(&like_count_key).unwrap_or(0)
}

/// Get all comments for a greeting
pub fn get_comments(env: Env, greeting_id: u64) -> Vec<SocialInteraction> {
    let comments_key = (symbol_short!("COMMENTS"), greeting_id);
    env.storage()
        .persistent()
        .get(&comments_key)
        .unwrap_or(vec![&env])
}

/// Check if a user has liked a greeting
pub fn has_user_liked(env: Env, greeting_id: u64, user: Address) -> bool {
    let like_tracker_key = (symbol_short!("LIKE_TRK"), greeting_id, user);
    env.storage().persistent().get(&like_tracker_key).unwrap_or(false)
}

/// Helper function to check if a greeting exists
fn greeting_exists(env: &Env, greeting_id: u64) -> bool {
    env.storage().persistent().has(&(symbol_short!("GRT"), greeting_id))
}

