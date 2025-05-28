#![no_std]

mod error;
mod metadata;
mod search;
mod validate;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Env, String, Vec, Symbol, symbol_short};

use crate::error::Error;
use crate::metadata::{Content, ContentStorage};
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
        
        search_content(&env, subject)
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
            title,
            description,
            subject_tags,
            content_url,
        };

        // Validar el contenido
        crate::validate::validate_content(&content)?;
        
        // Guardar el contenido
        ContentStorage::set_content(&env, &content);

        Ok(id)
    }
} 