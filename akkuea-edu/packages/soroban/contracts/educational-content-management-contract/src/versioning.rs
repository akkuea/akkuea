use soroban_sdk::{symbol_short, Address, BytesN, Env, String, Vec};

use crate::storage::{
    get_content, get_version_count, get_version_info, get_version_snapshot,
    has_user_voted_on_version, record_version_vote, save_content, save_version_count,
    save_version_info, save_version_snapshot, Content, ContentVersion, VerificationLevel,
    VersionDiff,
};

pub fn create_version(
    env: &Env,
    content_id: u64,
    creator: Address,
    title: String,
    content_hash: BytesN<32>,
    subject_tags: Vec<String>,
    change_notes: String,
) -> u32 {
    let current_content = get_content(env, content_id);

    if current_content.creator != creator {
        panic!("only the creator can create a new version");
    }

    // Get version count
    let version_count = get_version_count(env, content_id);
    let new_version = version_count + 1;

    // Save current content as snapshot of previous version
    save_version_snapshot(env, content_id, version_count, &current_content);

    // Create version record
    let version_record = ContentVersion {
        version: new_version,
        creator: creator.clone(),
        creation_date: env.ledger().timestamp(),
        change_notes,
        upvotes: 0,
        verification_level: VerificationLevel::None,
    };

    // Save version record and count
    save_version_info(env, content_id, new_version, &version_record);
    save_version_count(env, content_id, new_version);

    // Update main content to new version
    let mut updated_content = current_content;
    updated_content.title = title;
    updated_content.content_hash = content_hash;
    updated_content.subject_tags = subject_tags;

    save_content(env, &updated_content);

    env.events().publish(
        (symbol_short!("VERSION"),),
        (content_id, new_version, creator),
    );

    new_version
}

/// Get content as it was at a specific version
pub fn get_content_at_version(env: &Env, content_id: u64, version: u32) -> Content {
    let total_versions = get_version_count(env, content_id);

    if version > total_versions {
        panic!("version does not exist");
    }

    // If requesting current version, return current content
    if version == total_versions {
        return get_content(env, content_id);
    }

    // Otherwise get snapshot
    get_version_snapshot(env, content_id, version)
}

/// Upvote specific version
pub fn upvote_version(env: &Env, content_id: u64, version: u32, voter: Address) -> u32 {
    if has_user_voted_on_version(env, &voter, content_id, version) {
        panic!("already voted on this version");
    }

    record_version_vote(env, voter.clone(), content_id, version);
    let mut version_info = get_version_info(env, content_id, version);

    version_info.upvotes += 1;
    save_version_info(env, content_id, version, &version_info);

    env.events().publish(
        (symbol_short!("V_UPVOTE"),),
        (content_id, version, voter, version_info.upvotes),
    );

    version_info.upvotes
}

/// Verify specific version
pub fn verify_version(
    env: &Env,
    content_id: u64,
    version: u32,
    verifier: Address,
    level: VerificationLevel,
) -> VerificationLevel {
    let mut version_info = get_version_info(env, content_id, version);

    if level <= version_info.verification_level {
        panic!("cannot downgrade verification");
    }

    version_info.verification_level = level;
    save_version_info(env, content_id, version, &version_info);

    env.events().publish(
        (symbol_short!("V_VERIFY"),),
        (content_id, version, verifier, level),
    );

    level
}

/// Compare two versions
pub fn get_version_diff(
    env: &Env,
    content_id: u64,
    from_version: u32,
    to_version: u32,
) -> VersionDiff {
    let content1 = get_content_at_version(env, content_id, from_version);
    let content2 = get_content_at_version(env, content_id, to_version);

    // Should more information be included?
    VersionDiff {
        from_version,
        to_version,
        title_changed: content1.title != content2.title,
        content_changed: content1.content_hash != content2.content_hash,
    }
}
