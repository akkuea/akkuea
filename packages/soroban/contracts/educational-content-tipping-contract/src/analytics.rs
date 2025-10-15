use crate::errors::TippingError;
use crate::storage;
use crate::utils::Utils;
use soroban_sdk::{contracttype, Address, Env, Map, String, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AnalyticsRecord {
    pub timestamp: u64,
    pub total_tips: i128,
    pub unique_tippers: u32,
    pub total_usd_value: i128,
    pub tip_count: u32,
    pub average_tip_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TimeBasedReport {
    pub period_type: String, // "daily", "weekly", "monthly"
    pub start_time: u64,
    pub end_time: u64,
    pub total_tips: i128,
    pub total_usd_value: i128,
    pub unique_tippers: u32,
    pub tip_count: u32,
    pub top_educators: Vec<(Address, i128)>,
    pub top_tokens: Vec<(Address, i128)>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TippingTrend {
    pub educator: Address,
    pub trend_type: String,      // "growth", "decline", "stable"
    pub percentage_change: i128, // percentage with 2 decimal places
    pub period_days: u32,
    pub current_amount: i128,
    pub previous_amount: i128,
    pub analysis_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EducatorAnalytics {
    pub educator: Address,
    pub total_lifetime_tips: i128,
    pub total_lifetime_usd: i128,
    pub unique_supporters: u32,
    pub average_tip_amount: i128,
    pub tips_last_30_days: i128,
    pub growth_rate: i128,
    pub top_supporters: Vec<(Address, i128)>,
    pub subscription_count: u32,
    pub goal_completion_rate: u32,
}

pub struct AnalyticsManager;

impl AnalyticsManager {
    /// Record tipping analytics for a specific period
    pub fn record_analytics(
        env: &Env,
        period_start: u64,
        period_end: u64,
    ) -> Result<(), TippingError> {
        let current_time = env.ledger().timestamp();

        if period_end > current_time {
            return Err(TippingError::InvalidInput);
        }

        let analytics = Self::calculate_period_analytics(env, period_start, period_end)?;

        // Store analytics record with timestamp as key
        storage::set_analytics_record(env, &period_start, &analytics);

        Ok(())
    }

    /// Calculate analytics for a specific time period
    fn calculate_period_analytics(
        env: &Env,
        start_time: u64,
        end_time: u64,
    ) -> Result<AnalyticsRecord, TippingError> {
        let all_tips = storage::get_all_tips_in_period(env, start_time, end_time);
        let mut total_tips = 0i128;
        let mut total_usd_value = 0i128;
        let mut unique_tippers = Vec::new(env);
        let tip_count = all_tips.len() as u32;

        for i in 0..all_tips.len() {
            if let Some(tip) = all_tips.get(i) {
                total_tips += tip.amount;

                // Calculate USD value if possible
                if let Ok(usd_val) =
                    crate::price_feeds::PriceFeed::calculate_usd_value(env, &tip.token, tip.amount)
                {
                    total_usd_value += usd_val;
                }

                // Track unique tippers
                let mut is_unique = true;
                for j in 0..unique_tippers.len() {
                    if let Some(tipper) = unique_tippers.get(j) {
                        if tipper == tip.from {
                            is_unique = false;
                            break;
                        }
                    }
                }
                if is_unique {
                    unique_tippers.push_back(tip.from.clone());
                }
            }
        }

        let average_tip_amount = if tip_count > 0 {
            total_tips / tip_count as i128
        } else {
            0
        };

        Ok(AnalyticsRecord {
            timestamp: start_time,
            total_tips,
            unique_tippers: unique_tippers.len() as u32,
            total_usd_value,
            tip_count,
            average_tip_amount,
        })
    }

    /// Generate time-based report (daily, weekly, monthly)
    pub fn generate_time_report(
        env: &Env,
        period_type: String,
        start_time: u64,
        end_time: u64,
    ) -> Result<TimeBasedReport, TippingError> {
        Utils::validate_time_period(&period_type)?;

        let analytics = Self::calculate_period_analytics(env, start_time, end_time)?;

        // Get top educators for the period
        let top_educators = Self::get_top_educators_for_period(env, start_time, end_time, 5);

        // Get top tokens for the period
        let top_tokens = Self::get_top_tokens_for_period(env, start_time, end_time, 5);

        Ok(TimeBasedReport {
            period_type,
            start_time,
            end_time,
            total_tips: analytics.total_tips,
            total_usd_value: analytics.total_usd_value,
            unique_tippers: analytics.unique_tippers,
            tip_count: analytics.tip_count,
            top_educators,
            top_tokens,
        })
    }

    /// Get top educators for a specific time period
    fn get_top_educators_for_period(
        env: &Env,
        start_time: u64,
        end_time: u64,
        limit: u32,
    ) -> Vec<(Address, i128)> {
        let all_tips = storage::get_all_tips_in_period(env, start_time, end_time);
        let mut educator_totals = Map::new(env);

        // Calculate totals for each educator
        for i in 0..all_tips.len() {
            if let Some(tip) = all_tips.get(i) {
                let current_total = educator_totals.get(tip.to.clone()).unwrap_or(0);
                educator_totals.set(tip.to.clone(), current_total + tip.amount);
            }
        }

        // Convert to Vec and sort
        let mut result = Vec::new(env);
        for (educator, total) in educator_totals.iter() {
            result.push_back((educator, total));
        }

        // Simple bubble sort for top educators
        Utils::sort_by_amount(&mut result);

        // Return top N educators
        let mut top_educators = Vec::new(env);
        let actual_limit = if limit < result.len() as u32 {
            limit
        } else {
            result.len() as u32
        };

        for i in 0..actual_limit {
            if let Some(item) = result.get(i) {
                top_educators.push_back(item);
            }
        }

        top_educators
    }

    /// Get top tokens for a specific time period
    fn get_top_tokens_for_period(
        env: &Env,
        start_time: u64,
        end_time: u64,
        limit: u32,
    ) -> Vec<(Address, i128)> {
        let all_tips = storage::get_all_tips_in_period(env, start_time, end_time);
        let mut token_totals = Map::new(env);

        for i in 0..all_tips.len() {
            if let Some(tip) = all_tips.get(i) {
                let current_total = token_totals.get(tip.token.clone()).unwrap_or(0);
                token_totals.set(tip.token.clone(), current_total + tip.amount);
            }
        }

        let mut result = Vec::new(env);
        for (token, total) in token_totals.iter() {
            result.push_back((token, total));
        }

        Utils::sort_by_amount(&mut result);

        let mut top_tokens = Vec::new(env);
        let actual_limit = if limit < result.len() as u32 {
            limit
        } else {
            result.len() as u32
        };

        for i in 0..actual_limit {
            if let Some(item) = result.get(i) {
                top_tokens.push_back(item);
            }
        }

        top_tokens
    }

    /// Analyze tipping trends for educators
    pub fn analyze_trends(
        env: &Env,
        educator: Address,
        period_days: u32,
    ) -> Result<TippingTrend, TippingError> {
        let current_time = env.ledger().timestamp();
        let period_seconds = period_days as u64 * 86400; // days to seconds

        // Current period
        let current_start = current_time - period_seconds;
        let current_analytics = Self::calculate_period_analytics(env, current_start, current_time)?;

        // Previous period
        let previous_start = current_start - period_seconds;
        let previous_end = current_start;
        let previous_analytics =
            Self::calculate_period_analytics(env, previous_start, previous_end)?;

        // Calculate percentage change
        let percentage_change = if previous_analytics.total_tips > 0 {
            ((current_analytics.total_tips - previous_analytics.total_tips) * 10000)
                / previous_analytics.total_tips
        } else if current_analytics.total_tips > 0 {
            10000 // 100% growth from zero
        } else {
            0
        };

        let trend_type = if percentage_change > 500 {
            // > 5%
            String::from_str(env, "growth")
        } else if percentage_change < -500 {
            // < -5%
            String::from_str(env, "decline")
        } else {
            String::from_str(env, "stable")
        };

        Ok(TippingTrend {
            educator,
            trend_type,
            percentage_change,
            period_days,
            current_amount: current_analytics.total_tips,
            previous_amount: previous_analytics.total_tips,
            analysis_timestamp: current_time,
        })
    }

    /// Get comprehensive educator analytics
    pub fn get_educator_analytics(
        env: &Env,
        educator: Address,
    ) -> Result<EducatorAnalytics, TippingError> {
        let current_time = env.ledger().timestamp();
        let thirty_days_ago = current_time - (30 * 86400);

        // Get all-time stats
        let educator_stats = storage::get_educator_stats(env, &educator).unwrap();

        // Get tips from last 30 days
        let recent_tips =
            storage::get_educator_tips_in_period(env, &educator, thirty_days_ago, current_time);
        let mut tips_last_30_days = 0i128;
        let mut unique_supporters = Vec::new(env);
        let mut supporter_totals = Map::new(env);

        for i in 0..recent_tips.len() {
            if let Some(tip) = recent_tips.get(i) {
                tips_last_30_days += tip.amount;

                // Track unique supporters
                let mut is_unique = true;
                for j in 0..unique_supporters.len() {
                    if let Some(supporter) = unique_supporters.get(j) {
                        if supporter == tip.from {
                            is_unique = false;
                            break;
                        }
                    }
                }
                if is_unique {
                    unique_supporters.push_back(tip.from.clone());
                }

                // Track supporter totals
                let current_total = supporter_totals.get(tip.from.clone()).unwrap_or(0);
                supporter_totals.set(tip.from.clone(), current_total + tip.amount);
            }
        }

        // Calculate growth rate
        let sixty_days_ago = current_time - (60 * 86400);
        let previous_month_tips =
            storage::get_educator_tips_in_period(env, &educator, sixty_days_ago, thirty_days_ago);
        let mut previous_month_total = 0i128;

        for i in 0..previous_month_tips.len() {
            if let Some(tip) = previous_month_tips.get(i) {
                previous_month_total += tip.amount;
            }
        }

        let growth_rate = if previous_month_total > 0 {
            ((tips_last_30_days - previous_month_total) * 10000) / previous_month_total
        } else if tips_last_30_days > 0 {
            10000
        } else {
            0
        };

        // Get top supporters
        let mut top_supporters = Vec::new(env);
        for (supporter, total) in supporter_totals.iter() {
            top_supporters.push_back((supporter, total));
        }
        Utils::sort_by_amount(&mut top_supporters);

        // Limit to top 5 supporters
        let mut limited_supporters = Vec::new(env);
        let limit = if top_supporters.len() < 5 {
            top_supporters.len()
        } else {
            5
        };
        for i in 0..limit {
            if let Some(supporter) = top_supporters.get(i) {
                limited_supporters.push_back(supporter);
            }
        }

        // Get subscription count
        let subscriptions = storage::get_educator_subscriptions(env, &educator);
        let mut active_subscription_count = 0u32;
        for i in 0..subscriptions.len() {
            if let Some(sub_id) = subscriptions.get(i) {
                if let Some(subscription) = storage::get_subscription(env, &sub_id) {
                    if subscription.is_active {
                        active_subscription_count += 1;
                    }
                }
            }
        }

        // Calculate goal completion rate
        let goals = storage::get_educator_goals(env, &educator);
        let mut completed_goals = 0u32;
        let mut total_goals = 0u32;

        for i in 0..goals.len() {
            if let Some(goal_id) = goals.get(i) {
                if let Some(goal) = storage::get_tip_goal(env, &goal_id) {
                    total_goals += 1;
                    if goal.current_amount >= goal.target_amount {
                        completed_goals += 1;
                    }
                }
            }
        }

        let goal_completion_rate = if total_goals > 0 {
            (completed_goals * 100) / total_goals
        } else {
            0
        };

        Ok(EducatorAnalytics {
            educator,
            total_lifetime_tips: educator_stats.total_tips,
            total_lifetime_usd: educator_stats.total_amount,
            unique_supporters: unique_supporters.len() as u32,
            average_tip_amount: if educator_stats.tip_count > 0 {
                educator_stats.total_tips / educator_stats.tip_count as i128
            } else {
                0
            },
            tips_last_30_days,
            growth_rate,
            top_supporters: limited_supporters,
            subscription_count: active_subscription_count,
            goal_completion_rate,
        })
    }

    /// Get analytics record for a specific timestamp
    pub fn get_analytics_record(env: &Env, timestamp: u64) -> Option<AnalyticsRecord> {
        storage::get_analytics_record(env, &timestamp)
    }

    /// Get multiple analytics records for trend analysis
    pub fn get_analytics_history(
        env: &Env,
        start_time: u64,
        end_time: u64,
        interval_seconds: u64,
    ) -> Vec<AnalyticsRecord> {
        let mut result = Vec::new(env);
        let mut current_time = start_time;

        while current_time <= end_time {
            if let Some(record) = Self::get_analytics_record(env, current_time) {
                result.push_back(record);
            }
            current_time += interval_seconds;
        }

        result
    }
}
