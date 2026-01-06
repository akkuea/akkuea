use crate::error::ContractError;
use crate::events::*;
use crate::storage::{self, LearningProgress};
use soroban_sdk::{Address, Env, Vec};

// Validate completion status (0-100)
fn validate_completion_status(completion_status: u32) -> Result<(), ContractError> {
    if completion_status > 100 {
        return Err(ContractError::InvalidCompletionStatus);
    }
    Ok(())
}

// Validate token ID
fn validate_token_id(token_id: u64) -> Result<(), ContractError> {
    if token_id == 0 {
        return Err(ContractError::InvalidTokenId);
    }
    Ok(())
}

// Validate course ID
fn validate_course_id(course_id: u64) -> Result<(), ContractError> {
    if course_id == 0 {
        return Err(ContractError::InvalidCourseId);
    }
    Ok(())
}

/// Initialize learning progress for a user in a course
pub fn initialize_progress(
    env: &Env,
    user: &Address,
    course_id: u64,
    prerequisites: Vec<u64>,
    platform: &Address,
) -> Result<u64, ContractError> {
    validate_course_id(course_id)?;

    // Check if platform is authorized
    if !storage::is_platform(env, platform) {
        return Err(ContractError::NotAuthorizedPlatform);
    }

    // Check if user already has progress for this course
    if let Some(_) = storage::get_user_progress_token_id(env, user, course_id) {
        return Err(ContractError::ProgressAlreadyExists);
    }

    // Generate new token ID
    let token_id = storage::get_next_token_id(env);

    let timestamp = env.ledger().timestamp();

    let progress = LearningProgress {
        token_id,
        user: user.clone(),
        course_id,
        completion_status: 0,
        prerequisites: prerequisites.clone(),
        created_at: timestamp,
        updated_at: timestamp,
        nft_issued: false,
    };

    // Store progress
    storage::set_progress(env, &progress);
    storage::set_user_progress_token_id(env, user, course_id, token_id);

    Ok(token_id)
}

/// Update learning progress for a user
pub fn update_progress(
    env: &Env,
    token_id: u64,
    completion_status: u32,
    platform: &Address,
) -> Result<(), ContractError> {
    validate_token_id(token_id)?;
    validate_completion_status(completion_status)?;

    // Check if platform is authorized
    if !storage::is_platform(env, platform) {
        return Err(ContractError::NotAuthorizedPlatform);
    }

    // Get existing progress
    let mut progress =
        storage::get_progress(env, token_id).ok_or(ContractError::ProgressNotFound)?;

    // Update progress
    progress.completion_status = completion_status;
    progress.updated_at = env.ledger().timestamp();

    // Save updated progress
    storage::set_progress(env, &progress);

    // Emit event
    emit_progress_updated(
        env,
        token_id,
        progress.user.clone(),
        progress.course_id,
        completion_status,
    );

    Ok(())
}

/// Verify if user meets all prerequisites for a course
pub fn verify_prerequisites(
    env: &Env,
    user: &Address,
    course_id: u64,
) -> Result<bool, ContractError> {
    validate_course_id(course_id)?;

    // Get course prerequisites
    let prerequisites = storage::get_course_prerequisites(env, course_id);

    // If no prerequisites, return true
    if prerequisites.is_empty() {
        return Ok(true);
    }

    // Check each prerequisite
    for i in 0..prerequisites.len() {
        let prereq_id = prerequisites.get(i).unwrap();

        // Get user's progress for this prerequisite course
        let prereq_token_id = storage::get_user_progress_token_id(env, user, prereq_id);

        if let Some(token_id) = prereq_token_id {
            let prereq_progress =
                storage::get_progress(env, token_id).ok_or(ContractError::PrerequisiteNotFound)?;

            // Check if prerequisite course is completed (100%) and NFT issued
            if prereq_progress.completion_status < 100 || !prereq_progress.nft_issued {
                // Emit verification failed event
                emit_prerequisite_verified(env, user.clone(), course_id, prereq_id, false);
                return Ok(false);
            }

            // Emit verification success event for this prerequisite
            emit_prerequisite_verified(env, user.clone(), course_id, prereq_id, true);
        } else {
            // User hasn't started the prerequisite course
            emit_prerequisite_verified(env, user.clone(), course_id, prereq_id, false);
            return Ok(false);
        }
    }

    Ok(true)
}

/// Issue NFT upon course completion
pub fn issue_course_nft(env: &Env, token_id: u64, platform: &Address) -> Result<(), ContractError> {
    validate_token_id(token_id)?;

    // Check if platform is authorized
    if !storage::is_platform(env, platform) {
        return Err(ContractError::NotAuthorizedPlatform);
    }

    // Get progress
    let mut progress =
        storage::get_progress(env, token_id).ok_or(ContractError::ProgressNotFound)?;

    // Check if NFT already issued
    if progress.nft_issued {
        return Err(ContractError::NFTAlreadyIssued);
    }

    // Verify course completion
    if progress.completion_status < 100 {
        return Err(ContractError::CourseNotCompleted);
    }

    // Verify prerequisites
    let prerequisites_met = verify_prerequisites(env, &progress.user, progress.course_id)?;
    if !prerequisites_met {
        return Err(ContractError::PrerequisiteNotMet);
    }

    // Mark NFT as issued
    progress.nft_issued = true;
    progress.updated_at = env.ledger().timestamp();

    // Update storage
    storage::set_progress(env, &progress);
    storage::add_user_nft(env, &progress.user, token_id);
    storage::add_course_nft(env, progress.course_id, token_id);

    // Emit event
    emit_course_nft_issued(
        env,
        token_id,
        progress.user.clone(),
        progress.course_id,
        platform.clone(),
    );

    Ok(())
}

/// Get learning progress by token ID
pub fn get_progress(env: &Env, token_id: u64) -> Result<LearningProgress, ContractError> {
    validate_token_id(token_id)?;

    storage::get_progress(env, token_id).ok_or(ContractError::ProgressNotFound)
}

/// Get user's progress for a specific course
pub fn get_user_course_progress(
    env: &Env,
    user: &Address,
    course_id: u64,
) -> Result<LearningProgress, ContractError> {
    validate_course_id(course_id)?;

    let token_id = storage::get_user_progress_token_id(env, user, course_id)
        .ok_or(ContractError::ProgressNotFound)?;

    storage::get_progress(env, token_id).ok_or(ContractError::ProgressNotFound)
}

/// Get all NFTs issued to a user
pub fn get_user_nfts(env: &Env, user: &Address) -> Vec<u64> {
    storage::get_user_nfts(env, user)
}

/// Get all NFTs issued for a course
pub fn get_course_nfts(env: &Env, course_id: u64) -> Result<Vec<u64>, ContractError> {
    validate_course_id(course_id)?;
    Ok(storage::get_course_nfts(env, course_id))
}

/// Set prerequisites for a course (admin/platform only)
pub fn set_course_prerequisites(
    env: &Env,
    course_id: u64,
    prerequisites: Vec<u64>,
    platform: &Address,
) -> Result<(), ContractError> {
    validate_course_id(course_id)?;

    // Check if platform is authorized
    if !storage::is_platform(env, platform) {
        return Err(ContractError::NotAuthorizedPlatform);
    }

    // Validate prerequisite IDs
    for i in 0..prerequisites.len() {
        let prereq_id = prerequisites.get(i).unwrap();
        if prereq_id == 0 {
            return Err(ContractError::InvalidPrerequisite);
        }
        // Prevent self-reference
        if prereq_id == course_id {
            return Err(ContractError::InvalidPrerequisite);
        }
    }

    storage::set_course_prerequisites(env, course_id, &prerequisites);
    Ok(())
}

/// Add a learning platform
pub fn add_platform(env: &Env, admin: &Address, platform: &Address) -> Result<(), ContractError> {
    if !storage::is_admin(env, admin) {
        return Err(ContractError::AdminOnly);
    }

    storage::add_platform(env, platform);
    emit_platform_added(env, platform.clone(), admin.clone());

    Ok(())
}

/// Remove a learning platform
pub fn remove_platform(
    env: &Env,
    admin: &Address,
    platform: &Address,
) -> Result<(), ContractError> {
    if !storage::is_admin(env, admin) {
        return Err(ContractError::AdminOnly);
    }

    storage::remove_platform(env, platform);
    emit_platform_removed(env, platform.clone(), admin.clone());

    Ok(())
}

/// Check if address is authorized platform
pub fn is_platform(env: &Env, platform: &Address) -> bool {
    storage::is_platform(env, platform)
}
