use crate::storage::{get_content, has_user_voted, record_user_vote, save_content};
use soroban_sdk::{symbol_short, Address, Env};

// Upvote content with duplicate vote protection
pub fn upvote_content(env: &Env, content_id: u64, voter: Address) -> u32 {
    // Check if content exists
    let mut content = get_content(env, content_id);

    // Check if user has already voted for this content
    if has_user_voted(env, &voter, content_id) {
        panic!("user has already voted for this content");
    }

    // Record the vote
    record_user_vote(env, voter.clone(), content_id);

    // Increment upvote count
    content.upvotes += 1;

    // Save updated content
    save_content(env, &content);

    // Emit upvote event
    env.events().publish(
        (symbol_short!("UPVOTE"),),
        (content_id, voter, content.upvotes),
    );

    // Return the new upvote count
    content.upvotes
}
