use crate::error::ContractError;
use crate::storage;
use soroban_sdk::{contracttype, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneInfo {
    pub project_id: Option<u64>,
    pub milestone_id: Option<u64>,
    pub linked: bool,
    pub milestone_completed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum IntegrationKey {
    MilestoneLink(u64), // token_id -> MilestoneInfo
}

/// Link a learning progress with a milestone from milestone-finance-contract
pub fn link_progress_with_milestone(
    env: &Env,
    token_id: u64,
    project_id: u64,
    milestone_id: u64,
    platform: &soroban_sdk::Address,
) -> Result<(), ContractError> {
    // Verify platform authorization
    if !storage::is_platform(env, platform) {
        return Err(ContractError::NotAuthorizedPlatform);
    }

    // Verify progress exists
    let _progress = storage::get_progress(env, token_id).ok_or(ContractError::ProgressNotFound)?;

    // Create milestone info
    let milestone_info = MilestoneInfo {
        project_id: Some(project_id),
        milestone_id: Some(milestone_id),
        linked: true,
        milestone_completed: false,
    };

    // Store the link
    let key = IntegrationKey::MilestoneLink(token_id);
    env.storage().persistent().set(&key, &milestone_info);

    Ok(())
}

/// Notify that a milestone has been completed
pub fn notify_milestone_completion(
    env: &Env,
    token_id: u64,
    milestone_id: u64,
    platform: &soroban_sdk::Address,
) -> Result<(), ContractError> {
    // Verify platform authorization
    if !storage::is_platform(env, platform) {
        return Err(ContractError::NotAuthorizedPlatform);
    }

    // Get existing milestone info
    let key = IntegrationKey::MilestoneLink(token_id);
    let mut milestone_info: MilestoneInfo = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(ContractError::DataNotFound)?;

    // Verify the milestone ID matches
    if milestone_info.milestone_id != Some(milestone_id) {
        return Err(ContractError::InvalidInput);
    }

    // Mark milestone as completed
    milestone_info.milestone_completed = true;

    // Update storage
    env.storage().persistent().set(&key, &milestone_info);

    Ok(())
}

/// Get milestone information for a learning progress
pub fn get_milestone_info(env: &Env, token_id: u64) -> Result<MilestoneInfo, ContractError> {
    let key = IntegrationKey::MilestoneLink(token_id);

    env.storage()
        .persistent()
        .get(&key)
        .ok_or(ContractError::DataNotFound)
}
