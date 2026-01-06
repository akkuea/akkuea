use crate::errors::TippingError;
use crate::events::{
    emit_goal_created, emit_goal_updated, emit_subscription_created, emit_tip_event,
};
use crate::storage;
use crate::types::Tip;
use crate::utils::Utils;
use soroban_sdk::{contracttype, Address, BytesN, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Subscription {
    pub id: BytesN<32>,
    pub educator: Address,
    pub subscriber: Address,
    pub amount: i128,
    pub token: Address,
    pub period: u64,
    pub created_at: u64,
    pub last_executed: u64,
    pub next_execution: u64,
    pub is_active: bool,
    pub execution_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TipGoal {
    pub goal_id: BytesN<32>,
    pub educator: Address,
    pub title: String,
    pub description: String,
    pub target_amount: i128,
    pub current_amount: i128,
    pub deadline: u64,
    pub created_at: u64,
    pub is_active: bool,
    pub contributors: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ConditionalTip {
    pub id: BytesN<32>,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub token: Address,
    pub condition_type: String, // "views", "engagement", "rating"
    pub condition_value: i128,
    pub current_value: i128,
    pub created_at: u64,
    pub is_executed: bool,
}

pub struct SubscriptionManager;

impl SubscriptionManager {
    /// Create a new subscription
    pub fn create_subscription(
        env: &Env,
        subscriber: Address,
        educator: Address,
        amount: i128,
        token: Address,
        period: u64,
    ) -> Result<BytesN<32>, TippingError> {
        Utils::validate_amount(amount)?;
        Utils::validate_address(&educator)?;

        if period < 86400 {
            return Err(TippingError::InvalidInput); // Minimum 1 day period
        }

        let subscription_id = Utils::generate_id(env);
        let current_time = env.ledger().timestamp();

        let subscription = Subscription {
            id: subscription_id.clone(),
            educator: educator.clone(),
            subscriber: subscriber.clone(),
            amount,
            token: token.clone(),
            period,
            created_at: current_time,
            last_executed: 0,
            next_execution: current_time + period,
            is_active: true,
            execution_count: 0,
        };

        storage::set_subscription(env, &subscription_id, &subscription);

        // Add to subscriber's subscriptions list
        let mut subscriber_subs = storage::get_subscriber_subscriptions(env, &subscriber);
        subscriber_subs.push_back(subscription_id.clone());
        storage::set_subscriber_subscriptions(env, &subscriber, &subscriber_subs);

        // Add to educator's subscriptions list
        let mut educator_subs = storage::get_educator_subscriptions(env, &educator);
        educator_subs.push_back(subscription_id.clone());
        storage::set_educator_subscriptions(env, &educator, &educator_subs);

        emit_subscription_created(
            env,
            &subscription_id,
            &subscriber,
            &educator,
            amount,
            period,
        );

        Ok(subscription_id)
    }

    /// Execute subscription payments
    pub fn execute_subscription_payment(
        env: &Env,
        subscription_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        let mut subscription =
            storage::get_subscription(env, &subscription_id).ok_or(TippingError::DataNotFound)?;

        if !subscription.is_active {
            return Err(TippingError::InvalidInput);
        }

        let current_time = env.ledger().timestamp();
        if current_time < subscription.next_execution {
            return Err(TippingError::InvalidInput); // Not ready for execution
        }

        // Create tip for subscription payment
        let tip = Tip {
            from: subscription.subscriber.clone(),
            to: subscription.educator.clone(),
            amount: subscription.amount,
            token: subscription.token.clone(),
            message: Some(String::from_str(env, "Subscription payment")),
            timestamp: current_time,
        };

        // Update subscription
        subscription.last_executed = current_time;
        subscription.next_execution = current_time + subscription.period;
        subscription.execution_count += 1;

        storage::set_subscription(env, &subscription_id, &subscription);

        // Emit tip event
        emit_tip_event(env, &tip);

        Ok(())
    }

    /// Cancel a subscription
    pub fn cancel_subscription(
        env: &Env,
        subscriber: Address,
        subscription_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        let mut subscription =
            storage::get_subscription(env, &subscription_id).ok_or(TippingError::DataNotFound)?;

        if subscription.subscriber != subscriber {
            return Err(TippingError::Unauthorized);
        }

        subscription.is_active = false;
        storage::set_subscription(env, &subscription_id, &subscription);

        Ok(())
    }

    /// Get subscription info
    pub fn get_subscription_info(env: &Env, subscription_id: BytesN<32>) -> Option<Subscription> {
        storage::get_subscription(env, &subscription_id)
    }

    /// Get all subscriptions for a subscriber
    pub fn get_subscriber_subscriptions(env: &Env, subscriber: Address) -> Vec<Subscription> {
        let subscription_ids = storage::get_subscriber_subscriptions(env, &subscriber);
        let mut result = Vec::new(env);

        for i in 0..subscription_ids.len() {
            if let Some(sub_id) = subscription_ids.get(i) {
                if let Some(subscription) = storage::get_subscription(env, &sub_id) {
                    result.push_back(subscription);
                }
            }
        }

        result
    }

    /// Create a tip goal
    pub fn create_tip_goal(
        env: &Env,
        educator: Address,
        title: String,
        description: String,
        target_amount: i128,
        deadline: u64,
    ) -> Result<BytesN<32>, TippingError> {
        Utils::validate_amount(target_amount)?;
        Utils::validate_address(&educator)?;

        let current_time = env.ledger().timestamp();
        if deadline <= current_time {
            return Err(TippingError::InvalidInput);
        }

        let goal_id = Utils::generate_id(env);

        let tip_goal = TipGoal {
            goal_id: goal_id.clone(),
            educator: educator.clone(),
            title,
            description,
            target_amount,
            current_amount: 0,
            deadline,
            created_at: current_time,
            is_active: true,
            contributors: Vec::new(env),
        };

        storage::set_tip_goal(env, &goal_id, &tip_goal);

        // Add to educator's goals list
        let mut educator_goals = storage::get_educator_goals(env, &educator);
        educator_goals.push_back(goal_id.clone());
        storage::set_educator_goals(env, &educator, &educator_goals);

        emit_goal_created(env, &goal_id, &educator, target_amount, deadline);

        Ok(goal_id)
    }

    /// Contribute to a tip goal
    pub fn contribute_to_goal(
        env: &Env,
        contributor: Address,
        goal_id: BytesN<32>,
        amount: i128,
        token: Address,
    ) -> Result<(), TippingError> {
        let mut tip_goal =
            storage::get_tip_goal(env, &goal_id).ok_or(TippingError::DataNotFound)?;

        if !tip_goal.is_active {
            return Err(TippingError::InvalidInput);
        }

        let current_time = env.ledger().timestamp();
        if current_time > tip_goal.deadline {
            return Err(TippingError::InvalidInput);
        }

        Utils::validate_amount(amount)?;

        // Add contributor if not already in the list
        let mut is_new_contributor = true;
        for i in 0..tip_goal.contributors.len() {
            if let Some(addr) = tip_goal.contributors.get(i) {
                if addr == contributor {
                    is_new_contributor = false;
                    break;
                }
            }
        }

        if is_new_contributor {
            tip_goal.contributors.push_back(contributor.clone());
        }

        // Update goal amount
        tip_goal.current_amount += amount;

        // Create tip for goal contribution
        let tip = Tip {
            from: contributor,
            to: tip_goal.educator.clone(),
            amount,
            token,
            message: Some(String::from_str(env, "Goal contribution")),
            timestamp: current_time,
        };

        storage::set_tip_goal(env, &goal_id, &tip_goal);

        // Emit events
        emit_tip_event(env, &tip);
        emit_goal_updated(
            env,
            &goal_id,
            tip_goal.current_amount,
            tip_goal.target_amount,
        );

        Ok(())
    }

    /// Get tip goal status
    pub fn get_goal_status(env: &Env, goal_id: BytesN<32>) -> Option<TipGoal> {
        storage::get_tip_goal(env, &goal_id)
    }

    /// Create conditional tip
    pub fn create_conditional_tip(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
        token: Address,
        condition_type: String,
        condition_value: i128,
    ) -> Result<BytesN<32>, TippingError> {
        Utils::validate_amount(amount)?;
        Utils::validate_address(&to)?;

        let tip_id = Utils::generate_id(env);

        let conditional_tip = ConditionalTip {
            id: tip_id.clone(),
            from,
            to: to.clone(),
            amount,
            token,
            condition_type,
            condition_value,
            current_value: 0,
            created_at: env.ledger().timestamp(),
            is_executed: false,
        };

        storage::set_conditional_tip(env, &tip_id, &conditional_tip);

        // Add to educator's conditional tips
        let mut educator_conditional_tips = storage::get_educator_conditional_tips(env, &to);
        educator_conditional_tips.push_back(tip_id.clone());
        storage::set_educator_conditional_tips(env, &to, &educator_conditional_tips);

        Ok(tip_id)
    }

    /// Execute conditional tip based on metrics
    pub fn execute_conditional_tip(
        env: &Env,
        tip_id: BytesN<32>,
        current_metric_value: i128,
    ) -> Result<(), TippingError> {
        let mut conditional_tip =
            storage::get_conditional_tip(env, &tip_id).ok_or(TippingError::DataNotFound)?;

        if conditional_tip.is_executed {
            return Err(TippingError::InvalidInput);
        }

        conditional_tip.current_value = current_metric_value;

        if current_metric_value >= conditional_tip.condition_value {
            // Execute the tip
            let tip = Tip {
                from: conditional_tip.from.clone(),
                to: conditional_tip.to.clone(),
                amount: conditional_tip.amount,
                token: conditional_tip.token.clone(),
                message: Some(String::from_str(env, "Conditional tip executed")),
                timestamp: env.ledger().timestamp(),
            };

            conditional_tip.is_executed = true;
            storage::set_conditional_tip(env, &tip_id, &conditional_tip);

            emit_tip_event(env, &tip);
        } else {
            storage::set_conditional_tip(env, &tip_id, &conditional_tip);
        }

        Ok(())
    }

    /// Get conditional tip info
    pub fn get_conditional_tip_info(env: &Env, tip_id: BytesN<32>) -> Option<ConditionalTip> {
        storage::get_conditional_tip(env, &tip_id)
    }
}
