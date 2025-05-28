use soroban_sdk::{Env, String as SorobanString, Vec};
use crate::metadata::{Content, ContentStorage};
use crate::error::Error;

pub fn search_content(env: &Env, subject: SorobanString) -> Result<Vec<Content>, Error> {
    let contents = ContentStorage::get_all_content(env);
    let mut results = Vec::new(env);
    
    for content in contents.iter() {
        // Verificamos si el contenido tiene el tag buscado
        let mut found = false;
        for tag in content.subject_tags.iter() {
            if tag == subject {
                found = true;
                break;
            }
        }
        
        if found {
            results.push_back(content.clone());
        }
    }
    
    if results.is_empty() {
        Err(Error::NoMatchingContent)
    } else {
        Ok(results)
    }
} 