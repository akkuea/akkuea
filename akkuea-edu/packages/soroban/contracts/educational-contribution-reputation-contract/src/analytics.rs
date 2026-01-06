use crate::error::Error;
use crate::types::*;
use soroban_sdk::{Env, Map, String, Vec};

/// Generate comprehensive reputation analytics for a user
pub fn generate_user_analytics(
    env: Env,
    user_id: u64,
    time_range_days: u32,
) -> Result<Analytics, Error> {
    // Verify user exists
    let user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;

    if time_range_days == 0 {
        return Err(Error::InvalidTimeRange);
    }

    let current_time = env.ledger().timestamp();
    let time_range_seconds = time_range_days as u64 * 86400;
    let start_time = if current_time >= time_range_seconds {
        current_time - time_range_seconds
    } else {
        0 // If current time is less than range, start from beginning
    };

    let mut analytics_data = Map::new(&env);
    let mut trends = Map::new(&env);

    // Calculate total reputation across all subjects
    let mut total_reputation = 0u32;
    let mut subject_count = 0u32;

    for (subject, _) in user.expertise_areas.iter() {
        let reputation_key = DataKey::Reputation(user_id, subject.clone());
        if let Some(reputation) = env
            .storage()
            .instance()
            .get::<DataKey, Reputation>(&reputation_key)
        {
            total_reputation += reputation.score;
            subject_count += 1;
        }
    }

    let average_reputation = if subject_count > 0 {
        total_reputation / subject_count
    } else {
        0
    };

    analytics_data.set(String::from_str(&env, "total_reputation"), total_reputation);
    analytics_data.set(
        String::from_str(&env, "average_reputation"),
        average_reputation,
    );
    analytics_data.set(String::from_str(&env, "subject_count"), subject_count);

    // Calculate reputation trends
    let trend_score = calculate_reputation_trend(&env, user_id, start_time, current_time)?;
    trends.set(current_time, trend_score);

    let analytics = Analytics {
        key: String::from_str(&env, "user_analytics"),
        data: analytics_data,
        trends,
        last_updated: current_time,
    };

    // Store analytics
    let analytics_key = DataKey::Analytics(String::from_str(&env, "user_analytics"));
    env.storage().instance().set(&analytics_key, &analytics);

    Ok(analytics)
}

/// Generate domain expertise mapping
pub fn generate_domain_expertise(env: Env, domain: String) -> Result<DomainExpertise, Error> {
    let mut experts = Map::new(&env);
    let mut total_score = 0u32;
    let mut contributor_count = 0u32;

    // Get all users and their expertise in this domain
    let mut user_id = 1u64;
    loop {
        let user_key = DataKey::User(user_id);
        if let Some(user) = env.storage().instance().get::<DataKey, User>(&user_key) {
            // Check if user has expertise in this domain
            if let Some(_expertise_level) = user.expertise_areas.get(domain.clone()) {
                let reputation_key = DataKey::Reputation(user_id, domain.clone());
                if let Some(reputation) = env
                    .storage()
                    .instance()
                    .get::<DataKey, Reputation>(&reputation_key)
                {
                    experts.set(user_id, reputation.score);
                    total_score += reputation.score;
                    contributor_count += 1;
                }
            }
            user_id += 1;
        } else {
            break;
        }
    }

    if contributor_count == 0 {
        return Err(Error::InsufficientData);
    }

    let average_score = total_score / contributor_count;

    let domain_expertise = DomainExpertise {
        domain: domain.clone(),
        experts,
        average_score,
        total_contributors: contributor_count,
    };

    // Store domain expertise
    let analytics_key = DataKey::Analytics(String::from_str(&env, "domain_analytics"));
    env.storage()
        .instance()
        .set(&analytics_key, &domain_expertise);

    Ok(domain_expertise)
}

/// Generate peer benchmarking for a user in a specific subject
pub fn generate_peer_benchmark(
    env: Env,
    user_id: u64,
    subject: String,
) -> Result<PeerBenchmark, Error> {
    // Get user's reputation in the subject
    let reputation_key = DataKey::Reputation(user_id, subject.clone());
    let user_reputation: Reputation = env
        .storage()
        .instance()
        .get(&reputation_key)
        .ok_or(Error::ReputationNotFound)?;

    // Collect all peer scores in the same subject
    let mut peer_scores = Vec::new(&env);
    let mut user_id_iter = 1u64;

    loop {
        let user_key = DataKey::User(user_id_iter);
        if let Some(_user) = env.storage().instance().get::<DataKey, User>(&user_key) {
            if user_id_iter != user_id {
                let peer_reputation_key = DataKey::Reputation(user_id_iter, subject.clone());
                if let Some(peer_reputation) = env
                    .storage()
                    .instance()
                    .get::<DataKey, Reputation>(&peer_reputation_key)
                {
                    peer_scores.push_back(peer_reputation.score);
                }
            }
            user_id_iter += 1;
        } else {
            break;
        }
    }

    if peer_scores.len() == 0 {
        return Err(Error::InsufficientData);
    }

    // Calculate peer average
    let mut total_peer_score = 0u32;
    for score in peer_scores.iter() {
        total_peer_score += score;
    }
    let peer_average = total_peer_score / peer_scores.len();

    // Calculate percentile and rank
    let mut better_peers = 0u32;
    for score in peer_scores.iter() {
        if score < user_reputation.score {
            better_peers += 1;
        }
    }

    let total_peers = peer_scores.len();
    let percentile = if total_peers > 0 {
        (better_peers * 100) / total_peers
    } else {
        0
    };
    let rank = total_peers - better_peers + 1;

    Ok(PeerBenchmark {
        user_id,
        subject,
        user_score: user_reputation.score,
        peer_average,
        percentile,
        rank,
        total_peers,
    })
}

/// Predict future reputation development
pub fn predict_reputation_development(
    env: Env,
    user_id: u64,
    subject: String,
    prediction_days: u32,
) -> Result<u32, Error> {
    if prediction_days == 0 {
        return Err(Error::InvalidTimeRange);
    }

    // Get reputation history
    let history_key = DataKey::ReputationHistory(user_id, subject.clone());
    let history: ReputationHistory = env
        .storage()
        .instance()
        .get(&history_key)
        .ok_or(Error::InsufficientData)?;

    if history.scores.len() < 2 {
        return Err(Error::InsufficientData);
    }

    // Simple linear trend calculation
    let mut timestamps = Vec::new(&env);
    let mut scores = Vec::new(&env);

    for (timestamp, score) in history.scores.iter() {
        timestamps.push_back(timestamp);
        scores.push_back(score);
    }

    // Calculate trend (simple linear regression)
    let n = timestamps.len() as u64;
    if n < 2 {
        return Err(Error::InsufficientData);
    }

    // Get the last two data points for trend calculation
    let last_timestamp = timestamps.get((n - 1) as u32).unwrap();
    let last_score = scores.get((n - 1) as u32).unwrap();
    let prev_timestamp = timestamps.get((n - 2) as u32).unwrap();
    let prev_score = scores.get((n - 2) as u32).unwrap();

    // Calculate rate of change
    let time_diff = last_timestamp - prev_timestamp;
    if time_diff == 0 {
        return Ok(last_score);
    }

    let score_diff = if last_score > prev_score {
        last_score - prev_score
    } else {
        0 // Prevent negative predictions
    };

    let rate_per_second = score_diff as f64 / time_diff as f64;
    let prediction_seconds = prediction_days as u64 * 86400;
    let predicted_increase = (rate_per_second * prediction_seconds as f64) as u32;

    let predicted_score = last_score + predicted_increase;

    // Cap prediction at reasonable maximum
    Ok(if predicted_score > 1000 {
        1000
    } else {
        predicted_score
    })
}

/// Get reputation trend analysis
pub fn get_reputation_trends(
    env: Env,
    user_id: u64,
    subject: String,
    days: u32,
) -> Result<Map<u64, u32>, Error> {
    let history_key = DataKey::ReputationHistory(user_id, subject);
    let history: ReputationHistory = env
        .storage()
        .instance()
        .get(&history_key)
        .ok_or(Error::InsufficientData)?;

    let current_time = env.ledger().timestamp();
    let start_time = current_time.saturating_sub(days as u64 * 86400);

    let mut trends = Map::new(&env);

    for (timestamp, score) in history.scores.iter() {
        if timestamp >= start_time {
            trends.set(timestamp, score);
        }
    }

    if trends.len() == 0 {
        return Err(Error::InsufficientData);
    }

    Ok(trends)
}

/// Calculate overall platform analytics
pub fn calculate_platform_analytics(env: Env) -> Result<Analytics, Error> {
    let mut total_users = 0u32;
    let mut verified_users = 0u32;
    let mut total_reputation = 0u32;
    let mut active_disputes = 0u32;
    let mut completed_recoveries = 0u32;

    // Count users and calculate statistics
    let mut user_id = 1u64;
    loop {
        let user_key = DataKey::User(user_id);
        if let Some(user) = env.storage().instance().get::<DataKey, User>(&user_key) {
            total_users += 1;
            if user.verified {
                verified_users += 1;
            }

            // Sum up user's total reputation
            for (subject, _) in user.expertise_areas.iter() {
                let reputation_key = DataKey::Reputation(user_id, subject);
                if let Some(reputation) = env
                    .storage()
                    .instance()
                    .get::<DataKey, Reputation>(&reputation_key)
                {
                    total_reputation += reputation.score;
                }
            }

            // Check recovery plan status
            let recovery_key = DataKey::RecoveryPlan(user_id);
            if let Some(recovery) = env
                .storage()
                .instance()
                .get::<DataKey, RecoveryPlan>(&recovery_key)
            {
                if recovery.completed {
                    completed_recoveries += 1;
                }
            }

            user_id += 1;
        } else {
            break;
        }
    }

    // Count active disputes
    let mut dispute_id = 1u64;
    loop {
        let dispute_key = DataKey::Dispute(dispute_id);
        if let Some(dispute) = env
            .storage()
            .instance()
            .get::<DataKey, Dispute>(&dispute_key)
        {
            if matches!(
                dispute.status,
                DisputeStatus::Pending | DisputeStatus::UnderReview
            ) {
                active_disputes += 1;
            }
            dispute_id += 1;
        } else {
            break;
        }
    }

    let mut analytics_data = Map::new(&env);
    analytics_data.set(String::from_str(&env, "total_users"), total_users);
    analytics_data.set(String::from_str(&env, "verified_users"), verified_users);
    analytics_data.set(String::from_str(&env, "total_reputation"), total_reputation);
    analytics_data.set(String::from_str(&env, "active_disputes"), active_disputes);
    analytics_data.set(
        String::from_str(&env, "completed_recoveries"),
        completed_recoveries,
    );

    let average_reputation = if total_users > 0 {
        total_reputation / total_users
    } else {
        0
    };
    analytics_data.set(
        String::from_str(&env, "average_reputation"),
        average_reputation,
    );

    let analytics = Analytics {
        key: String::from_str(&env, "platform"),
        data: analytics_data,
        trends: Map::new(&env),
        last_updated: env.ledger().timestamp(),
    };

    // Store platform analytics
    let analytics_key = DataKey::Analytics(String::from_str(&env, "platform"));
    env.storage().instance().set(&analytics_key, &analytics);

    Ok(analytics)
}

/// Helper function to calculate reputation trend
fn calculate_reputation_trend(
    env: &Env,
    user_id: u64,
    start_time: u64,
    end_time: u64,
) -> Result<u32, Error> {
    let mut total_trend = 0u32;
    let mut subject_count = 0u32;

    // Get user to iterate through their subjects
    let user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;

    for (subject, _) in user.expertise_areas.iter() {
        let history_key = DataKey::ReputationHistory(user_id, subject.clone());
        if let Some(history) = env
            .storage()
            .instance()
            .get::<DataKey, ReputationHistory>(&history_key)
        {
            let mut scores_in_range = Vec::new(env);

            for (timestamp, score) in history.scores.iter() {
                if timestamp >= start_time && timestamp <= end_time {
                    scores_in_range.push_back(score);
                }
            }

            if scores_in_range.len() >= 2 {
                let first_score = scores_in_range.get(0).unwrap();
                let last_score = scores_in_range.get(scores_in_range.len() - 1).unwrap();

                if last_score >= first_score {
                    total_trend += last_score - first_score;
                }
                subject_count += 1;
            }
        }
    }

    Ok(if subject_count > 0 {
        total_trend / subject_count
    } else {
        0
    })
}
