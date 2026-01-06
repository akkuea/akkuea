use soroban_sdk::{contracttype, String, Vec};

// #[contracttype]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub enum DifficultyLevel {
//     Beginner,
//     Intermediate,
//     Advanced,
// }

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Content {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub subject_tags: Vec<String>,
    pub content_url: String,
    pub author: Option<String>,
    pub difficulty_level: Option<String>,
    pub creation_date: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentList {
    pub contents: Vec<Content>,
}
