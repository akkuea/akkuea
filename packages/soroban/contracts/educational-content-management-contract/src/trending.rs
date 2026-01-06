use soroban_sdk::{vec, Env, String, Vec};

use crate::storage::{
    content_exists, get_all_content_ids, get_content_analytics, get_time_based_metrics,
    get_trending_content, get_trending_snapshot, save_trending_content, save_trending_snapshot,
    ContentAnalytics, TimeBasedMetrics, TimePeriod, TrendingContent, TrendingPeriod,
    TrendingSnapshot,
};

/// Trending module for calculating and managing trending content
pub struct Trending;

impl Trending {
    /// Calculate trending score for a content item
    pub fn calculate_trending_score(
        env: &Env,
        content_id: u64,
        period: TrendingPeriod,
    ) -> Result<u32, String> {
        if !content_exists(env, content_id) {
            return Err(String::from_str(env, "Content does not exist"));
        }

        let analytics = get_content_analytics(env, content_id)
            .ok_or_else(|| String::from_str(env, "Analytics not found for content"))?;

        let current_time = env.ledger().timestamp();
        let time_window = Self::get_time_window_for_period(period);
        let start_time = if current_time > time_window {
            current_time - time_window
        } else {
            0
        };

        // Get recent engagement metrics
        let recent_metrics =
            Self::get_recent_engagement_metrics(env, content_id, start_time, current_time)?;

        // Calculate trending score components
        let engagement_score = Self::calculate_engagement_score(&analytics, &recent_metrics);
        let velocity_score =
            Self::calculate_velocity_score(&analytics, &recent_metrics, time_window);
        let time_weighted_score = Self::calculate_time_weighted_score(&analytics, current_time);

        // Combine scores with weights
        let trending_score =
            (engagement_score * 40 + velocity_score * 40 + time_weighted_score * 20) / 100;

        Ok(trending_score)
    }

    /// Update trending content for a specific period
    pub fn update_trending_content(
        env: &Env,
        content_id: u64,
        period: TrendingPeriod,
    ) -> Result<(), String> {
        let trending_score = Self::calculate_trending_score(env, content_id, period)?;
        let analytics = get_content_analytics(env, content_id)
            .ok_or_else(|| String::from_str(env, "Analytics not found for content"))?;

        let current_time = env.ledger().timestamp();
        let time_window = Self::get_time_window_for_period(period);
        let start_time = if current_time > time_window {
            current_time - time_window
        } else {
            0
        };

        let recent_metrics =
            Self::get_recent_engagement_metrics(env, content_id, start_time, current_time)?;

        let velocity_score =
            Self::calculate_velocity_score(&analytics, &recent_metrics, time_window);
        let time_weighted_score = Self::calculate_time_weighted_score(&analytics, current_time);

        let trending_content = TrendingContent {
            content_id,
            trending_score,
            velocity_score,
            time_weighted_score,
            period,
            calculated_at: current_time,
        };

        save_trending_content(env, &trending_content);
        Ok(())
    }

    /// Get trending content for a specific period
    pub fn get_trending_content(
        env: &Env,
        period: TrendingPeriod,
        limit: u32,
    ) -> Vec<TrendingContent> {
        let all_content_ids = get_all_content_ids(env);
        let mut trending_list = Vec::new(env);

        // Collect trending data for all content
        for i in 0..all_content_ids.len() {
            let content_id = all_content_ids.get(i).unwrap();
            if let Some(trending) = get_trending_content(env, content_id, period) {
                trending_list.push_back(trending);
            }
        }

        // Sort by trending score (descending)
        Self::sort_trending_by_score(&mut trending_list);

        // Return top results
        let mut result = Vec::new(env);
        let max_items = if trending_list.len() > limit {
            limit
        } else {
            trending_list.len()
        };

        for i in 0..max_items {
            result.push_back(trending_list.get(i).unwrap());
        }

        result
    }

    /// Create a trending snapshot for a specific period
    pub fn create_trending_snapshot(
        env: &Env,
        period: TrendingPeriod,
    ) -> Result<TrendingSnapshot, String> {
        let trending_content = Self::get_trending_content(env, period, 50); // Top 50
        let current_time = env.ledger().timestamp();

        let mut content_ids = Vec::new(env);
        let mut scores = Vec::new(env);

        for i in 0..trending_content.len() {
            let content = trending_content.get(i).unwrap();
            content_ids.push_back(content.content_id);
            scores.push_back(content.trending_score);
        }

        let snapshot = TrendingSnapshot {
            period,
            timestamp: current_time,
            trending_content_ids: content_ids,
            scores,
        };

        save_trending_snapshot(env, &snapshot);
        Ok(snapshot)
    }

    /// Get trending snapshot for a specific period and timestamp
    pub fn get_trending_snapshot(
        env: &Env,
        period: TrendingPeriod,
        timestamp: u64,
    ) -> Option<TrendingSnapshot> {
        get_trending_snapshot(env, period, timestamp)
    }

    /// Update trending content for all periods
    pub fn update_all_trending_content(env: &Env, content_id: u64) -> Result<(), String> {
        Self::update_trending_content(env, content_id, TrendingPeriod::Daily)?;
        Self::update_trending_content(env, content_id, TrendingPeriod::Weekly)?;
        Self::update_trending_content(env, content_id, TrendingPeriod::Monthly)?;
        Ok(())
    }

    /// Get trending content by category
    pub fn get_trending_content_by_category(
        env: &Env,
        category: &String,
        period: TrendingPeriod,
        limit: u32,
    ) -> Vec<TrendingContent> {
        let all_trending = Self::get_trending_content(env, period, 100); // Get more to filter
        let mut category_trending = Vec::new(env);

        for i in 0..all_trending.len() {
            let trending = all_trending.get(i).unwrap();
            let content = crate::storage::get_content(env, trending.content_id);

            // Check if content belongs to the category
            for j in 0..content.subject_tags.len() {
                let tag = content.subject_tags.get(j).unwrap();
                if tag == *category {
                    category_trending.push_back(trending);
                    break;
                }
            }

            // Stop if we have enough results
            if category_trending.len() >= limit {
                break;
            }
        }

        category_trending
    }

    // Private helper methods

    /// Get time window in seconds for a trending period
    fn get_time_window_for_period(period: TrendingPeriod) -> u64 {
        match period {
            TrendingPeriod::Daily => 24 * 60 * 60,        // 24 hours
            TrendingPeriod::Weekly => 7 * 24 * 60 * 60,   // 7 days
            TrendingPeriod::Monthly => 30 * 24 * 60 * 60, // 30 days
        }
    }

    /// Get recent engagement metrics for a content item
    fn get_recent_engagement_metrics(
        env: &Env,
        content_id: u64,
        start_time: u64,
        end_time: u64,
    ) -> Result<TimeBasedMetrics, String> {
        // This is a simplified implementation
        // In a real system, you'd aggregate metrics from multiple time periods
        let mut total_views = 0;
        let mut total_upvotes = 0;
        let mut total_downvotes = 0;

        // Get metrics for different time periods within the window
        let periods = vec![&env, TimePeriod::Hourly, TimePeriod::Daily];

        for period in periods {
            if let Some(metrics) = get_time_based_metrics(env, content_id, end_time, period) {
                if metrics.timestamp >= start_time {
                    total_views += metrics.views;
                    total_upvotes += metrics.upvotes;
                    total_downvotes += metrics.downvotes;
                }
            }
        }

        Ok(TimeBasedMetrics {
            content_id,
            timestamp: end_time,
            views: total_views,
            upvotes: total_upvotes,
            downvotes: total_downvotes,
            period: TimePeriod::Daily, // Default period
        })
    }

    /// Calculate engagement score (scaled)
    fn calculate_engagement_score(
        _analytics: &ContentAnalytics,
        recent_metrics: &TimeBasedMetrics,
    ) -> u32 {
        let total_engagement = recent_metrics.upvotes + recent_metrics.downvotes;
        if recent_metrics.views == 0 {
            return 0;
        }

        let engagement_rate = (total_engagement as u64 * 10000) / recent_metrics.views as u64;
        engagement_rate as u32
    }

    /// Calculate velocity score (rate of change)
    fn calculate_velocity_score(
        _analytics: &ContentAnalytics,
        recent_metrics: &TimeBasedMetrics,
        time_window: u64,
    ) -> u32 {
        if time_window == 0 {
            return 0;
        }

        let total_recent_engagement = recent_metrics.upvotes + recent_metrics.downvotes;
        let velocity = (total_recent_engagement as u64 * 10000) / time_window;
        velocity as u32
    }

    /// Calculate time-weighted score (recent activity gets higher weight)
    fn calculate_time_weighted_score(analytics: &ContentAnalytics, current_time: u64) -> u32 {
        // Handle case where last_updated is 0 (default value)
        let time_since_update = if analytics.last_updated == 0 {
            0 // New content, give it highest score
        } else {
            current_time.saturating_sub(analytics.last_updated)
        };

        // Exponential decay: newer content gets higher score
        // Scale: 1 hour = 10000, 1 day = 5000, 1 week = 1000
        let decay_factor = if time_since_update < 3600 {
            10000 // Within 1 hour
        } else if time_since_update < 86400 {
            5000 // Within 1 day
        } else if time_since_update < 604800 {
            1000 // Within 1 week
        } else {
            100 // Older than 1 week
        };

        // Combine with engagement rate
        let base_score = analytics.engagement_rate;
        (base_score * decay_factor) / 10000
    }

    /// Sort trending content by score (descending)
    fn sort_trending_by_score(trending_list: &mut Vec<TrendingContent>) {
        let len = trending_list.len();
        for i in 0..len {
            for j in 0..len - i - 1 {
                let current = trending_list.get(j).unwrap();
                let next = trending_list.get(j + 1).unwrap();

                if current.trending_score < next.trending_score {
                    // Swap elements
                    trending_list.set(j, next);
                    trending_list.set(j + 1, current);
                }
            }
        }
    }
}
