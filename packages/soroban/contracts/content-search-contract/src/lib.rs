mod error;
mod metadata;
mod search;
mod validate;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Env, String as SorobanString, Vec};

use crate::error::Error;
use crate::metadata::Content;
use crate::search::search_content;

#[contract]
pub struct ContentSearchContract;

#[contractimpl]
impl ContentSearchContract {
    pub fn search_content(env: Env, subject: SorobanString) -> Result<Vec<Content>, Error> {
        search_content(&env, subject)
    }

    pub fn add_content(
        env: Env,
        title: SorobanString,
        description: SorobanString,
        subject_tags: Vec<SorobanString>,
        content_url: SorobanString,
    ) -> Result<u64, Error> {
        // Generar un nuevo ID para el contenido
        let id = env.storage().instance().get::<u64>(&b"next_id").unwrap_or(0) + 1;
        env.storage().instance().set(&b"next_id", &id);

        // Crear el nuevo contenido
        let content = Content {
            id,
            title,
            description,
            subject_tags,
            content_url,
        };

        // Validar el contenido
        crate::validate::validate_content(&content)?;

        // Guardar el contenido
        crate::metadata::ContentStorage::set_content(&env, &content);

        Ok(id)
    }
} 