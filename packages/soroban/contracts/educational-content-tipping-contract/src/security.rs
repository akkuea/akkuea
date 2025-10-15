use crate::errors::TippingError;
use crate::storage;
use crate::types::{FraudAlert, MultiSigOperation, SecurityConfig, TimeLockedWithdrawal};
use crate::utils::Utils;
use soroban_sdk::{Address, BytesN, Env, String, Vec};

pub struct SecurityManager;

impl SecurityManager {
    /// Configure security parameters (admin only)
    pub fn configure_security(
        env: &Env,
        admin: Address,
        multi_sig_threshold: u32,
        time_lock_duration: u64,
        fraud_alert_threshold: u64,
        max_daily_tip_amount: i128,
        suspicious_pattern_window: u64,
    ) -> Result<(), TippingError> {
        // Verify admin authorization
        let stored_admin = storage::get_admin(env).ok_or(TippingError::ContractNotInitialized)?;
        admin.require_auth();

        if admin != stored_admin {
            return Err(TippingError::Unauthorized);
        }

        // Validate parameters
        if multi_sig_threshold == 0 || multi_sig_threshold > 10 {
            return Err(TippingError::InvalidInput);
        }

        if time_lock_duration < 3600 {
            // Minimum 1 hour
            return Err(TippingError::InvalidInput);
        }

        let config = SecurityConfig {
            multi_sig_threshold,
            time_lock_duration,
            fraud_alert_threshold,
            max_daily_tip_amount,
            suspicious_pattern_window,
        };

        storage::set_security_config(env, &config);
        Ok(())
    }

    /// Get current security configuration
    pub fn get_security_config(env: &Env) -> Option<SecurityConfig> {
        storage::get_security_config(env)
    }

    /// Initiate a multi-signature operation
    pub fn initiate_multi_sig_operation(
        env: &Env,
        initiator: Address,
        operation_type: String,
        execution_data: Option<String>,
    ) -> Result<BytesN<32>, TippingError> {
        initiator.require_auth();

        let config =
            storage::get_security_config(env).ok_or(TippingError::ContractNotInitialized)?;
        let operation_id = Utils::generate_id(env);
        let current_time = env.ledger().timestamp();

        let operation = MultiSigOperation {
            operation_id: operation_id.clone(),
            operation_type,
            initiator: initiator.clone(),
            approvers: Vec::new(env),
            required_approvals: config.multi_sig_threshold,
            created_at: current_time,
            expires_at: current_time + 86400, // 24 hours expiry
            executed: false,
            execution_data,
        };

        storage::set_multi_sig_operation(env, &operation_id, &operation);

        // Add initiator as first approver
        Self::approve_multi_sig_operation(env, initiator, operation_id.clone())?;

        Ok(operation_id)
    }

    /// Approve a multi-signature operation
    pub fn approve_multi_sig_operation(
        env: &Env,
        approver: Address,
        operation_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        approver.require_auth();

        let mut operation = storage::get_multi_sig_operation(env, &operation_id)
            .ok_or(TippingError::DataNotFound)?;

        // Check if operation has expired
        if env.ledger().timestamp() > operation.expires_at {
            return Err(TippingError::InvalidInput);
        }

        // Check if already executed
        if operation.executed {
            return Err(TippingError::InvalidInput);
        }

        // Check if approver already approved
        for i in 0..operation.approvers.len() {
            if let Some(existing_approver) = operation.approvers.get(i) {
                if existing_approver == approver {
                    return Err(TippingError::InvalidInput); // Already approved
                }
            }
        }

        // Add approver
        operation.approvers.push_back(approver);
        storage::set_multi_sig_operation(env, &operation_id, &operation);

        Ok(())
    }

    /// Execute a multi-signature operation once threshold is met
    pub fn execute_multi_sig_operation(
        env: &Env,
        executor: Address,
        operation_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        executor.require_auth();

        let mut operation = storage::get_multi_sig_operation(env, &operation_id)
            .ok_or(TippingError::DataNotFound)?;

        // Check if operation has expired
        if env.ledger().timestamp() > operation.expires_at {
            return Err(TippingError::InvalidInput);
        }

        // Check if already executed
        if operation.executed {
            return Err(TippingError::InvalidInput);
        }

        // Check if threshold is met
        if operation.approvers.len() < operation.required_approvals {
            return Err(TippingError::Unauthorized);
        }

        // Mark as executed
        operation.executed = true;
        storage::set_multi_sig_operation(env, &operation_id, &operation);

        // TODO: Execute the actual operation based on operation_type
        // This would involve parsing execution_data and performing the requested action

        Ok(())
    }

    /// Initiate a time-locked withdrawal
    pub fn initiate_time_locked_withdrawal(
        env: &Env,
        initiator: Address,
        educator: Address,
        amount: i128,
        token: Address,
    ) -> Result<BytesN<32>, TippingError> {
        initiator.require_auth();

        let config =
            storage::get_security_config(env).ok_or(TippingError::ContractNotInitialized)?;

        // Validate amount
        if amount <= 0 {
            return Err(TippingError::InvalidAmount);
        }

        let withdrawal_id = Utils::generate_id(env);
        let current_time = env.ledger().timestamp();

        let withdrawal = TimeLockedWithdrawal {
            withdrawal_id: withdrawal_id.clone(),
            educator: educator.clone(),
            amount,
            token: token.clone(),
            initiated_at: current_time,
            unlock_at: current_time + config.time_lock_duration,
            cancelled: false,
            initiator,
        };

        storage::set_time_locked_withdrawal(env, &withdrawal_id, &withdrawal);

        Ok(withdrawal_id)
    }

    /// Execute a time-locked withdrawal after the lock period
    pub fn execute_time_locked_withdrawal(
        env: &Env,
        executor: Address,
        withdrawal_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        executor.require_auth();

        let mut withdrawal = storage::get_time_locked_withdrawal(env, &withdrawal_id)
            .ok_or(TippingError::DataNotFound)?;

        // Check if cancelled
        if withdrawal.cancelled {
            return Err(TippingError::InvalidInput);
        }

        // Check if time lock has expired
        if env.ledger().timestamp() < withdrawal.unlock_at {
            return Err(TippingError::InvalidInput);
        }

        // Mark as executed by removing from storage
        storage::remove_time_locked_withdrawal(env, &withdrawal_id);

        // TODO: Implement actual token transfer logic
        // This would involve transferring tokens from the contract to the educator

        Ok(())
    }

    /// Cancel a time-locked withdrawal (admin or fraud detection)
    pub fn cancel_time_locked_withdrawal(
        env: &Env,
        canceller: Address,
        withdrawal_id: BytesN<32>,
        reason: String,
    ) -> Result<(), TippingError> {
        canceller.require_auth();

        let mut withdrawal = storage::get_time_locked_withdrawal(env, &withdrawal_id)
            .ok_or(TippingError::DataNotFound)?;

        // Check authorization (admin or original initiator)
        let admin = storage::get_admin(env).ok_or(TippingError::ContractNotInitialized)?;
        if canceller != admin && canceller != withdrawal.initiator {
            return Err(TippingError::Unauthorized);
        }

        // Cancel the withdrawal
        withdrawal.cancelled = true;
        storage::set_time_locked_withdrawal(env, &withdrawal_id, &withdrawal);

        Ok(())
    }

    /// Flag suspicious activity
    pub fn flag_suspicious_activity(
        env: &Env,
        reporter: Address,
        target_address: Address,
        alert_type: String,
        details: String,
        severity: u32,
    ) -> Result<BytesN<32>, TippingError> {
        reporter.require_auth();

        // Validate severity (1-10 scale)
        if severity == 0 || severity > 10 {
            return Err(TippingError::InvalidInput);
        }

        let alert_id = Utils::generate_id(env);

        let alert = FraudAlert {
            alert_id: alert_id.clone(),
            target_address,
            alert_type,
            detected_at: env.ledger().timestamp(),
            resolved: false,
            details,
            severity,
        };

        storage::set_fraud_alert(env, &alert_id, &alert);

        Ok(alert_id)
    }

    /// Resolve a fraud alert
    pub fn resolve_fraud_alert(
        env: &Env,
        resolver: Address,
        alert_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        resolver.require_auth();

        // Check admin authorization
        let admin = storage::get_admin(env).ok_or(TippingError::ContractNotInitialized)?;
        if resolver != admin {
            return Err(TippingError::Unauthorized);
        }

        let mut alert =
            storage::get_fraud_alert(env, &alert_id).ok_or(TippingError::DataNotFound)?;

        alert.resolved = true;
        storage::set_fraud_alert(env, &alert_id, &alert);

        Ok(())
    }

    /// Automatic fraud detection based on tipping patterns
    pub fn detect_suspicious_patterns(
        env: &Env,
        address: Address,
    ) -> Result<Vec<String>, TippingError> {
        let config =
            storage::get_security_config(env).ok_or(TippingError::ContractNotInitialized)?;
        let current_time = env.ledger().timestamp();
        let window_start = current_time - config.suspicious_pattern_window;

        // Get tips in the analysis window
        let tips = storage::get_educator_tips_in_period(env, &address, window_start, current_time);

        let mut alerts = Vec::new(env);

        // Check for rapid successive tips
        if tips.len() as u64 > config.fraud_alert_threshold {
            alerts.push_back(String::from_str(env, "rapid_successive_tips"));
        }

        // Check for unusual amounts
        let mut total_amount = 0i128;
        for i in 0..tips.len() {
            if let Some(tip) = tips.get(i) {
                total_amount += tip.amount;
            }
        }

        if total_amount > config.max_daily_tip_amount {
            alerts.push_back(String::from_str(env, "excessive_daily_amount"));
        }

        Ok(alerts)
    }

    /// Get all active fraud alerts
    pub fn get_active_alerts(env: &Env) -> Vec<FraudAlert> {
        storage::get_all_fraud_alerts(env)
    }

    /// Get multi-sig operation details
    pub fn get_multi_sig_operation(
        env: &Env,
        operation_id: BytesN<32>,
    ) -> Option<MultiSigOperation> {
        storage::get_multi_sig_operation(env, &operation_id)
    }

    /// Get time-locked withdrawal details
    pub fn get_time_locked_withdrawal(
        env: &Env,
        withdrawal_id: BytesN<32>,
    ) -> Option<TimeLockedWithdrawal> {
        storage::get_time_locked_withdrawal(env, &withdrawal_id)
    }
}
