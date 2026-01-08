use soroban_sdk::{Address, Env, String, Vec};

use crate::{
    datatype::{Comment, Interaction},
    error::Error,
    events::{emit_comment_added, emit_greeting_liked},
    storage::{has_interaction, load_interaction, read_greeting, save_interaction},
    utils::{get_current_timestamp, verify_user_authorization},
};

const MAX_COMMENT_LENGTH: u32 = 500;

/// Add a like to a greeting
pub fn like_greeting(env: &Env, user: Address, greeting_id: u64) -> Result<(), Error> {
    // Verify user authorization
    verify_user_authorization(env, &user)?;

    // Check if greeting exists
    read_greeting(env, greeting_id)?;

    // Load or create interaction
    let mut interaction = if has_interaction(env, greeting_id) {
        load_interaction(env, greeting_id)?
    } else {
        Interaction {
            greeting_id,
            likes: 0,
            liked_by: Vec::new(env),
            comments: Vec::new(env),
        }
    };

    // Check if user already liked
    for i in 0..interaction.liked_by.len() {
        if let Some(addr) = interaction.liked_by.get(i) {
            if addr == user {
                return Err(Error::AlreadyLiked);
            }
        }
    }

    // Add like
    interaction.likes += 1;
    interaction.liked_by.push_back(user.clone());

    // Save interaction
    save_interaction(env, &interaction)?;

    // Emit event
    emit_greeting_liked(env, &user, greeting_id, interaction.likes)?;

    Ok(())
}

/// Add a comment to a greeting
pub fn add_comment(env: &Env, user: Address, greeting_id: u64, text: String) -> Result<(), Error> {
    // Verify user authorization
    verify_user_authorization(env, &user)?;

    // Validate comment text
    if text.is_empty() {
        return Err(Error::EmptyComment);
    }

    if text.len() > MAX_COMMENT_LENGTH {
        return Err(Error::CommentTooLong);
    }

    // Check if greeting exists
    read_greeting(env, greeting_id)?;

    // Load or create interaction
    let mut interaction = if has_interaction(env, greeting_id) {
        load_interaction(env, greeting_id)?
    } else {
        Interaction {
            greeting_id,
            likes: 0,
            liked_by: Vec::new(env),
            comments: Vec::new(env),
        }
    };

    // Create comment
    let timestamp = get_current_timestamp(env);
    let comment = Comment {
        author: user.clone(),
        text: text.clone(),
        timestamp,
    };

    // Add comment
    interaction.comments.push_back(comment);

    // Save interaction
    save_interaction(env, &interaction)?;

    // Emit event
    emit_comment_added(env, &user, greeting_id, &text, timestamp)?;

    Ok(())
}

/// Get interaction data for a greeting
pub fn get_interaction(env: &Env, greeting_id: u64) -> Result<Interaction, Error> {
    // Check if greeting exists
    read_greeting(env, greeting_id)?;

    // Return interaction or empty interaction if none exists
    if has_interaction(env, greeting_id) {
        load_interaction(env, greeting_id)
    } else {
        Ok(Interaction {
            greeting_id,
            likes: 0,
            liked_by: Vec::new(env),
            comments: Vec::new(env),
        })
    }
}

/// Get the number of likes for a greeting
pub fn get_likes_count(env: &Env, greeting_id: u64) -> Result<u32, Error> {
    let interaction = get_interaction(env, greeting_id)?;
    Ok(interaction.likes)
}

/// Get the number of comments for a greeting
pub fn get_comments_count(env: &Env, greeting_id: u64) -> Result<u32, Error> {
    let interaction = get_interaction(env, greeting_id)?;
    Ok(interaction.comments.len())
}
