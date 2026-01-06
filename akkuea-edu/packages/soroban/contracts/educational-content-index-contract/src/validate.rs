use soroban_sdk::{Env, String};

use crate::error::Error;
use crate::metadata::Content;

pub fn validate_subject(subject: &String) -> bool {
    !subject.is_empty() && subject.len() <= 100
}

pub fn validate_content(env: &Env, content: &Content) -> Result<(), Error> {
    // Validar título
    if content.title.is_empty() || content.title.len() > 200 {
        return Err(Error::InvalidInput);
    }

    // Validar descripción
    if content.description.is_empty() || content.description.len() > 1000 {
        return Err(Error::InvalidInput);
    }

    // Validar URL
    if content.content_url.is_empty() || content.content_url.len() > 500 {
        return Err(Error::InvalidInput);
    }

    // Validar tags
    if content.subject_tags.is_empty() {
        return Err(Error::InvalidInput);
    }

    // Validar cada tag
    for tag in content.subject_tags.iter() {
        if !is_valid_tag(&tag) {
            return Err(Error::InvalidInput);
        }
    }

    if content.author.is_some() && content.author.as_ref().unwrap().len() > 100 {
        return Err(Error::InvalidInput);
    }

    if let Some(level) = content.difficulty_level.as_ref() {
        let beginner = String::from_str(env, "Beginner");
        let intermediate = String::from_str(env, "Intermediate");
        let advanced = String::from_str(env, "Advanced");
        if *level != beginner && *level != intermediate && *level != advanced {
            return Err(Error::InvalidInput);
        }
    }

    Ok(())
}

pub fn is_valid_tag(tag: &String) -> bool {
    !tag.is_empty() && tag.len() <= 50
}
