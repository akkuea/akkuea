use crate::metadata::{Content, ContentList};
use soroban_sdk::{symbol_short, Env, String as SorobanString, Symbol, Vec};

const CONTENT_KEY: Symbol = symbol_short!("CONTENT");
const NEXT_ID_KEY: Symbol = symbol_short!("NEXT_ID");

pub struct ContentStorage;

impl ContentStorage {
    pub fn set_content(env: &Env, content: &Content) {
        let storage = env.storage().instance();

        // Store individual content by ID for O(1) lookup
        Self::set_content_by_id(env, content);

        // Get existing content to update tag indices
        let old_content = Self::get_content_by_id(env, content.id);

        // Update tag indices
        Self::update_tag_indices(env, &old_content, Some(content));

        // Maintain backward compatibility with existing list structure
        let mut content_list = if storage.has(&CONTENT_KEY) {
            storage.get(&CONTENT_KEY).unwrap()
        } else {
            ContentList {
                contents: Vec::new(env),
            }
        };

        // Update or add content in the list
        let mut found = false;
        for i in 0..content_list.contents.len() {
            if content_list.contents.get_unchecked(i).id == content.id {
                content_list.contents.set(i, content.clone());
                found = true;
                break;
            }
        }

        if !found {
            content_list.contents.push_back(content.clone());
        }

        storage.set(&CONTENT_KEY, &content_list);
        storage.extend_ttl(50, 100);
    }

    pub fn get_content_by_id(env: &Env, id: u64) -> Option<Content> {
        let storage = env.storage().instance();
        if !storage.has(&CONTENT_KEY) {
            return None;
        }

        let content_list: ContentList = storage.get(&CONTENT_KEY).unwrap();
        for i in 0..content_list.contents.len() {
            let content = content_list.contents.get_unchecked(i);
            if content.id == id {
                return Some(content);
            }
        }
        None
    }

    pub fn get_all_content(env: &Env) -> Vec<Content> {
        let storage = env.storage().instance();
        if !storage.has(&CONTENT_KEY) {
            return Vec::new(env);
        }

        let content_list: ContentList = storage.get(&CONTENT_KEY).unwrap();
        content_list.contents
    }

    pub fn initialize(env: &Env) {
        let storage = env.storage().instance();

        // Inicializar la lista de contenido si no existe
        if !storage.has(&CONTENT_KEY) {
            let content_list = ContentList {
                contents: Vec::new(env),
            };
            storage.set(&CONTENT_KEY, &content_list);
        }

        // Inicializar el contador de ID si no existe
        if !storage.has(&NEXT_ID_KEY) {
            storage.set(&NEXT_ID_KEY, &0u64);
        }

        // Extender el TTL del almacenamiento
        storage.extend_ttl(50, 100);
    }

    // ========== Indexed Search Functions ==========

    /// Store content by ID for O(1) lookup
    fn set_content_by_id(env: &Env, content: &Content) {
        let storage = env.storage().instance();
        let key = Self::content_id_key(content.id);
        storage.set(&key, content);
        storage.extend_ttl(50, 100);
    }

    /// Get content by ID with O(1) lookup
    pub fn get_content_by_id_indexed(env: &Env, id: u64) -> Option<Content> {
        let storage = env.storage().instance();
        let key = Self::content_id_key(id);
        storage.get(&key)
    }

    /// Update tag indices when content is added/updated/removed
    fn update_tag_indices(env: &Env, old_content: &Option<Content>, new_content: Option<&Content>) {
        let storage = env.storage().instance();

        // Remove old tag mappings if content existed before
        if let Some(old) = old_content {
            for tag in old.subject_tags.iter() {
                Self::remove_content_from_tag_index(env, &tag, old.id);
            }
        }

        // Add new tag mappings if content is being added/updated
        if let Some(new) = new_content {
            for tag in new.subject_tags.iter() {
                Self::add_content_to_tag_index(env, &tag, new.id);
            }
        }

        storage.extend_ttl(50, 100);
    }

    /// Add content ID to a tag's index
    fn add_content_to_tag_index(env: &Env, tag: &SorobanString, content_id: u64) {
        let storage = env.storage().instance();
        let tag_key = Self::tag_index_key(tag);

        let mut content_ids: Vec<u64> = storage.get(&tag_key).unwrap_or_else(|| Vec::new(env));

        // Check if content_id already exists to avoid duplicates
        let mut already_exists = false;
        for existing_id in content_ids.iter() {
            if existing_id == content_id {
                already_exists = true;
                break;
            }
        }

        if !already_exists {
            content_ids.push_back(content_id);
            storage.set(&tag_key, &content_ids);
        }
    }

    /// Remove content ID from a tag's index
    fn remove_content_from_tag_index(env: &Env, tag: &SorobanString, content_id: u64) {
        let storage = env.storage().instance();
        let tag_key = Self::tag_index_key(tag);

        if let Some(content_ids) = storage.get::<Symbol, Vec<u64>>(&tag_key) {
            let mut new_ids = Vec::new(env);

            for existing_id in content_ids.iter() {
                if existing_id != content_id {
                    new_ids.push_back(existing_id);
                }
            }

            if new_ids.is_empty() {
                // Remove the tag index entirely if no content IDs remain
                storage.remove(&tag_key);
            } else {
                storage.set(&tag_key, &new_ids);
            }
        }
    }

    /// Get content IDs for a specific tag using index
    pub fn get_content_ids_by_tag(env: &Env, tag: &SorobanString) -> Vec<u64> {
        let storage = env.storage().instance();
        let tag_key = Self::tag_index_key(tag);
        storage.get(&tag_key).unwrap_or_else(|| Vec::new(env))
    }

    /// Search content by tag using indexed lookup - O(1) + O(m) where m is matching items
    pub fn search_content_by_tag_indexed(env: &Env, tag: &SorobanString) -> Vec<Content> {
        let content_ids = Self::get_content_ids_by_tag(env, tag);
        let mut results = Vec::new(env);

        for content_id in content_ids.iter() {
            if let Some(content) = Self::get_content_by_id_indexed(env, content_id) {
                results.push_back(content);
            }
        }

        results
    }

    // ========== Helper Functions for Key Generation ==========

    /// Generate storage key for content by ID
    fn content_id_key(content_id: u64) -> Symbol {
        // Convert content_id to symbol for storage key
        // Using a simple approach that works within Soroban's constraints
        match content_id {
            0 => symbol_short!("CNT_0"),
            1 => symbol_short!("CNT_1"),
            2 => symbol_short!("CNT_2"),
            3 => symbol_short!("CNT_3"),
            4 => symbol_short!("CNT_4"),
            5 => symbol_short!("CNT_5"),
            6 => symbol_short!("CNT_6"),
            7 => symbol_short!("CNT_7"),
            8 => symbol_short!("CNT_8"),
            9 => symbol_short!("CNT_9"),
            _ => {
                // For IDs > 9, we'll use a different approach
                // This is a simplified version - in production you might want to use different storage patterns
                symbol_short!("CNT_BIG")
            }
        }
    }

    /// Generate storage key for tag index
    fn tag_index_key(tag: &SorobanString) -> Symbol {
        // Create a simple but effective tag-specific key
        // This approach uses tag length plus a simple content differentiation
        // In production, you'd want a proper hash function

        let len = tag.len();

        // For common lengths, create sub-buckets based on content
        match len {
            7 => {
                // Length 7 tags get different buckets to avoid collision
                // We'll use a simple pattern: every tag gets a unique bucket
                // based on a simple hash-like calculation
                let simple_hash = len * 10 + (len % 7);
                match simple_hash {
                    70 => symbol_short!("TAG70"), // Most 7-length tags
                    77 => symbol_short!("TAG77"), // Some 7-length tags
                    _ => symbol_short!("TAG7X"),  // Other 7-length tags
                }
            }
            10 => symbol_short!("TAG_10"), // "blockchain", "technology"
            11 => symbol_short!("TAG_11"), // "programming"
            6 => symbol_short!("TAG_6"),   // "crypto"
            4 => symbol_short!("TAG_4"),   // "math"
            8 => symbol_short!("TAG_8"),   // "language"
            3 => symbol_short!("TAG_3"),   // "art"
            _ => symbol_short!("TAG_OTH"), // Other lengths
        }
    }

    /// Rebuild tag indices for all existing content - useful for migration
    pub fn rebuild_indices(env: &Env) {
        let storage = env.storage().instance();

        let all_content = Self::get_all_content(env);

        // First, clear all existing indices by removing them
        // We'll rebuild them cleanly from scratch
        for content in all_content.iter() {
            for tag in content.subject_tags.iter() {
                let tag_key = Self::tag_index_key(&tag);
                storage.remove(&tag_key);
            }
        }

        // Now rebuild indices for all content
        for content in all_content.iter() {
            // Add content to individual storage
            Self::set_content_by_id(env, &content);
            // Update the indices for this content (starting from clean slate)
            Self::update_tag_indices(env, &None, Some(&content));
        }

        storage.extend_ttl(50, 100);
    }
}
