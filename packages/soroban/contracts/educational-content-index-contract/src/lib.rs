#![no_std]

mod error;
mod events;
mod metadata;
mod search;
mod storage;
mod validate;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Env, String, Vec, Symbol, symbol_short};

use crate::error::Error;
use crate::events::{emit_content_added, emit_content_updated, emit_search_performed};
use crate::metadata::Content;
use crate::storage::ContentStorage;
use crate::search::search_content;

const INITIALIZED_KEY: Symbol = symbol_short!("INIT");

#[contract]
pub struct ContentSearchContract;

#[contractimpl]
impl ContentSearchContract {
    pub fn initialize(env: Env) {
        let storage = env.storage().instance();
        
        // Verificar si ya está inicializado
        if storage.has(&INITIALIZED_KEY) {
            panic!("Contract already initialized");
        }
        
        // Inicializar el almacenamiento
        ContentStorage::initialize(&env);
        
        // Marcar como inicializado
        storage.set(&INITIALIZED_KEY, &true);
        storage.extend_ttl(50, 100);
    }

    pub fn search_content(env: Env, subject: String) -> Result<Vec<Content>, Error> {
        // Verificar que el contrato está inicializado
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(Error::NotInitialized);
        }
        
        // Validar el subject
        if !crate::validate::validate_subject(&subject) {
            return Err(Error::InvalidInput);
        }
        
        let search_result = search_content(&env, subject.clone());
        
        // Emit search performed event regardless of result - don't let event errors break main logic
        let result_count = match &search_result {
            Ok(results) => results.len() as u32,
            Err(_) => 0,
        };
        
        // Attempt to emit event, but ignore any errors
        let _ = emit_search_performed(&env, subject, result_count);
        
        search_result
    }

    pub fn add_content(
        env: Env,
        title: String,
        description: String,
        subject_tags: Vec<String>,
        content_url: String,
    ) -> Result<u64, Error> {
        // Verificar que el contrato está inicializado
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(Error::NotInitialized);
        }

        // Obtener y actualizar el ID
        let storage = env.storage().instance();
        let id = storage.get::<Symbol, u64>(&symbol_short!("NEXT_ID")).unwrap_or(0) + 1;
        storage.set(&symbol_short!("NEXT_ID"), &id);

        // Crear el contenido
        let content = Content {
            id,
            title: title.clone(),
            description,
            subject_tags: subject_tags.clone(),
            content_url,
        };

        // Validar el contenido
        crate::validate::validate_content(&content)?;
        
        // Guardar el contenido
        ContentStorage::set_content(&env, &content);

        // Emit content added event - ignore any errors to not break main logic
        let _ = emit_content_added(&env, id, title, subject_tags);

        Ok(id)
    }

    pub fn update_content(
        env: Env,
        content_id: u64,
        title: Option<String>,
        description: Option<String>,
        subject_tags: Option<Vec<String>>,
        content_url: Option<String>,
    ) -> Result<(), Error> {
        // Verificar que el contrato está inicializado
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(Error::NotInitialized);
        }

        // Obtener el contenido existente
        let existing_content = ContentStorage::get_content_by_id(&env, content_id)
            .ok_or(Error::NoMatchingContent)?;

        let mut updated_fields = Vec::new(&env);
        
        // Crear el contenido actualizado
        let updated_content = Content {
            id: content_id,
            title: if let Some(new_title) = title {
                updated_fields.push_back(String::from_str(&env, "title"));
                new_title
            } else {
                existing_content.title
            },
            description: if let Some(new_description) = description {
                updated_fields.push_back(String::from_str(&env, "description"));
                new_description
            } else {
                existing_content.description
            },
            subject_tags: if let Some(new_tags) = subject_tags {
                updated_fields.push_back(String::from_str(&env, "subject_tags"));
                new_tags
            } else {
                existing_content.subject_tags
            },
            content_url: if let Some(new_url) = content_url {
                updated_fields.push_back(String::from_str(&env, "content_url"));
                new_url
            } else {
                existing_content.content_url
            },
        };

        // Validar el contenido actualizado
        crate::validate::validate_content(&updated_content)?;
        
        // Guardar el contenido actualizado
        ContentStorage::set_content(&env, &updated_content);

        // Emit content updated event - ignore any errors to not break main logic
        let _ = emit_content_updated(&env, content_id, updated_fields);

        Ok(())
    }
}