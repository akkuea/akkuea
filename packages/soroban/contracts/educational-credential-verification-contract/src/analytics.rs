use crate::datatype::{AnalyticsData, AnalyticsSnapshot, Educator, ReviewerPerformance};
use crate::storage::{ANALYTICS, EDUCATORS};
use soroban_sdk::{Address, Env, Map, Vec};

pub struct AnalyticsSystem;

impl AnalyticsSystem {
    pub fn get_analytics(env: &Env) -> AnalyticsData {
        env.storage()
            .persistent()
            .get(&ANALYTICS)
            .unwrap_or(AnalyticsData {
                current_snapshot: AnalyticsSnapshot {
                    timestamp: 0,
                    total_verifications: 0,
                    total_reviews: 0,
                    total_disputes: 0,
                },
                history: Vec::new(env),
                specialty_distribution: Map::new(env),
                reviewer_performance: Map::new(env),
            })
    }

    pub fn update_review_analytics(env: &Env, reviewer: &Address) {
        let mut analytics = Self::get_analytics(env);
        analytics.current_snapshot.total_reviews += 1;

        let mut performance = analytics
            .reviewer_performance
            .get(reviewer.clone())
            .unwrap_or(ReviewerPerformance {
                reviews_submitted: 0,
                disputes_received: 0,
            });
        performance.reviews_submitted += 1;
        analytics
            .reviewer_performance
            .set(reviewer.clone(), performance);

        env.storage().persistent().set(&ANALYTICS, &analytics);
    }

    pub fn update_dispute_analytics(env: &Env, reviewer: &Address) {
        let mut analytics = Self::get_analytics(env);
        analytics.current_snapshot.total_disputes += 1;

        let mut performance = analytics
            .reviewer_performance
            .get(reviewer.clone())
            .unwrap_or(ReviewerPerformance {
                reviews_submitted: 0,
                disputes_received: 0,
            });
        performance.disputes_received += 1;
        analytics
            .reviewer_performance
            .set(reviewer.clone(), performance);

        env.storage().persistent().set(&ANALYTICS, &analytics);
    }

    pub fn recalculate_all_analytics(env: &Env) {
        let educators: Map<Address, Educator> = env
            .storage()
            .persistent()
            .get(&EDUCATORS)
            .unwrap_or(Map::new(env));
        let mut total_verifications = 0;
        let mut specialty_distribution = Map::new(env);

        for (_, educator) in educators.iter() {
            if educator.verification_status {
                total_verifications += 1;
            }
            for specialty in educator.specialty_areas.iter() {
                let count = specialty_distribution.get(specialty.clone()).unwrap_or(0);
                specialty_distribution.set(specialty, count + 1);
            }
        }

        let mut analytics = Self::get_analytics(env);
        analytics.current_snapshot.total_verifications = total_verifications;
        analytics.specialty_distribution = specialty_distribution;

        // Create a historical snapshot for trend analysis.
        analytics.current_snapshot.timestamp = env.ledger().timestamp();
        analytics
            .history
            .push_back(analytics.current_snapshot.clone());

        env.storage().persistent().set(&ANALYTICS, &analytics);
    }
}
