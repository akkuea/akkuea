pub mod engine;
pub mod filters;

// Re-export the main search functions for backward compatibility and new features
pub use engine::{search_content, search_content_advanced, search_content_partial, SearchMode};
