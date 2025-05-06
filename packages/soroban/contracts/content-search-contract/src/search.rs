use soroban_sdk::{Env, String as SorobanString, Vec};

use crate::error::Error;
use crate::metadata::{Content, ContentStorage};
use crate::validate::{validate_subject, is_valid_tag};

pub fn search_content(env: &Env, subject: SorobanString) -> Result<Vec<Content>, Error> {
    // Validar el sujeto de búsqueda
    validate_subject(&subject)?;

    // Obtener todo el contenido
    let all_content = ContentStorage::get_all_content(env);
    let mut matching_content = Vec::new(env);

    // Convertir el sujeto a minúsculas para búsqueda case-insensitive
    let subject_lower = subject.to_lowercase();

    // Iterar sobre todo el contenido y buscar coincidencias
    for content in all_content.iter() {
        let content = content.unwrap();
        for tag in content.subject_tags.iter() {
            let tag = tag.unwrap();
            if is_valid_tag(&tag) {
                let tag_lower = tag.to_lowercase();
                if tag_lower.contains(&subject_lower) {
                    matching_content.push_back(content.clone());
                    break;
                }
            }
        }
    }

    if matching_content.is_empty() {
        return Err(Error::NoMatchingContent);
    }

    Ok(matching_content)
} 