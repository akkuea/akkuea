use crate::achievement_storage;
use crate::error::ContractError;
use crate::events::*;
use crate::achievement_storage::*;
use crate::storage;
use soroban_sdk::{Address, Env, String, Vec};

// Validate completion status (0-100)
fn validate_completion_status(completion_status: u32) -> Result<(), ContractError> {
    if completion_status > 100 {
        return Err(ContractError::InvalidCompletionStatus);
    }
    Ok(())
}

// Validate quiz scores (0-100)
fn validate_quiz_results(quiz_results: &Vec<u32>) -> Result<(), ContractError> {
    for score in quiz_results.iter() {
        if score > 100 {
            return Err(ContractError::InvalidQuizScore);
        }
    }
    Ok(())
}

pub fn create_achievement(
    env: &Env,
    token_id: u64,
    user: &Address,
    educator: &Address,
    course_title: String,
) -> Result<(), ContractError> {
    if !storage::is_educator(env, educator) {
        return Err(ContractError::NotAuthorizedEducator);
    }

    if token_id == 0 {
        return Err(ContractError::InvalidTokenId);
    }

    // Check if achievement already exists
    if get_achievement(env, token_id).is_ok() {
        return Err(ContractError::AchievementAlreadyExists);
    }

    let timestamp = env.ledger().timestamp();

    let achievement = Achievement {
        token_id,
        user: user.clone(),
        educator: educator.clone(),
        course_title: course_title.clone(),
        completion_status: 0,
        quiz_results: Vec::new(env),
        certified: false,
        created_at: timestamp,
        updated_at: timestamp,
        certified_at: None,
    };

    set_achievement(env, &achievement);
    add_user_achievement(env, user, token_id);
    add_educator_achievement(env, educator, token_id);

    emit_achievement_created(
        env,
        token_id,
        user.clone(),
        educator.clone(),
        course_title,
    );

    Ok(())
}

pub fn update_achievement(
    env: &Env,
    token_id: u64,
    completion_status: u32,
    quiz_results: Vec<u32>,
    educator: &Address,
) -> Result<(), ContractError> {
    if !storage::is_educator(env, educator) {
        return Err(ContractError::NotAuthorizedEducator);
    }

    validate_completion_status(completion_status)?;
    validate_quiz_results(&quiz_results)?;

    
    let mut achievement = get_achievement(env, token_id)?;

    // Verify educator authorization for this achievement
    if achievement.educator != *educator {
        return Err(ContractError::EducatorOnly);
    }

    achievement.completion_status = completion_status;
    achievement.quiz_results = quiz_results.clone();
    achievement.updated_at = env.ledger().timestamp();

    set_achievement(env, &achievement);

    emit_achievement_updated(
        env,
        token_id,
        achievement.user.clone(),
        educator.clone(),
        completion_status,
        quiz_results.len() as u32,
    );

    Ok(())
}

pub fn issue_certification(
    env: &Env,
    token_id: u64,
    educator: &Address,
) -> Result<(), ContractError> {
    if !storage::is_educator(env, educator) {
        return Err(ContractError::NotAuthorizedEducator);
    }

    let mut achievement = get_achievement(env, token_id)?;

    // Verify educator authorization for this achievement
    if achievement.educator != *educator {
        return Err(ContractError::EducatorOnly);
    }

    if achievement.certified {
        return Err(ContractError::AlreadyCertified);
    }

    // Check if requirements are met (100% completion)
    if achievement.completion_status < 100 {
        return Err(ContractError::InvalidCompletionStatus);
    }

    achievement.certified = true;
    achievement.certified_at = Some(env.ledger().timestamp());
    achievement.updated_at = env.ledger().timestamp();

    set_achievement(env, &achievement);

    // Calculate average quiz score
    let mut total_score = 0u32;
    let quiz_count = achievement.quiz_results.len() as u32;
    
    for score in achievement.quiz_results.iter() {
        total_score += score;
    }
    
    let average_score = if quiz_count > 0 {
        total_score / quiz_count
    } else {
        0
    };

    emit_certification_issued(
        env,
        token_id,
        achievement.user.clone(),
        educator.clone(),
        achievement.course_title.clone(),
        achievement.completion_status,
        average_score,
    );

    Ok(())
}

pub fn verify_certification(
    env: &Env,
    token_id: u64,
) -> Result<bool, ContractError> {
    let achievement = get_achievement(env, token_id)?;
    Ok(achievement.certified)
}

pub fn add_educator(
    env: &Env,
    admin: &Address,
    educator: &Address,
) -> Result<(), ContractError> {
    if !storage::is_admin(env, admin) {
        return Err(ContractError::AdminOnly);
    }

    storage::add_educator(env, educator);
    emit_educator_added(env, educator.clone(), admin.clone());

    Ok(())
}

pub fn remove_educator(
    env: &Env,
    admin: &Address,
    educator: &Address,
) -> Result<(), ContractError> {
    if !storage::is_admin(env, admin) {
        return Err(ContractError::AdminOnly);
    }

    storage::remove_educator(env, educator);
    emit_educator_removed(env, educator.clone(), admin.clone());

    Ok(())
}

pub fn get_achievement(env: &Env, token_id: u64) -> Result<Achievement, ContractError> {
    match achievement_storage::get_achievement(env, token_id) {
        Some(achievement) => Ok(achievement),
        None => Err(ContractError::AchievementNotFound),
    }
}

pub fn get_user_achievements(
    env: &Env,
    user: &Address,
    offset: u32,
    limit: u32,
) -> Result<Vec<u64>, ContractError> {
    let all_achievements = achievement_storage::get_user_achievements(env, user);
    let mut result = Vec::new(env);
    
    let start = offset as usize;
    let end = (offset + limit) as usize;
    let achievements_len = all_achievements.len() as usize;
    
    for i in start..end.min(achievements_len) {
        if let Some(token_id) = all_achievements.get(i as u32) {
            result.push_back(token_id);
        }
    }

    Ok(result)
}

pub fn get_educator_achievements(
    env: &Env,
    educator: &Address,
    offset: u32,
    limit: u32,
) -> Result<Vec<u64>, ContractError> {
    let all_achievements = achievement_storage::get_educator_achievements(env, educator);
    let mut result = Vec::new(env);
    
    let start = offset as usize;
    let end = (offset + limit) as usize;
    let achievements_len = all_achievements.len() as usize;
    
    for i in start..end.min(achievements_len) {
        if let Some(token_id) = all_achievements.get(i as u32) {
            result.push_back(token_id);
        }
    }

    Ok(result)
}

pub fn is_educator(env: &Env, educator: &Address) -> bool {
    storage::is_educator(env, educator)
}