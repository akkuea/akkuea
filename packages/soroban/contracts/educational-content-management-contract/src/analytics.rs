use soroban_sdk::{Env, String, Vec};

use crate::storage::{
    content_exists, get_all_content_ids, get_category_analytics, get_content,
    get_content_analytics, get_time_based_metrics, save_category_analytics, save_content_analytics,
    save_time_based_metrics, CategoryAnalytics, ContentAnalytics, TimeBasedMetrics, TimePeriod,
};

/// Analytics module for tracking content performance and engagement metrics
pub struct Analytics;

impl Analytics {
    /// Record a view for a content item
    pub fn record_view(env: &Env, content_id: u64) -> Result<(), String> {
        if !content_exists(env, content_id) {
            return Err(String::from_str(env, "Content does not exist"));
        }

        let mut analytics =
            get_content_analytics(env, content_id).unwrap_or_else(|| ContentAnalytics {
                content_id,
                total_views: 0,
                total_upvotes: 0,
                total_downvotes: 0,
                engagement_rate: 0,
                average_rating: 0,
                trending_score: 0,
                last_updated: env.ledger().timestamp(),
            });

        analytics.total_views += 1;
        analytics.last_updated = env.ledger().timestamp();

        // Recalculate engagement rate
        analytics.engagement_rate = Self::calculate_engagement_rate(
            analytics.total_upvotes,
            analytics.total_downvotes,
            analytics.total_views,
        );

        save_content_analytics(env, &analytics);

        // Record time-based metrics
        Self::record_time_based_metrics(env, content_id, 1, 0, 0, TimePeriod::Hourly)?;

        Ok(())
    }

    /// Record an upvote for a content item
    pub fn record_upvote(env: &Env, content_id: u64) -> Result<(), String> {
        if !content_exists(env, content_id) {
            return Err(String::from_str(env, "Content does not exist"));
        }

        let mut analytics =
            get_content_analytics(env, content_id).unwrap_or_else(|| ContentAnalytics {
                content_id,
                total_views: 0,
                total_upvotes: 0,
                total_downvotes: 0,
                engagement_rate: 0,
                average_rating: 0,
                trending_score: 0,
                last_updated: env.ledger().timestamp(),
            });

        analytics.total_upvotes += 1;
        analytics.last_updated = env.ledger().timestamp();

        // Recalculate engagement rate and average rating
        analytics.engagement_rate = Self::calculate_engagement_rate(
            analytics.total_upvotes,
            analytics.total_downvotes,
            analytics.total_views,
        );
        analytics.average_rating =
            Self::calculate_average_rating(analytics.total_upvotes, analytics.total_downvotes);

        save_content_analytics(env, &analytics);

        // Record time-based metrics
        Self::record_time_based_metrics(env, content_id, 0, 1, 0, TimePeriod::Hourly)?;

        Ok(())
    }

    /// Record a downvote for a content item
    pub fn record_downvote(env: &Env, content_id: u64) -> Result<(), String> {
        if !content_exists(env, content_id) {
            return Err(String::from_str(env, "Content does not exist"));
        }

        let mut analytics =
            get_content_analytics(env, content_id).unwrap_or_else(|| ContentAnalytics {
                content_id,
                total_views: 0,
                total_upvotes: 0,
                total_downvotes: 0,
                engagement_rate: 0,
                average_rating: 0,
                trending_score: 0,
                last_updated: env.ledger().timestamp(),
            });

        analytics.total_downvotes += 1;
        analytics.last_updated = env.ledger().timestamp();

        // Recalculate engagement rate and average rating
        analytics.engagement_rate = Self::calculate_engagement_rate(
            analytics.total_upvotes,
            analytics.total_downvotes,
            analytics.total_views,
        );
        analytics.average_rating =
            Self::calculate_average_rating(analytics.total_upvotes, analytics.total_downvotes);

        save_content_analytics(env, &analytics);

        // Record time-based metrics
        Self::record_time_based_metrics(env, content_id, 0, 0, 1, TimePeriod::Hourly)?;

        Ok(())
    }

    /// Get analytics for a specific content item
    pub fn get_content_analytics(env: &Env, content_id: u64) -> Result<ContentAnalytics, String> {
        if !content_exists(env, content_id) {
            return Err(String::from_str(env, "Content does not exist"));
        }

        get_content_analytics(env, content_id)
            .ok_or_else(|| String::from_str(env, "Analytics not found for content"))
    }

    /// Get analytics for multiple content items
    pub fn get_multiple_content_analytics(
        env: &Env,
        content_ids: &Vec<u64>,
    ) -> Vec<ContentAnalytics> {
        let mut analytics_list = Vec::new(env);

        for i in 0..content_ids.len() {
            let content_id = content_ids.get(i).unwrap();
            if let Ok(analytics) = Self::get_content_analytics(env, content_id) {
                analytics_list.push_back(analytics);
            }
        }

        analytics_list
    }

    /// Update category analytics for a content item
    pub fn update_category_analytics(env: &Env, content_id: u64) -> Result<(), String> {
        let content = get_content(env, content_id);
        let analytics = Self::get_content_analytics(env, content_id)?;

        // Update analytics for each subject tag
        for i in 0..content.subject_tags.len() {
            let category = content.subject_tags.get(i).unwrap();
            Self::update_single_category_analytics(env, &category, &analytics)?;
        }

        Ok(())
    }

    /// Get category analytics
    pub fn get_category_analytics(env: &Env, category: &String) -> Option<CategoryAnalytics> {
        get_category_analytics(env, category)
    }

    /// Get top performing content by engagement rate
    pub fn get_top_content_by_engagement(env: &Env, limit: u32) -> Vec<ContentAnalytics> {
        let all_content_ids = get_all_content_ids(env);
        let mut analytics_list = Vec::new(env);

        // Collect all analytics
        for i in 0..all_content_ids.len() {
            let content_id = all_content_ids.get(i).unwrap();
            if let Ok(analytics) = Self::get_content_analytics(env, content_id) {
                analytics_list.push_back(analytics);
            }
        }

        // Sort by engagement rate (descending) and return top results
        Self::sort_analytics_by_engagement(&mut analytics_list);

        let mut result = Vec::new(env);
        let max_items = if analytics_list.len() > limit {
            limit
        } else {
            analytics_list.len()
        };

        for i in 0..max_items {
            result.push_back(analytics_list.get(i).unwrap());
        }

        result
    }

    /// Get content analytics for a specific time period
    pub fn get_time_based_analytics(
        env: &Env,
        content_id: u64,
        timestamp: u64,
        period: TimePeriod,
    ) -> Option<TimeBasedMetrics> {
        get_time_based_metrics(env, content_id, timestamp, period)
    }

    // Private helper methods

    /// Calculate engagement rate (scaled to avoid decimals)
    fn calculate_engagement_rate(upvotes: u32, downvotes: u32, views: u64) -> u32 {
        if views == 0 {
            return 0;
        }

        let total_engagement = upvotes + downvotes;
        let rate = (total_engagement as u64 * 10000) / views;
        rate as u32
    }

    /// Calculate average rating (scaled to avoid decimals)
    fn calculate_average_rating(upvotes: u32, downvotes: u32) -> u32 {
        let total_votes = upvotes + downvotes;
        if total_votes == 0 {
            return 25000; // Neutral rating (2.5 * 10000)
        }

        // Use integer arithmetic to avoid f64
        let positive_ratio = (upvotes * 10000) / total_votes;
        let rating = (positive_ratio * 5) / 10000; // Scale to 0-5
        rating * 10000 // Scale to avoid decimals
    }

    /// Record time-based metrics
    fn record_time_based_metrics(
        env: &Env,
        content_id: u64,
        views: u32,
        upvotes: u32,
        downvotes: u32,
        period: TimePeriod,
    ) -> Result<(), String> {
        let timestamp = env.ledger().timestamp();

        // Get existing metrics or create new ones
        let mut metrics = get_time_based_metrics(env, content_id, timestamp, period)
            .unwrap_or_else(|| TimeBasedMetrics {
                content_id,
                timestamp,
                views: 0,
                upvotes: 0,
                downvotes: 0,
                period,
            });

        // Update metrics
        metrics.views += views;
        metrics.upvotes += upvotes;
        metrics.downvotes += downvotes;

        save_time_based_metrics(env, &metrics);

        Ok(())
    }

    /// Update analytics for a single category
    fn update_single_category_analytics(
        env: &Env,
        category: &String,
        content_analytics: &ContentAnalytics,
    ) -> Result<(), String> {
        let mut category_analytics =
            get_category_analytics(env, category).unwrap_or_else(|| CategoryAnalytics {
                category: category.clone(),
                total_content: 0,
                total_views: 0,
                total_upvotes: 0,
                average_rating: 0,
                trending_content_count: 0,
                last_updated: env.ledger().timestamp(),
            });

        // Update category metrics
        category_analytics.total_views += content_analytics.total_views;
        category_analytics.total_upvotes += content_analytics.total_upvotes;
        category_analytics.last_updated = env.ledger().timestamp();

        // Recalculate average rating for the category
        // This is a simplified calculation - in a real implementation,
        // you'd want to aggregate all content in the category
        category_analytics.average_rating = content_analytics.average_rating;

        save_category_analytics(env, &category_analytics);

        Ok(())
    }

    /// Sort analytics by engagement rate (descending)
    fn sort_analytics_by_engagement(analytics_list: &mut Vec<ContentAnalytics>) {
        // Simple bubble sort for small lists
        // In production, you might want a more efficient algorithm
        let len = analytics_list.len();
        for i in 0..len {
            for j in 0..len - i - 1 {
                let current = analytics_list.get(j).unwrap();
                let next = analytics_list.get(j + 1).unwrap();

                if current.engagement_rate < next.engagement_rate {
                    // Swap elements
                    analytics_list.set(j, next);
                    analytics_list.set(j + 1, current);
                }
            }
        }
    }
}
