use soroban_sdk::{Address, Env, String};

use crate::{
    storage::{is_greeting_flagged, is_moderator, load_content_flag, remove_content_flag, save_content_flag},
    utils::{get_current_timestamp, validate_flag_reason},
    ContentFlag, Error, FlagStatus,
    events::{emit_flag_resolved, emit_greeting_flagged},
};

/// Flags a greeting for inappropriate content.
/// Can be called by moderators or automated systems.
pub fn filter_greeting(env: Env, greeting_id: u64, reason: String, flagged_by: Address) -> Result<(), Error> {
    // Validate inputs
    validate_flag_reason(&reason)?;

    // Check if already flagged
    if is_greeting_flagged(&env, greeting_id) {
        return Err(Error::AlreadyFlagged);
    }

    // For now, allow any address to flag, but in production restrict to moderators
    // flagged_by.require_auth();

    let timestamp = get_current_timestamp(&env);

    let flag = ContentFlag {
        greeting_id,
        reason,
        flagged_by: flagged_by.clone(),
        status: FlagStatus::Pending,
        flagged_at: timestamp,
    };

    save_content_flag(&env, &flag)?;

    emit_greeting_flagged(&env, &flag)?;

    Ok(())
}

/// Resolves a flagged greeting.
/// Only moderators can resolve flags.
pub fn resolve_flag(env: Env, greeting_id: u64, approve: bool, resolved_by: Address) -> Result<(), Error> {
    resolved_by.require_auth();

    // Check if resolver is a moderator
    if !is_moderator(&env, &resolved_by) {
        return Err(Error::UnauthorizedModerator);
    }

    let mut flag = load_content_flag(&env, greeting_id)?;

    if flag.status != FlagStatus::Pending {
        return Err(Error::InvalidFlagStatus);
    }

    flag.status = if approve { FlagStatus::Approved } else { FlagStatus::Rejected };

    save_content_flag(&env, &flag)?;

    let timestamp = get_current_timestamp(&env);
    emit_flag_resolved(&env, greeting_id, &resolved_by, approve, timestamp)?;

    // If approved, remove the flag (content is flagged)
    // If rejected, keep the flag for record, or remove?
    // For simplicity, if rejected, remove the flag as it's not inappropriate.
    if !approve {
        remove_content_flag(&env, greeting_id)?;
    }

    Ok(())
}

/// Get the flag status of a greeting
pub fn get_flag_status(env: Env, greeting_id: u64) -> Option<ContentFlag> {
    load_content_flag(&env, greeting_id).ok()
}
