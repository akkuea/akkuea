use soroban_sdk::{contracttype, Env, Map, String as SorobanString, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Content {
    pub id: u64,
    pub title: SorobanString,
    pub description: SorobanString,
    pub subject_tags: Vec<SorobanString>,
    pub content_url: SorobanString,
}

pub struct ContentStorage;

impl ContentStorage {
    pub fn get_content(env: &Env, id: u64) -> Option<Content> {
        let storage = env.storage().instance();
        storage.get(&id)
    }

    pub fn set_content(env: &Env, content: &Content) {
        let storage = env.storage().instance();
        storage.set(&content.id, content);
    }

    pub fn get_all_content(env: &Env) -> Vec<Content> {
        let storage = env.storage().instance();
        let mut contents = Vec::new(env);
        
        // Aquí implementaríamos la lógica para obtener todo el contenido
        // Por ahora retornamos un vector vacío
        contents
    }
} 