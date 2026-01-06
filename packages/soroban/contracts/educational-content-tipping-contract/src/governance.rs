use crate::errors::TippingError;
use crate::storage;
use crate::types::{
    FeeConfig, GovernanceConfig, Proposal, ProposalStatus, ProposalType, Vote, VoteType,
};
use crate::utils::Utils;
use soroban_sdk::{Address, BytesN, Env, String, Vec};

pub struct GovernanceManager;

impl GovernanceManager {
    /// Initialize governance configuration (admin only)
    pub fn initialize_governance(
        env: &Env,
        admin: Address,
        min_proposal_stake: i128,
        voting_period: u64,
        execution_delay: u64,
        min_quorum_percentage: u32,
        min_approval_percentage: u32,
        fee_adjustment_limit: u32,
    ) -> Result<(), TippingError> {
        // Verify admin authorization
        let stored_admin = storage::get_admin(env).ok_or(TippingError::ContractNotInitialized)?;
        admin.require_auth();

        if admin != stored_admin {
            return Err(TippingError::Unauthorized);
        }

        // Validate parameters
        if min_quorum_percentage > 100 || min_approval_percentage > 100 {
            return Err(TippingError::InvalidInput);
        }

        if fee_adjustment_limit > 5000 {
            // Max 50% change
            return Err(TippingError::InvalidInput);
        }

        let config = GovernanceConfig {
            min_proposal_stake,
            voting_period,
            execution_delay,
            min_quorum_percentage,
            min_approval_percentage,
            fee_adjustment_limit,
        };

        storage::set_governance_config(env, &config);

        // Initialize default fee config
        let default_fee_config = FeeConfig {
            base_fee_percentage: 250,    // 2.5%
            premium_fee_percentage: 500, // 5%
            withdrawal_fee: 100_000,     // 0.1 token units
            last_updated: env.ledger().timestamp(),
        };

        storage::set_fee_config(env, &default_fee_config);

        Ok(())
    }

    /// Get current governance configuration
    pub fn get_governance_config(env: &Env) -> Option<GovernanceConfig> {
        storage::get_governance_config(env)
    }

    /// Get current fee configuration
    pub fn get_fee_config(env: &Env) -> Option<FeeConfig> {
        storage::get_fee_config(env)
    }

    /// Calculate voting power for an address
    pub fn calculate_voting_power(env: &Env, voter: &Address) -> u32 {
        // Base voting power: 1
        let mut voting_power = 1u32;

        // Get educator stats if available
        if let Some(stats) = storage::get_educator_stats(env, voter) {
            // Add voting power based on tips received (1 power per 1000 units)
            voting_power += (stats.total_amount / 1000) as u32;

            // Add voting power based on tip count (1 power per 10 tips)
            voting_power += stats.tip_count / 10;
        }

        // Get tip history to calculate activity-based power
        if let Some(history) = storage::get_tip_history(env, voter) {
            let current_time = env.ledger().timestamp();
            let recent_cutoff = current_time - 2592000; // 30 days

            // Count recent activity
            let mut recent_activity = 0u32;
            for i in 0..history.tips.len() {
                if let Some(tip) = history.tips.get(i) {
                    if tip.timestamp > recent_cutoff {
                        recent_activity += 1;
                    }
                }
            }

            // Add voting power based on recent activity
            voting_power += recent_activity / 5;
        }

        // Cap maximum voting power to prevent excessive concentration
        if voting_power > 100 {
            voting_power = 100;
        }

        voting_power
    }

    /// Create a new governance proposal
    pub fn create_proposal(
        env: &Env,
        proposer: Address,
        description: String,
        proposal_type: ProposalType,
        execution_data: Option<String>,
    ) -> Result<BytesN<32>, TippingError> {
        proposer.require_auth();

        let config =
            storage::get_governance_config(env).ok_or(TippingError::ContractNotInitialized)?;

        // Check minimum stake requirement (simplified - would need token staking in production)
        let voting_power = Self::calculate_voting_power(env, &proposer);
        if voting_power < 5 {
            // Minimum 5 voting power to create proposal
            return Err(TippingError::Unauthorized);
        }

        let proposal_id = Utils::generate_id(env);
        let current_time = env.ledger().timestamp();

        let proposal = Proposal {
            proposal_id: proposal_id.clone(),
            description,
            proposer: proposer.clone(),
            proposal_type,
            vote_count_for: 0,
            vote_count_against: 0,
            total_voting_power: 0,
            deadline: current_time + config.voting_period,
            status: ProposalStatus::Active,
            execution_data,
            created_at: current_time,
        };

        storage::set_proposal(env, &proposal_id, &proposal);

        Ok(proposal_id)
    }

    /// Vote on a proposal
    pub fn vote_on_proposal(
        env: &Env,
        voter: Address,
        proposal_id: BytesN<32>,
        vote_type: VoteType,
    ) -> Result<(), TippingError> {
        voter.require_auth();

        let mut proposal =
            storage::get_proposal(env, &proposal_id).ok_or(TippingError::DataNotFound)?;

        // Check if proposal is active and not expired
        let current_time = env.ledger().timestamp();
        if current_time > proposal.deadline || proposal.status != ProposalStatus::Active {
            return Err(TippingError::InvalidInput);
        }

        // Check if voter has already voted
        if storage::get_vote(env, &proposal_id, &voter).is_some() {
            return Err(TippingError::InvalidInput); // Already voted
        }

        let voting_power = Self::calculate_voting_power(env, &voter);

        let vote = Vote {
            voter: voter.clone(),
            proposal_id: proposal_id.clone(),
            vote_type: vote_type.clone(),
            voting_power,
            timestamp: current_time,
        };

        // Update proposal vote counts
        match vote_type {
            VoteType::For => proposal.vote_count_for += voting_power,
            VoteType::Against => proposal.vote_count_against += voting_power,
            VoteType::Abstain => {} // No change to for/against counts
        }

        proposal.total_voting_power += voting_power;

        // Store vote and updated proposal
        storage::set_vote(env, &proposal_id, &voter, &vote);
        storage::set_proposal(env, &proposal_id, &proposal);

        Ok(())
    }

    /// Finalize a proposal after voting period ends
    pub fn finalize_proposal(
        env: &Env,
        finalizer: Address,
        proposal_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        finalizer.require_auth();

        let mut proposal =
            storage::get_proposal(env, &proposal_id).ok_or(TippingError::DataNotFound)?;

        // Check if voting period has ended
        let current_time = env.ledger().timestamp();
        if current_time <= proposal.deadline {
            return Err(TippingError::InvalidInput);
        }

        // Check if proposal is in correct status
        if proposal.status != ProposalStatus::Active {
            return Err(TippingError::InvalidInput);
        }

        let config =
            storage::get_governance_config(env).ok_or(TippingError::ContractNotInitialized)?;

        // Check quorum
        let min_quorum = (config.min_quorum_percentage as u32 * 100) / 100; // Simplified calculation
        if proposal.total_voting_power < min_quorum {
            proposal.status = ProposalStatus::Rejected;
            storage::set_proposal(env, &proposal_id, &proposal);
            return Ok(());
        }

        // Check approval threshold
        let approval_percentage = if proposal.total_voting_power > 0 {
            (proposal.vote_count_for * 100) / proposal.total_voting_power
        } else {
            0
        };

        if approval_percentage >= config.min_approval_percentage {
            proposal.status = ProposalStatus::Approved;
        } else {
            proposal.status = ProposalStatus::Rejected;
        }

        storage::set_proposal(env, &proposal_id, &proposal);
        Ok(())
    }

    /// Execute an approved proposal
    pub fn execute_proposal(
        env: &Env,
        executor: Address,
        proposal_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        executor.require_auth();

        let mut proposal =
            storage::get_proposal(env, &proposal_id).ok_or(TippingError::DataNotFound)?;

        // Check if proposal is approved
        if proposal.status != ProposalStatus::Approved {
            return Err(TippingError::InvalidInput);
        }

        let config =
            storage::get_governance_config(env).ok_or(TippingError::ContractNotInitialized)?;

        // Check if execution delay has passed
        let current_time = env.ledger().timestamp();
        if current_time < proposal.deadline + config.execution_delay {
            return Err(TippingError::InvalidInput);
        }

        // Execute based on proposal type
        match proposal.proposal_type {
            ProposalType::FeeAdjustment => {
                Self::execute_fee_adjustment(env, &proposal)?;
            }
            ProposalType::SecurityConfigChange => {
                Self::execute_security_config_change(env, &proposal)?;
            }
            _ => {
                // For other proposal types, mark as executed but don't perform action yet
                // This allows for manual implementation of complex proposals
            }
        }

        proposal.status = ProposalStatus::Executed;
        storage::set_proposal(env, &proposal_id, &proposal);

        Ok(())
    }

    /// Execute fee adjustment proposal
    fn execute_fee_adjustment(env: &Env, proposal: &Proposal) -> Result<(), TippingError> {
        let mut fee_config = storage::get_fee_config(env).ok_or(TippingError::DataNotFound)?;
        let governance_config =
            storage::get_governance_config(env).ok_or(TippingError::ContractNotInitialized)?;

        // Parse execution_data (simplified - would use JSON in production)
        // For now, just apply default fee changes as a placeholder
        if let Some(_execution_data) = &proposal.execution_data {
            // TODO: Implement proper string parsing for no_std environment
            // For now, apply reasonable default adjustments

            // Apply a small fee adjustment as an example (would parse from execution_data in production)
            let base_fee_change = 25; // 0.25% change
            let new_base_fee = if fee_config.base_fee_percentage > base_fee_change {
                fee_config.base_fee_percentage - base_fee_change
            } else {
                fee_config.base_fee_percentage
            };

            // Validate fee change is within limits
            let change_percentage = if fee_config.base_fee_percentage > 0 {
                ((new_base_fee as i32 - fee_config.base_fee_percentage as i32).abs() * 10000)
                    / fee_config.base_fee_percentage as i32
            } else {
                0
            };

            if change_percentage <= governance_config.fee_adjustment_limit as i32 {
                fee_config.base_fee_percentage = new_base_fee;
            }
        }

        fee_config.last_updated = env.ledger().timestamp();
        storage::set_fee_config(env, &fee_config);

        Ok(())
    }

    /// Execute security configuration change proposal
    fn execute_security_config_change(
        _env: &Env,
        _proposal: &Proposal,
    ) -> Result<(), TippingError> {
        // TODO: Implement security configuration changes via governance
        // This would parse the execution_data and update security parameters
        Ok(())
    }

    /// Get proposal information
    pub fn get_proposal_info(env: &Env, proposal_id: BytesN<32>) -> Option<Proposal> {
        storage::get_proposal(env, &proposal_id)
    }

    /// Get all active proposals
    pub fn get_active_proposals(env: &Env) -> Vec<Proposal> {
        storage::get_all_active_proposals(env)
    }

    /// Get voting history for a voter
    pub fn get_voter_history(env: &Env, voter: Address) -> Vec<Vote> {
        storage::get_voter_history(env, &voter)
    }

    /// Adjust fees through governance (helper function)
    pub fn adjust_fees(
        env: &Env,
        proposer: Address,
        base_fee_percentage: u32,
        premium_fee_percentage: u32,
        withdrawal_fee: i128,
    ) -> Result<BytesN<32>, TippingError> {
        // Create a fee adjustment proposal
        // Note: In production, this should use proper serialization (JSON)
        let execution_data = Some(String::from_str(
            env,
            "base_fee:250,premium_fee:500,withdrawal_fee:100000",
        ));

        Self::create_proposal(
            env,
            proposer,
            String::from_str(env, "Fee Adjustment Proposal"),
            ProposalType::FeeAdjustment,
            execution_data,
        )
    }
}
