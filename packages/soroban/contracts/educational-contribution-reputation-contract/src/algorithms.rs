use soroban_sdk::{Env, Map, String};

use crate::error::Error;
use crate::storage;
use crate::types::*;

const TIME_DECAY_FACTOR_PERCENT: u32 = 95;
const TIME_DECAY_PERIOD_DAYS: u64 = 30;
const SECONDS_PER_DAY: u64 = 86400;
const NORMALIZATION_BASE: u32 = 1000;
const PERCENTAGE_BASE: u32 = 100;
const WEIGHT_PRECISION: u32 = 10000;

const WEIGHT_CODE: u32 = 100;
const WEIGHT_MENTORING: u32 = 120;
const WEIGHT_REVIEW: u32 = 90;
const WEIGHT_OTHER: u32 = 80;

const MULTIPLIER_TECHNICAL: u32 = 110;
const MULTIPLIER_COMMUNITY: u32 = 120;
const MULTIPLIER_GENERAL: u32 = 100;

const NEW_SCORE_RATIO: u32 = 30;
const EXISTING_SCORE_RATIO: u32 = 70;

const DOMAIN_RUST: &str = "rust";
const DOMAIN_JAVASCRIPT: &str = "javascript";
const DOMAIN_PYTHON: &str = "python";
const DOMAIN_SOROBAN: &str = "soroban";
const DOMAIN_BLOCKCHAIN: &str = "blockchain";
const DOMAIN_MENTORING: &str = "mentoring";
const DOMAIN_LEADERSHIP: &str = "leadership";

#[derive(Clone)]
pub enum ContributionType {
    Code,
    Mentoring,
    Review,
    Other,
}

impl ContributionType {
    pub fn get_weight(&self) -> u32 {
        match self {
            ContributionType::Code => WEIGHT_CODE,
            ContributionType::Mentoring => WEIGHT_MENTORING,
            ContributionType::Review => WEIGHT_REVIEW,
            ContributionType::Other => WEIGHT_OTHER,
        }
    }
}

#[derive(Clone)]
pub enum DomainType {
    Technical,
    Community,
    General,
}

impl DomainType {
    pub fn get_multiplier(&self) -> u32 {
        match self {
            DomainType::Technical => MULTIPLIER_TECHNICAL,
            DomainType::Community => MULTIPLIER_COMMUNITY,
            DomainType::General => MULTIPLIER_GENERAL,
        }
    }
}

/// Calculate weighted score using contribution type and domain multipliers
/// Formula: (base_score * contribution_weight * domain_multiplier) / WEIGHT_PRECISION
pub fn calculate_weighted_score(
    base_score: u32,
    contribution_type: ContributionType,
    domain_type: DomainType,
) -> u32 {
    let contribution_weight = contribution_type.get_weight();
    let domain_multiplier = domain_type.get_multiplier();

    let weighted_score =
        (base_score as u64 * contribution_weight as u64 * domain_multiplier as u64)
            / WEIGHT_PRECISION as u64;

    weighted_score as u32
}

pub fn calculate_current_reputation(
    env: &Env,
    user_id: u64,
    subject: String,
) -> Result<u32, Error> {
    apply_time_decay(env, user_id, subject)
}

/// Apply time-decay to most recent score with corner case handling
/// Time decay algorithm
/// Formula: score * (0.95)^periods, where periods = days_elapsed / 30
/// Reference: https://en.wikipedia.org/wiki/Exponential_decay
pub fn apply_time_decay(env: &Env, user_id: u64, subject: String) -> Result<u32, Error> {
    let history = storage::get_reputation_history(env, user_id, subject);

    if history.scores.is_empty() {
        return Err(Error::ReputationNotFound);
    }

    let current_time = env.ledger().timestamp();
    let mut latest_timestamp = 0u64;
    let mut latest_score = 0u32;

    for (timestamp, score) in history.scores.iter() {
        if timestamp > latest_timestamp {
            latest_timestamp = timestamp;
            latest_score = score;
        }
    }

    let days_elapsed = (current_time - latest_timestamp) / SECONDS_PER_DAY;
    let decay_periods = days_elapsed / TIME_DECAY_PERIOD_DAYS;

    let decayed_score = if decay_periods == 0 || latest_score == 0 {
        latest_score
    } else {
        // Limit decay periods to prevent extreme calculations (max ~2 years of decay)
        let safe_decay_periods = if decay_periods > 24 {
            24
        } else {
            decay_periods
        };

        // Calculate (95^periods / 100^periods) using integer arithmetic
        // We calculate numerator and denominator separately to maintain precision
        let decay_factor_num = TIME_DECAY_FACTOR_PERCENT.pow(safe_decay_periods as u32);
        let decay_factor_den = PERCENTAGE_BASE.pow(safe_decay_periods as u32);

        // Apply decay: score * (95^periods / 100^periods)
        let result = (latest_score as u64 * decay_factor_num as u64) / decay_factor_den as u64;

        // Ensure minimum score of 1 if original was non-zero
        if result == 0 && latest_score > 0 {
            1
        } else {
            result as u32
        }
    };

    Ok(decayed_score)
}

/// Normalize reputation scores across multiple domains
/// Formula: normalized = (domain_score * 1000) / max_score_found
pub fn normalize_reputation_across_domains(
    env: &Env,
    user_id: u64,
) -> Result<Map<String, u32>, Error> {
    let user = storage::get_user(env, user_id)?;
    let mut normalized_scores = Map::new(env);

    if user.expertise_areas.is_empty() {
        return Ok(normalized_scores);
    }

    let mut domain_scores = Map::new(env);
    let mut max_score_found = 0u32;
    let mut valid_domains = 0u32;

    for (domain, _level) in user.expertise_areas.iter() {
        if let Ok(current_score) = calculate_current_reputation(env, user_id, domain.clone()) {
            domain_scores.set(domain.clone(), current_score);
            valid_domains += 1;

            if current_score > max_score_found {
                max_score_found = current_score;
            }
        }
    }

    if valid_domains == 0 || max_score_found == 0 {
        return Ok(normalized_scores);
    }

    if valid_domains == 1 {
        for (domain, _score) in domain_scores.iter() {
            normalized_scores.set(domain, NORMALIZATION_BASE);
        }
        return Ok(normalized_scores);
    }

    for (domain, score) in domain_scores.iter() {
        let normalized_score = (score * NORMALIZATION_BASE) / max_score_found;
        normalized_scores.set(domain, normalized_score);
    }

    Ok(normalized_scores)
}

/// Calculate comprehensive reputation with weighted scoring and time decay
/// Formula: (weighted_score * 30% + existing_score * 70%) / 100
pub fn calculate_comprehensive_reputation(
    env: &Env,
    user_id: u64,
    subject: String,
    contribution_type: ContributionType,
    base_score: u32,
) -> Result<u32, Error> {
    if base_score == 0 {
        return Err(Error::InvalidInput);
    }

    let domain_type = parse_domain_type(env, subject.clone());
    let weighted_score = calculate_weighted_score(base_score, contribution_type, domain_type);

    if weighted_score == 0 {
        return Ok(1);
    }

    let existing_score = calculate_current_reputation(env, user_id, subject.clone()).unwrap_or(0);

    if existing_score == 0 {
        return Ok(weighted_score);
    }

    let combined_score = (weighted_score * NEW_SCORE_RATIO + existing_score * EXISTING_SCORE_RATIO)
        / PERCENTAGE_BASE;

    if combined_score == 0 {
        return Ok(1);
    }

    Ok(combined_score)
}

/// Update reputation using comprehensive algorithm
/// Formula: Combines weighted scoring with time decay
pub fn update_reputation_with_algorithms(
    env: Env,
    user_id: u64,
    subject: String,
    base_score: u32,
    contribution_type: ContributionType,
) -> Result<(), Error> {
    if base_score == 0 {
        return Err(Error::InvalidInput);
    }

    if subject.is_empty() {
        return Err(Error::InvalidInput);
    }

    let final_score = calculate_comprehensive_reputation(
        &env,
        user_id,
        subject.clone(),
        contribution_type,
        base_score,
    )?;

    if final_score == 0 {
        return Err(Error::InvalidInput);
    }

    let reputation = Reputation {
        user_id,
        subject: subject.clone(),
        score: final_score,
    };
    storage::store_reputation(&env, &reputation);

    let mut history = storage::get_reputation_history(&env, user_id, subject);
    let current_timestamp = env.ledger().timestamp();

    history.scores.set(current_timestamp, final_score);
    let update_log = String::from_str(&env, "Algorithm update with time decay");
    history.changes.set(current_timestamp, update_log);
    storage::store_reputation_history(&env, &history);

    Ok(())
}

pub fn parse_domain_type(env: &Env, domain: String) -> DomainType {
    let rust_str = String::from_str(env, DOMAIN_RUST);
    let js_str = String::from_str(env, DOMAIN_JAVASCRIPT);
    let python_str = String::from_str(env, DOMAIN_PYTHON);
    let soroban_str = String::from_str(env, DOMAIN_SOROBAN);
    let blockchain_str = String::from_str(env, DOMAIN_BLOCKCHAIN);
    let mentoring_str = String::from_str(env, DOMAIN_MENTORING);
    let leadership_str = String::from_str(env, DOMAIN_LEADERSHIP);

    if domain == rust_str
        || domain == js_str
        || domain == python_str
        || domain == soroban_str
        || domain == blockchain_str
    {
        DomainType::Technical
    } else if domain == mentoring_str || domain == leadership_str {
        DomainType::Community
    } else {
        DomainType::General
    }
}
