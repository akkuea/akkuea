#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

mod publish;
mod vote;
mod verify;
mod storage;
mod versioning;
mod collaborative;
mod moderation;

use crate::storage::{CollaboratorPermission, CollaboratorSubmission, ContentVersion, VersionDiff};
pub use crate::storage::{Content, VerificationLevel};

#[contract]
pub struct TokenizedEducationalContent;

#[contractimpl]
impl TokenizedEducationalContent {
    pub fn publish_content(
        env: Env,
        creator: Address,
        title: String,
        content_hash: BytesN<32>,
        subject_tags: Vec<String>,
    ) -> u64 {
        creator.require_auth();
        publish::publish_content(&env, creator, title, content_hash, subject_tags)
    }

    pub fn upvote_content(env: Env, content_id: u64, voter: Address) -> u32 {
        voter.require_auth();
        vote::upvote_content(&env, content_id, voter)
    }

    pub fn verify_content(
        env: Env,
        content_id: u64,
        verifier: Address,
        level: VerificationLevel,
    ) -> VerificationLevel {
        verifier.require_auth();
        verify::verify_content(&env, content_id, verifier, level)
    }

    pub fn get_content(env: Env, content_id: u64) -> Content {
        storage::get_content(&env, content_id)
    }

    /// Filter and retrieve only verified content
    /// Returns a vector of all content items where verification_level > None
    /// This is a view-only function that does not modify contract state
    pub fn filter_by_verification(env: Env) -> Vec<Content> {
        let mut verified_content = Vec::new(&env);
        let all_content_ids = storage::get_all_content_ids(&env);

        for i in 0..all_content_ids.len() {
            let content_id = all_content_ids.get(i).unwrap();
            let content = storage::get_content(&env, content_id);

            if content.verification_level > VerificationLevel::None {
                verified_content.push_back(content);
            }
        }

        verified_content
    }


     pub fn filter_by_verification_level(env: Env, level: VerificationLevel) -> Vec<Content> {
        let mut filtered_content = Vec::new(&env);
        let all_content_ids = storage::get_all_content_ids(&env);

        for i in 0..all_content_ids.len() {
            let content_id = all_content_ids.get(i).unwrap();
            let content = storage::get_content(&env, content_id);

            if content.verification_level == level {
                filtered_content.push_back(content);
            }
        }

        filtered_content
    }

    /// Filter and retrieve content with upvotes greater than or equal to the minimum threshold
    /// Returns a vector of all content items where upvotes >= min_upvotes
    /// This is a view-only function that does not modify contract state
    pub fn filter_by_min_upvotes(env: Env, min_upvotes: u32) -> Vec<Content> {
        let mut popular_content = Vec::new(&env);
        let all_content_ids = storage::get_all_content_ids(&env);

        for i in 0..all_content_ids.len() {
            let content_id = all_content_ids.get(i).unwrap();
            let content = storage::get_content(&env, content_id);

            if content.upvotes >= min_upvotes {
                popular_content.push_back(content);
            }
        }

        popular_content
    }

    // === VERSIONING FUNCTIONS ===

    /// Create a new version of existing content.
    /// @param content_id: ID of the content to version
    /// @param creator: Address of the version creator (must authorize)
    /// @param title: Title for the new version
    /// @param content_hash: Hash of the new content data
    /// @param subject_tags: List of subject tags for the new version
    /// @param change_notes: Notes describing the changes
    /// @return: New version number
    pub fn create_new_version_content(
        env: Env,
        content_id: u64,
        creator: Address,
        title: String,
        content_hash: BytesN<32>,
        subject_tags: Vec<String>,
        change_notes: String,
    ) -> u32 {
        creator.require_auth();
        versioning::create_version(&env, content_id, creator, title, content_hash, subject_tags, change_notes)
    }

    /// Get content as it was at a specific version.
    /// @param content_id: ID of the content
    /// @param version: Version number to retrieve
    /// @return: Content struct at the specified version
    pub fn get_content_at_version(env: Env, content_id: u64, version: u32) -> Content {
        versioning::get_content_at_version(&env, content_id, version)
    }

    /// Get metadata for a specific content version.
    /// @param content_id: ID of the content
    /// @param version: Version number
    /// @return: ContentVersion struct with metadata
    pub fn get_version_info(env: Env, content_id: u64, version: u32) -> ContentVersion {
        storage::get_version_info(&env, content_id, version)
    }

    /// Upvote a specific version of content.
    /// @param content_id: ID of the content
    /// @param version: Version number to upvote
    /// @param voter: Address of the voter (must authorize)
    /// @return: Total upvotes for the version
    pub fn upvote_version(env: Env, content_id: u64, version: u32, voter: Address) -> u32 {
        voter.require_auth();
        versioning::upvote_version(&env, content_id, version, voter)
    }

    /// Verify a specific version of content at a given verification level.
    /// @param content_id: ID of the content
    /// @param version: Version number to verify
    /// @param verifier: Address of the verifier (must authorize)
    /// @param level: Desired verification level
    /// @return: New verification level of the version
    pub fn verify_version(
        env: Env,
        content_id: u64,
        version: u32,
        verifier: Address,
        level: VerificationLevel,
    ) -> VerificationLevel {
        verifier.require_auth();
        versioning::verify_version(&env, content_id, version, verifier, level)
    }

    /// Compare two versions of content and get their differences.
    /// @param content_id: ID of the content
    /// @param from_version: Base version number
    /// @param to_version: Target version number
    /// @return: VersionDiff struct describing the changes
    pub fn get_version_diff(env: Env, content_id: u64, from_version: u32, to_version: u32) -> VersionDiff {
        versioning::get_version_diff(&env, content_id, from_version, to_version)
    }

    // === COLLABORATION FUNCTIONS ===

    /// Grant permission to a user for content collaboration.
    /// @param content_id: ID of the content
    /// @param owner: Address of the content owner (must authorize)
    /// @param collaborator: Address of the collaborator to grant permission
    /// @return: true if permission granted
    pub fn grant_permission(
        env: Env,
        content_id: u64,
        owner: Address,
        collaborator: Address,
    ) -> bool {
        owner.require_auth();
        collaborative::grant_permission(&env, content_id, owner, collaborator)
    }

    /// Submit a content update for review by the content owner.
    /// @param content_id: ID of the content
    /// @param submitter: Address of the submitter (must authorize)
    /// @param new_content_hash: Hash of the updated content
    /// @param new_subject_tags: List of new subject tags
    /// @param change_notes: Notes describing the changes
    /// @return: true if submission successful
    pub fn submit_for_review(
        env: Env,
        content_id: u64,
        submitter: Address,
        new_content_hash: BytesN<32>,
        new_subject_tags: Vec<String>,
        change_notes: String,
    ) -> bool {
        submitter.require_auth();
        collaborative::submit_for_review(&env, content_id, submitter, new_content_hash, new_subject_tags, change_notes)
    }

    /// Accept or reject a submission for content update (creator only).
    /// @param content_id: ID of the content
    /// @param submitter: Address of the submitter
    /// @param reviewer: Address of the reviewer (must authorize, must be creator)
    /// @param accept: true to accept, false to reject
    /// @param feedback: Feedback message for the submitter
    /// @return: true if review processed
    pub fn review_submission(
        env: Env,
        content_id: u64,
        submitter: Address,
        reviewer: Address,
        accept: bool,
        feedback: String,
    ) -> bool {
        reviewer.require_auth();
        collaborative::review_submission(&env, content_id, submitter, reviewer, accept, feedback)
    }

    /// Check if a user has permission to submit content for review.
    /// @param user: Address of the user
    /// @param content_id: ID of the content
    /// @return: CollaboratorPermission struct
    pub fn get_collaborative_permission(env: Env, user: Address, content_id: u64) -> CollaboratorPermission {
        storage::get_collaborative_permission(&env, &user, content_id)
    }

    /// Get details of a collaborative submission for a content item.
    /// @param submitter: Address of the submitter
    /// @param content_id: ID of the content
    /// @return: CollaboratorSubmission struct
    pub fn get_collaborative_submission(env: Env, submitter: Address, content_id: u64) -> CollaboratorSubmission {
        storage::get_collaborative_submission(&env, &submitter, content_id)
    }

    /// Get the contribution history of a user for a specific content item.
    /// @param user: Address of the user (must authorize)
    /// @param content_id: ID of the content
    /// @return: Vector of CollaboratorSubmission structs
    pub fn get_user_contribution_history(
        env: Env, 
        user: Address, 
        content_id: u64
    ) -> Vec<CollaboratorSubmission> {
        user.require_auth();
        storage::get_user_content_contribution_history(&env, &user, content_id)
    }

    // --- Advanced Verification ---
    pub fn verify_content_advanced(
        env: Env,
        content_id: u64,
        verifier: Address,
        level: VerificationLevel,
        delegated_by: Option<Address>,
        min_reputation: u32,
        expiration_secs: Option<u64>,
    ) -> VerificationLevel {
        verify::verify_content_advanced(
            &env,
            content_id,
            verifier,
            level,
            delegated_by,
            min_reputation,
            expiration_secs,
        )
    }

    pub fn renew_verification(
        env: Env,
        content_id: u64,
        verifier: Address,
        new_expiration_secs: u64,
    ) {
        verify::renew_verification(&env, content_id, verifier, new_expiration_secs)
    }

    pub fn delegate_verification(
        env: Env,
        delegator: Address,
        delegatee: Address,
        until: Option<u64>,
    ) {
        verify::delegate_verification(&env, delegator, delegatee, until)
    }

    pub fn revoke_delegation(
        env: Env,
        delegator: Address,
        delegatee: Address,
    ) {
        verify::revoke_delegation(&env, delegator, delegatee)
    }

    // --- Moderation ---
    pub fn flag_content(
        env: Env,
        content_id: u64,
        flagger: Address,
        reason: String,
    ) {
        moderation::flag_content(&env, content_id, flagger, reason)
    }

    pub fn get_flags(env: Env, content_id: u64) -> Vec<crate::storage::Flag> {
        moderation::get_flags(&env, content_id)
    }

    pub fn moderate_content(
        env: Env,
        content_id: u64,
        moderator: Address,
        action: crate::storage::ModerationStatus,
        reason: String,
    ) {
        moderation::moderate_content(&env, content_id, moderator, action, reason)
    }

    pub fn get_moderation_history(env: Env, content_id: u64) -> Vec<crate::storage::ModerationAction> {
        moderation::get_moderation_history(&env, content_id)
    }

    pub fn create_dispute(
        env: Env,
        content_id: u64,
        creator: Address,
        reason: String,
    ) -> u64 {
        moderation::create_dispute(&env, content_id, creator, reason)
    }

    pub fn resolve_dispute(
        env: Env,
        dispute_id: u64,
        resolver: Address,
        approve: bool,
    ) {
        moderation::resolve_dispute(&env, dispute_id, resolver, approve)
    }

    pub fn get_dispute(env: Env, dispute_id: u64) -> Option<crate::storage::Dispute> {
        moderation::get_dispute(&env, dispute_id)
    }
}

#[cfg(test)]
mod tests;