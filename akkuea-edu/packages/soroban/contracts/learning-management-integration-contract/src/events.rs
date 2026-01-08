use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CourseNFTIssuedEvent {
    pub token_id: u64,
    pub user: Address,
    pub course_id: u64,
    pub platform: Address,
    pub issued_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PrerequisiteVerifiedEvent {
    pub user: Address,
    pub course_id: u64,
    pub prerequisite_id: u64,
    pub verified: bool,
    pub verified_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProgressUpdatedEvent {
    pub token_id: u64,
    pub user: Address,
    pub course_id: u64,
    pub completion_status: u32,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformAddedEvent {
    pub platform: Address,
    pub admin: Address,
    pub added_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformRemovedEvent {
    pub platform: Address,
    pub admin: Address,
    pub removed_at: u64,
}

// Event emission functions
pub fn emit_course_nft_issued(
    env: &Env,
    token_id: u64,
    user: Address,
    course_id: u64,
    platform: Address,
) {
    let event = CourseNFTIssuedEvent {
        token_id,
        user,
        course_id,
        platform,
        issued_at: env.ledger().timestamp(),
    };
    env.events().publish(("course_nft_issued",), event);
}

pub fn emit_prerequisite_verified(
    env: &Env,
    user: Address,
    course_id: u64,
    prerequisite_id: u64,
    verified: bool,
) {
    let event = PrerequisiteVerifiedEvent {
        user,
        course_id,
        prerequisite_id,
        verified,
        verified_at: env.ledger().timestamp(),
    };
    env.events().publish(("prerequisite_verified",), event);
}

pub fn emit_progress_updated(
    env: &Env,
    token_id: u64,
    user: Address,
    course_id: u64,
    completion_status: u32,
) {
    let event = ProgressUpdatedEvent {
        token_id,
        user,
        course_id,
        completion_status,
        updated_at: env.ledger().timestamp(),
    };
    env.events().publish(("progress_updated",), event);
}

pub fn emit_platform_added(env: &Env, platform: Address, admin: Address) {
    let event = PlatformAddedEvent {
        platform,
        admin,
        added_at: env.ledger().timestamp(),
    };
    env.events().publish(("platform_added",), event);
}

pub fn emit_platform_removed(env: &Env, platform: Address, admin: Address) {
    let event = PlatformRemovedEvent {
        platform,
        admin,
        removed_at: env.ledger().timestamp(),
    };
    env.events().publish(("platform_removed",), event);
}
