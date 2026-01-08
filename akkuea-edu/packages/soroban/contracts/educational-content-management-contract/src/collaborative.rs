use soroban_sdk::{Address, BytesN, Env, String, Vec};

use crate::{
    storage::{
        get_collaborative_permission, get_collaborative_submission, get_content,
        save_collaborative_permission, save_collaborative_submission, save_contribution_to_history,
        CollaboratorPermission, CollaboratorSubmission, Content, PermissionType, ReviewStatus,
    },
    versioning,
};

/// Grant permission to user for content collaboration
pub fn grant_permission(env: &Env, content_id: u64, owner: Address, collaborator: Address) -> bool {
    let content = get_content(env, content_id);
    if content.creator != owner {
        panic!("Only content creator can grant permissions");
    }

    let permission = CollaboratorPermission {
        collaborator: collaborator.clone(),
        content_id,
        permission_type: PermissionType::Collaborator,
        granted_by: owner,
        granted_date: env.ledger().timestamp(),
    };

    save_collaborative_permission(env, collaborator, content_id, &permission);
    true
}

/// Check if user has permission for content
pub fn has_permission_submit_with_content(env: &Env, user: &Address, content: &Content) -> bool {
    if content.creator == *user {
        return true;
    }

    let user_permission = get_collaborative_permission(env, user, content.id);

    user_permission.permission_type == PermissionType::Collaborator
}

/// Submit content update for review
pub fn submit_for_review(
    env: &Env,
    content_id: u64,
    submitter: Address,
    new_content_hash: BytesN<32>,
    new_subject_tags: Vec<String>,
    change_notes: String,
) -> bool {
    let content = get_content(env, content_id);

    if !has_permission_submit_with_content(env, &submitter, &content) {
        panic!("No permission to submit content for review");
    }

    let submission = CollaboratorSubmission {
        content_id,
        collaborator: submitter.clone(),
        submission_date: env.ledger().timestamp(),
        status: ReviewStatus::Pending,
        new_content_hash,
        new_subject_tags,
        change_notes,
        reviewer: None,
        review_date: None,
        review_feedback: None,
    };

    save_collaborative_submission(env, submitter.clone(), content_id, &submission);
    true
}

/// Accept or reject submission (creator only)
pub fn review_submission(
    env: &Env,
    content_id: u64,
    submitter: Address,
    reviewer: Address,
    accept: bool,
    feedback: String,
) -> bool {
    let content = get_content(env, content_id);
    if content.creator != reviewer {
        panic!("Only content creator can review submissions");
    }

    let mut submission = get_collaborative_submission(env, &submitter, content_id);
    if submission.status != ReviewStatus::Pending {
        panic!("Submission must be pending to review");
    }

    submission.reviewer = Some(reviewer.clone());
    submission.review_date = Some(env.ledger().timestamp());
    submission.review_feedback = Some(feedback);
    submission.status = if accept {
        ReviewStatus::Accepted
    } else {
        ReviewStatus::Rejected
    };

    save_collaborative_submission(
        env,
        submission.collaborator.clone(),
        content_id,
        &submission,
    );

    // save history after review
    save_contribution_to_history(env, &submission.collaborator, content_id, &submission);

    if accept {
        versioning::create_version(
            env,
            content_id,
            reviewer,
            content.title.clone(),
            submission.new_content_hash.clone(),
            submission.new_subject_tags.clone(),
            submission.change_notes.clone(),
        );
    }

    true
}
