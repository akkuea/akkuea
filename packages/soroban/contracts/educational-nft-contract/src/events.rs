use soroban_sdk::{contracttype, Address, Env, String,};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AchievementCreatedEvent {
    pub token_id: u64,
    pub user: Address,
    pub educator: Address,
    pub course_title: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AchievementUpdatedEvent {
    pub token_id: u64,
    pub user: Address,
    pub educator: Address,
    pub completion_status: u32,
    pub quiz_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CertificationIssuedEvent {
    pub token_id: u64,
    pub user: Address,
    pub educator: Address,
    pub course_title: String,
    pub completion_status: u32,
    pub average_score: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EducatorAddedEvent {
    pub educator: Address,
    pub admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EducatorRemovedEvent {
    pub educator: Address,
    pub admin: Address,
}

// Event emission functions
pub fn emit_achievement_created(
    env: &Env,
    token_id: u64,
    user: Address,
    educator: Address,
    course_title: String,
) {
    let event = AchievementCreatedEvent {
        token_id,
        user,
        educator,
        course_title,
    };
    env.events().publish(("achievement_created",), event);
}

pub fn emit_achievement_updated(
    env: &Env,
    token_id: u64,
    user: Address,
    educator: Address,
    completion_status: u32,
    quiz_count: u32,
) {
    let event = AchievementUpdatedEvent {
        token_id,
        user,
        educator,
        completion_status,
        quiz_count,
    };
    env.events().publish(("achievement_updated",), event);
}

pub fn emit_certification_issued(
    env: &Env,
    token_id: u64,
    user: Address,
    educator: Address,
    course_title: String,
    completion_status: u32,
    average_score: u32,
) {
    let event = CertificationIssuedEvent {
        token_id,
        user,
        educator,
        course_title,
        completion_status,
        average_score,
    };
    env.events().publish(("certification_issued",), event);
}

pub fn emit_educator_added(env: &Env, educator: Address, admin: Address) {
    let event = EducatorAddedEvent { educator, admin };
    env.events().publish(("educator_added",), event);
}

pub fn emit_educator_removed(env: &Env, educator: Address, admin: Address) {
    let event = EducatorRemovedEvent { educator, admin };
    env.events().publish(("educator_removed",), event);
}