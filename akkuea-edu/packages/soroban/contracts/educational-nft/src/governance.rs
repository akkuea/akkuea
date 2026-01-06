use crate::social::get_reputation_boost;
use crate::utils::NFTError;
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

pub const PROPOSAL_CREATED_EVENT: Symbol = symbol_short!("prop_new");
pub const VOTE_CAST_EVENT: Symbol = symbol_short!("vote_cast");
pub const PROPOSAL_FINALIZED_EVENT: Symbol = symbol_short!("prop_done");
pub const GOVERNANCE_ACTION_EVENT: Symbol = symbol_short!("gov_act");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalType {
    FeatureEnhancement,
    RoyaltyAdjustment,
    ContentCuration,
    MetadataUpdate,
    PlatformUpgrade,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub proposal_id: u64,
    pub creator: Address,
    pub proposal_type: ProposalType,
    pub title: String,
    pub description: String,
    pub vote_end: u64,
    pub status: ProposalStatus,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub total_voting_power: u64,
    pub quorum_required: u64,
    pub approval_threshold: u64,
    pub created_at: u64,
    pub executed_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vote {
    pub proposal_id: u64,
    pub voter: Address,
    pub vote: bool,
    pub voting_power: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoterEligibility {
    pub address: Address,
    pub nft_count: u32,
    pub reputation_score: u32,
    pub voting_power: u64,
    pub is_verified: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceConfig {
    pub min_proposal_duration: u64,
    pub max_proposal_duration: u64,
    pub min_quorum_percentage: u64,
    pub min_approval_percentage: u64,
    pub min_reputation_to_propose: u32,
    pub min_nfts_to_vote: u32,
    pub reputation_voting_weight: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCreatedEvent {
    pub proposal_id: u64,
    pub creator: Address,
    pub proposal_type: ProposalType,
    pub title: String,
    pub vote_end: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VoteCastEvent {
    pub proposal_id: u64,
    pub voter: Address,
    pub vote: bool,
    pub voting_power: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalFinalizedEvent {
    pub proposal_id: u64,
    pub status: ProposalStatus,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub total_voting_power: u64,
    pub timestamp: u64,
}

const PROPOSALS: Symbol = symbol_short!("proposals");
const VOTES: Symbol = symbol_short!("votes");
const VOTER_RECORDS: Symbol = symbol_short!("voters");
const GOVERNANCE_CONFIG: Symbol = symbol_short!("gov_cfg");
const PROPOSAL_COUNTER: Symbol = symbol_short!("prop_cnt");

pub fn initialize_governance(env: &Env) {
    let config = GovernanceConfig {
        min_proposal_duration: 100,
        max_proposal_duration: 604800,
        min_quorum_percentage: 10,
        min_approval_percentage: 5000,
        min_reputation_to_propose: 0,
        min_nfts_to_vote: 1,
        reputation_voting_weight: 100,
    };

    env.storage().persistent().set(&GOVERNANCE_CONFIG, &config);
    env.storage().persistent().set(&PROPOSAL_COUNTER, &0u64);
}

pub fn get_governance_config(env: &Env) -> GovernanceConfig {
    env.storage()
        .persistent()
        .get(&GOVERNANCE_CONFIG)
        .unwrap_or_else(|| GovernanceConfig {
            min_proposal_duration: 100,
            max_proposal_duration: 604800,
            min_quorum_percentage: 10,
            min_approval_percentage: 5000,
            min_reputation_to_propose: 0,
            min_nfts_to_vote: 1,
            reputation_voting_weight: 100,
        })
}

pub fn get_next_proposal_id(env: &Env) -> u64 {
    let current = env
        .storage()
        .persistent()
        .get(&PROPOSAL_COUNTER)
        .unwrap_or(0u64);
    let next_id = current + 1;
    env.storage().persistent().set(&PROPOSAL_COUNTER, &next_id);
    next_id
}

pub fn store_proposal(env: &Env, proposal: &Proposal) {
    let key = (PROPOSALS, proposal.proposal_id);
    env.storage().persistent().set(&key, proposal);
}

pub fn get_proposal(env: &Env, proposal_id: u64) -> Option<Proposal> {
    let key = (PROPOSALS, proposal_id);
    env.storage().persistent().get(&key)
}

pub fn store_vote(env: &Env, vote: &Vote) {
    let key = (VOTES, vote.proposal_id, vote.voter.clone());
    env.storage().persistent().set(&key, vote);
}

pub fn get_vote(env: &Env, proposal_id: u64, voter: &Address) -> Option<Vote> {
    let key = (VOTES, proposal_id, voter.clone());
    env.storage().persistent().get(&key)
}

pub fn get_voter_eligibility(env: &Env, voter: &Address) -> VoterEligibility {
    let nft_count = get_user_nft_count(env, voter);
    let reputation = get_reputation_boost(env, voter);
    let reputation_score = reputation.map(|r| r.reputation_score).unwrap_or(0);

    let base_voting_power = nft_count as u64;
    let reputation_bonus =
        (reputation_score as u64 * get_governance_config(env).reputation_voting_weight) / 1000;
    let voting_power = base_voting_power + reputation_bonus;

    VoterEligibility {
        address: voter.clone(),
        nft_count,
        reputation_score,
        voting_power,
        is_verified: is_verified_account(env, voter),
    }
}

pub fn get_user_nft_count(env: &Env, _user: &Address) -> u32 {
    1
}

pub fn is_verified_account(env: &Env, _address: &Address) -> bool {
    true
}

pub fn create_proposal(
    env: &Env,
    creator: &Address,
    proposal_type: ProposalType,
    title: String,
    description: String,
    vote_end: u64,
) -> Result<u64, NFTError> {
    let config = get_governance_config(env);
    let current_time = env.ledger().timestamp();

    let voter_eligibility = get_voter_eligibility(env, creator);
    if voter_eligibility.reputation_score < config.min_reputation_to_propose {
        return Err(NFTError::Unauthorized);
    }

    if !voter_eligibility.is_verified {
        return Err(NFTError::Unauthorized);
    }

    let duration = vote_end.saturating_sub(current_time);
    if duration < config.min_proposal_duration || duration > config.max_proposal_duration {
        return Err(NFTError::Unauthorized);
    }

    if title.len() == 0 || description.len() == 0 {
        return Err(NFTError::Unauthorized);
    }

    let proposal_id = get_next_proposal_id(env);

    let total_supply = get_total_nft_supply(env);
    let quorum_required = (total_supply * config.min_quorum_percentage) / 10000;
    let approval_threshold = config.min_approval_percentage;

    let proposal = Proposal {
        proposal_id,
        creator: creator.clone(),
        proposal_type: proposal_type.clone(),
        title: title.clone(),
        description,
        vote_end,
        status: ProposalStatus::Pending,
        yes_votes: 0,
        no_votes: 0,
        total_voting_power: 0,
        quorum_required,
        approval_threshold,
        created_at: current_time,
        executed_at: None,
    };

    store_proposal(env, &proposal);

    let event = ProposalCreatedEvent {
        proposal_id,
        creator: creator.clone(),
        proposal_type,
        title,
        vote_end,
        timestamp: current_time,
    };

    env.events().publish((PROPOSAL_CREATED_EVENT,), event);

    Ok(proposal_id)
}

pub fn vote_on_proposal(
    env: &Env,
    voter: &Address,
    proposal_id: u64,
    vote: bool,
) -> Result<(), NFTError> {
    let mut proposal = get_proposal(env, proposal_id).ok_or(NFTError::TokenNotFound)?;
    let current_time = env.ledger().timestamp();

    if proposal.status != ProposalStatus::Pending {
        return Err(NFTError::Unauthorized);
    }

    if current_time >= proposal.vote_end {
        return Err(NFTError::Unauthorized);
    }

    if get_vote(env, proposal_id, voter).is_some() {
        return Err(NFTError::Unauthorized);
    }

    let voter_eligibility = get_voter_eligibility(env, voter);
    let config = get_governance_config(env);

    if voter_eligibility.nft_count < config.min_nfts_to_vote {
        return Err(NFTError::Unauthorized);
    }

    if !voter_eligibility.is_verified {
        return Err(NFTError::Unauthorized);
    }

    let voting_power = voter_eligibility.voting_power;

    let vote_record = Vote {
        proposal_id,
        voter: voter.clone(),
        vote,
        voting_power,
        timestamp: current_time,
    };

    store_vote(env, &vote_record);

    if vote {
        proposal.yes_votes += voting_power;
    } else {
        proposal.no_votes += voting_power;
    }
    proposal.total_voting_power += voting_power;

    store_proposal(env, &proposal);

    let event = VoteCastEvent {
        proposal_id,
        voter: voter.clone(),
        vote,
        voting_power,
        timestamp: current_time,
    };

    env.events().publish((VOTE_CAST_EVENT,), event);

    Ok(())
}

pub fn finalize_proposal(env: &Env, caller: &Address, proposal_id: u64) -> Result<(), NFTError> {
    let mut proposal = get_proposal(env, proposal_id).ok_or(NFTError::TokenNotFound)?;
    let current_time = env.ledger().timestamp();

    if proposal.status != ProposalStatus::Pending {
        return Err(NFTError::Unauthorized);
    }

    if current_time < proposal.vote_end {
        return Err(NFTError::Unauthorized);
    }

    let total_votes = proposal.yes_votes + proposal.no_votes;

    let new_status = if total_votes < proposal.quorum_required {
        ProposalStatus::Expired
    } else {
        let approval_percentage = (proposal.yes_votes * 10000) / total_votes;
        if approval_percentage >= proposal.approval_threshold {
            ProposalStatus::Approved
        } else {
            ProposalStatus::Rejected
        }
    };

    proposal.status = new_status.clone();
    store_proposal(env, &proposal);

    let event = ProposalFinalizedEvent {
        proposal_id,
        status: new_status.clone(),
        yes_votes: proposal.yes_votes,
        no_votes: proposal.no_votes,
        total_voting_power: proposal.total_voting_power,
        timestamp: current_time,
    };

    env.events().publish((PROPOSAL_FINALIZED_EVENT,), event);

    if new_status == ProposalStatus::Approved {
        execute_proposal(env, &proposal)?;
    }

    Ok(())
}

pub fn execute_proposal(env: &Env, proposal: &Proposal) -> Result<(), NFTError> {
    match proposal.proposal_type {
        ProposalType::RoyaltyAdjustment => execute_royalty_adjustment(env, proposal),
        ProposalType::FeatureEnhancement => execute_feature_enhancement(env, proposal),
        ProposalType::ContentCuration => execute_content_curation(env, proposal),
        ProposalType::MetadataUpdate => execute_metadata_update(env, proposal),
        ProposalType::PlatformUpgrade => execute_platform_upgrade(env, proposal),
    }
}

pub fn execute_royalty_adjustment(env: &Env, proposal: &Proposal) -> Result<(), NFTError> {
    let current_time = env.ledger().timestamp();

    env.events().publish(
        (GOVERNANCE_ACTION_EVENT,),
        (
            proposal.proposal_id,
            String::from_str(env, "RoyaltyAdjustment"),
            current_time,
        ),
    );

    Ok(())
}

pub fn execute_feature_enhancement(env: &Env, proposal: &Proposal) -> Result<(), NFTError> {
    let current_time = env.ledger().timestamp();

    env.events().publish(
        (GOVERNANCE_ACTION_EVENT,),
        (
            proposal.proposal_id,
            String::from_str(env, "FeatureEnhancement"),
            current_time,
        ),
    );

    Ok(())
}

pub fn execute_content_curation(env: &Env, proposal: &Proposal) -> Result<(), NFTError> {
    let current_time = env.ledger().timestamp();

    env.events().publish(
        (GOVERNANCE_ACTION_EVENT,),
        (
            proposal.proposal_id,
            String::from_str(env, "ContentCuration"),
            current_time,
        ),
    );

    Ok(())
}

pub fn execute_metadata_update(env: &Env, proposal: &Proposal) -> Result<(), NFTError> {
    let current_time = env.ledger().timestamp();

    env.events().publish(
        (GOVERNANCE_ACTION_EVENT,),
        (
            proposal.proposal_id,
            String::from_str(env, "MetadataUpdate"),
            current_time,
        ),
    );

    Ok(())
}

pub fn execute_platform_upgrade(env: &Env, proposal: &Proposal) -> Result<(), NFTError> {
    let current_time = env.ledger().timestamp();

    env.events().publish(
        (GOVERNANCE_ACTION_EVENT,),
        (
            proposal.proposal_id,
            String::from_str(env, "PlatformUpgrade"),
            current_time,
        ),
    );

    Ok(())
}

pub fn get_total_nft_supply(env: &Env) -> u64 {
    1000
}

pub fn get_active_proposals(env: &Env) -> Vec<Proposal> {
    Vec::new(env)
}

pub fn get_proposals_by_creator(env: &Env, _creator: &Address) -> Vec<Proposal> {
    Vec::new(env)
}

pub fn get_proposal_votes(env: &Env, _proposal_id: u64) -> Vec<Vote> {
    Vec::new(env)
}

pub fn update_governance_config(
    env: &Env,
    _caller: &Address,
    config: GovernanceConfig,
) -> Result<(), NFTError> {
    env.storage().persistent().set(&GOVERNANCE_CONFIG, &config);
    Ok(())
}
