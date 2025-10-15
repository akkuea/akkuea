use crate::storage::{get_next_content_id, save_content, Content, VerificationLevel};
use soroban_sdk::{symbol_short, Address, BytesN, Env, String, Vec};

// Publish new educational content
pub fn publish_content(
    env: &Env,
    creator: Address,
    title: String,
    content_hash: BytesN<32>,
    subject_tags: Vec<String>,
) -> u64 {
    // Get the next content ID
    let id = get_next_content_id(env);

    // Get current ledger timestamp for creation date
    let creation_date = env.ledger().timestamp();

    // Create new content
    let content = Content {
        id,
        creator: creator.clone(),
        title: title.clone(),
        content_hash: content_hash.clone(),
        creation_date,
        subject_tags,
        upvotes: 0,
        verification_level: VerificationLevel::None, // Default to no verification
    };

    // Store content
    save_content(env, &content);

    // Emit content published event
    env.events().publish(
        (symbol_short!("PUBLISH"),),
        (id, creator, title, content_hash),
    );

    // Return the content ID
    id
}
