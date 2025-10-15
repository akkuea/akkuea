use crate::datatype::{
    FraudReport, MultiSigProposal, ReputationStake, SecurityConfig, TimeLockOperation,
};
use crate::storage::{DataKey, ADMIN};
use soroban_sdk::{Address, BytesN, Env, String, Vec};

pub struct SecuritySystem;

impl SecuritySystem {
    /// Initialize security configuration
    pub fn configure_security(env: &Env, admin: &Address, config: SecurityConfig) {
        Self::verify_admin(env, admin);
        let security_key = String::from_str(env, "SECURITY_CONFIG");
        env.storage().persistent().set(&security_key, &config);
    }

    /// Get current security configuration
    pub fn get_security_config(env: &Env) -> SecurityConfig {
        let security_key = String::from_str(env, "SECURITY_CONFIG");
        env.storage()
            .persistent()
            .get(&security_key)
            .unwrap_or(SecurityConfig {
                multi_sig_threshold: 2,
                time_lock_duration: 86400, // 24 hours
                reputation_stake: 100,
                fraud_detection_enabled: true,
                max_operations_per_hour: 10,
            })
    }

    /// Verify admin authorization
    pub fn verify_admin(env: &Env, admin: &Address) {
        let stored_admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        if admin != &stored_admin {
            panic!("not authorized");
        }
    }

    // --- Multi-Signature Functions ---

    /// Create a multi-signature proposal
    pub fn create_multisig_proposal(
        env: &Env,
        proposer: &Address,
        operation: String,
        target: Address,
        data: Vec<String>,
    ) -> BytesN<32> {
        proposer.require_auth();

        let config = Self::get_security_config(env);
        let proposal_id = Self::generate_proposal_id(env, &operation, &target);

        let mut approvals = Vec::new(&env);
        approvals.push_back(proposer.clone()); // Proposer automatically approves

        let proposal = MultiSigProposal {
            id: proposal_id.clone(),
            operation,
            target,
            data,
            proposer: proposer.clone(),
            approvals,
            required_signatures: config.multi_sig_threshold,
            created_at: env.ledger().timestamp(),
            executed: false,
            cancelled: false,
        };

        env.storage()
            .persistent()
            .set(&DataKey::MultiSigProposal(proposal_id.clone()), &proposal);

        proposal_id
    }

    /// Approve a multi-signature proposal
    pub fn approve_proposal(env: &Env, approver: &Address, proposal_id: BytesN<32>) -> bool {
        approver.require_auth();

        let mut proposal: MultiSigProposal = env
            .storage()
            .persistent()
            .get(&DataKey::MultiSigProposal(proposal_id.clone()))
            .unwrap();

        if proposal.executed || proposal.cancelled {
            panic!("proposal already executed or cancelled");
        }

        // Check if already approved by this address
        if proposal.approvals.contains(approver) {
            panic!("already approved by this address");
        }

        proposal.approvals.push_back(approver.clone());
        env.storage()
            .persistent()
            .set(&DataKey::MultiSigProposal(proposal_id.clone()), &proposal);

        // Check if we have enough signatures to execute
        proposal.approvals.len() >= proposal.required_signatures
    }

    /// Execute multi-signature operation
    pub fn execute_multisig_operation(
        env: &Env,
        executor: &Address,
        proposal_id: BytesN<32>,
    ) -> bool {
        executor.require_auth();

        let mut proposal: MultiSigProposal = env
            .storage()
            .persistent()
            .get(&DataKey::MultiSigProposal(proposal_id.clone()))
            .unwrap();

        if proposal.executed {
            panic!("proposal already executed");
        }

        if proposal.cancelled {
            panic!("proposal cancelled");
        }

        if proposal.approvals.len() < proposal.required_signatures {
            panic!("insufficient approvals");
        }

        proposal.executed = true;
        env.storage()
            .persistent()
            .set(&DataKey::MultiSigProposal(proposal_id.clone()), &proposal);

        true
    }

    // --- Time-Lock Functions ---

    /// Schedule a time-locked operation
    pub fn schedule_time_locked_operation(
        env: &Env,
        proposer: &Address,
        operation: String,
        target: Address,
        data: Vec<String>,
    ) -> BytesN<32> {
        proposer.require_auth();

        let config = Self::get_security_config(env);
        let operation_id = Self::generate_operation_id(env, &operation, &target);
        let execution_time = env.ledger().timestamp() + config.time_lock_duration;

        let time_lock_op = TimeLockOperation {
            id: operation_id.clone(),
            operation,
            target,
            data,
            proposer: proposer.clone(),
            execution_time,
            executed: false,
            cancelled: false,
        };

        env.storage().persistent().set(
            &DataKey::TimeLockOperation(operation_id.clone()),
            &time_lock_op,
        );

        operation_id
    }

    /// Execute time-locked operation
    pub fn execute_time_locked_operation(
        env: &Env,
        executor: &Address,
        operation_id: BytesN<32>,
    ) -> bool {
        executor.require_auth();

        let mut operation: TimeLockOperation = env
            .storage()
            .persistent()
            .get(&DataKey::TimeLockOperation(operation_id.clone()))
            .unwrap();

        if operation.executed {
            panic!("operation already executed");
        }

        if operation.cancelled {
            panic!("operation cancelled");
        }

        if env.ledger().timestamp() < operation.execution_time {
            panic!("time lock not yet expired");
        }

        operation.executed = true;
        env.storage().persistent().set(
            &DataKey::TimeLockOperation(operation_id.clone()),
            &operation,
        );

        true
    }

    /// Cancel time-locked operation (admin only)
    pub fn cancel_time_locked_operation(
        env: &Env,
        admin: &Address,
        operation_id: BytesN<32>,
    ) -> bool {
        Self::verify_admin(env, admin);

        let mut operation: TimeLockOperation = env
            .storage()
            .persistent()
            .get(&DataKey::TimeLockOperation(operation_id.clone()))
            .unwrap();

        if operation.executed {
            panic!("operation already executed");
        }

        operation.cancelled = true;
        env.storage().persistent().set(
            &DataKey::TimeLockOperation(operation_id.clone()),
            &operation,
        );

        true
    }

    // --- Fraud Detection Functions ---

    /// Flag fraudulent activity
    pub fn flag_fraudulent_activity(
        env: &Env,
        reporter: &Address,
        target: &Address,
        fraud_type: String,
        evidence_hash: String,
    ) -> BytesN<32> {
        reporter.require_auth();

        let config = Self::get_security_config(env);
        if !config.fraud_detection_enabled {
            panic!("fraud detection disabled");
        }

        let fraud_id = Self::generate_fraud_id(env, target, &fraud_type);
        let fraud_score = Self::calculate_fraud_score(env, target, &fraud_type);

        let fraud_report = FraudReport {
            id: fraud_id.clone(),
            reporter: reporter.clone(),
            target: target.clone(),
            fraud_type,
            evidence_hash,
            timestamp: env.ledger().timestamp(),
            resolved: false,
            fraud_score,
        };

        env.storage()
            .persistent()
            .set(&DataKey::FraudReport(fraud_id.clone()), &fraud_report);

        // Automatic actions based on fraud score
        if fraud_score > 80 {
            // Suspend account temporarily
            Self::suspend_account(env, target);
        }

        fraud_id
    }

    /// Calculate fraud score based on patterns
    fn calculate_fraud_score(env: &Env, target: &Address, fraud_type: &String) -> u32 {
        let mut score = 10; // Base score

        // Check historical reports (simplified check)
        let fraud_key = DataKey::FraudReport(Self::generate_fraud_id(
            env,
            target,
            &String::from_str(env, "previous"),
        ));
        if env.storage().persistent().has(&fraud_key) {
            score += 20; // Previous reports increase score
        }

        // Check operation frequency
        score += Self::check_operation_frequency(env);

        // Specific fraud type penalties
        if fraud_type == &String::from_str(env, "credential_farming") {
            score += 30;
        } else if fraud_type == &String::from_str(env, "review_manipulation") {
            score += 25;
        }

        score.min(100)
    }

    /// Check operation frequency for rate limiting
    fn check_operation_frequency(env: &Env) -> u32 {
        // This is a simplified check - in production, you'd track actual operations
        let operations_count = 1; // Placeholder
        let config = Self::get_security_config(env);

        if operations_count > config.max_operations_per_hour {
            return 40; // High frequency penalty
        }

        0
    }

    /// Suspend account (internal function)
    fn suspend_account(env: &Env, target: &Address) {
        let suspension_data = true;
        env.storage()
            .persistent()
            .set(&DataKey::SuspendedAccount(target.clone()), &suspension_data);
    }

    // --- Reputation Staking Functions ---

    /// Stake reputation tokens
    pub fn stake_reputation(env: &Env, staker: &Address, amount: u64, lock_duration: u64) -> bool {
        staker.require_auth();

        let config = Self::get_security_config(env);
        if amount < config.reputation_stake {
            panic!("insufficient stake amount");
        }

        let lock_until = env.ledger().timestamp() + lock_duration;
        let stake = ReputationStake {
            staker: staker.clone(),
            amount,
            locked_until: lock_until,
            active: true,
            slashed_amount: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::ReputationStake(staker.clone()), &stake);

        true
    }

    /// Slash stake for fraudulent behavior
    pub fn slash_stake(env: &Env, admin: &Address, staker: &Address, slash_amount: u64) -> bool {
        Self::verify_admin(env, admin);

        let mut stake: ReputationStake = env
            .storage()
            .persistent()
            .get(&DataKey::ReputationStake(staker.clone()))
            .unwrap();

        if !stake.active {
            panic!("stake not active");
        }

        let available_to_slash = stake.amount - stake.slashed_amount;
        let actual_slash = slash_amount.min(available_to_slash);

        stake.slashed_amount += actual_slash;
        if stake.slashed_amount >= stake.amount {
            stake.active = false;
        }

        env.storage()
            .persistent()
            .set(&DataKey::ReputationStake(staker.clone()), &stake);

        // Log slash event (simplified for Soroban)
        let log_key = String::from_str(env, "SLASH_LOG");
        env.storage().persistent().set(&log_key, &actual_slash);

        true
    }

    /// Withdraw stake after lock period
    pub fn withdraw_stake(env: &Env, staker: &Address) -> u64 {
        staker.require_auth();

        let stake: ReputationStake = env
            .storage()
            .persistent()
            .get(&DataKey::ReputationStake(staker.clone()))
            .unwrap();

        if env.ledger().timestamp() < stake.locked_until {
            panic!("stake still locked");
        }

        let withdrawable_amount = stake.amount - stake.slashed_amount;

        // Remove stake record
        env.storage()
            .persistent()
            .remove(&DataKey::ReputationStake(staker.clone()));

        withdrawable_amount
    }

    // --- Utility Functions ---

    /// Generate unique proposal ID
    fn generate_proposal_id(env: &Env, operation: &String, target: &Address) -> BytesN<32> {
        let timestamp = env.ledger().timestamp();
        let mut bytes = [0u8; 32];

        // Use timestamp for first 8 bytes
        bytes[0] = (timestamp >> 56) as u8;
        bytes[1] = (timestamp >> 48) as u8;
        bytes[2] = (timestamp >> 40) as u8;
        bytes[3] = (timestamp >> 32) as u8;
        bytes[4] = (timestamp >> 24) as u8;
        bytes[5] = (timestamp >> 16) as u8;
        bytes[6] = (timestamp >> 8) as u8;
        bytes[7] = timestamp as u8;

        // Use operation length for next bytes
        let op_len = operation.len();
        bytes[8] = (op_len >> 8) as u8;
        bytes[9] = op_len as u8;

        // Use target address for remaining bytes (simplified)
        let target_len = target.to_string().len();
        bytes[10] = (target_len >> 8) as u8;
        bytes[11] = target_len as u8;

        BytesN::from_array(env, &bytes)
    }

    /// Generate unique operation ID for time-locks
    fn generate_operation_id(env: &Env, operation: &String, target: &Address) -> BytesN<32> {
        Self::generate_proposal_id(env, operation, target) // Reuse same logic
    }

    /// Generate unique fraud report ID
    fn generate_fraud_id(env: &Env, target: &Address, fraud_type: &String) -> BytesN<32> {
        let timestamp = env.ledger().timestamp();
        let mut bytes = [0u8; 32];

        // Use timestamp for first 8 bytes
        bytes[0] = (timestamp >> 56) as u8;
        bytes[1] = (timestamp >> 48) as u8;
        bytes[2] = (timestamp >> 40) as u8;
        bytes[3] = (timestamp >> 32) as u8;
        bytes[4] = (timestamp >> 24) as u8;
        bytes[5] = (timestamp >> 16) as u8;
        bytes[6] = (timestamp >> 8) as u8;
        bytes[7] = timestamp as u8;

        // Use fraud type and target for uniqueness
        let fraud_len = fraud_type.len();
        bytes[8] = (fraud_len >> 8) as u8;
        bytes[9] = fraud_len as u8;

        let target_len = target.to_string().len();
        bytes[12] = (target_len >> 8) as u8;
        bytes[13] = target_len as u8;

        BytesN::from_array(env, &bytes)
    }

    /// Check if account is suspended
    pub fn is_account_suspended(env: &Env, account: &Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::SuspendedAccount(account.clone()))
            .unwrap_or(false)
    }

    /// Get active stake for an address
    pub fn get_active_stake(env: &Env, staker: &Address) -> Option<ReputationStake> {
        env.storage()
            .persistent()
            .get(&DataKey::ReputationStake(staker.clone()))
            .unwrap_or(None)
    }
}
