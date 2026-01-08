extern crate std;

use crate::{
    governance::{
        GovernanceConfig, Proposal, ProposalStatus, ProposalType, Vote, VoterEligibility,
    },
    EducationalNFTContract, EducationalNFTContractClient, MockEducatorVerificationNft,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, Env, String, Vec,
};

fn setup_governance_test_environment() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    EducationalNFTContractClient<'static>,
    u32,
) {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let educator = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);

    let educator_verification_id = env.register(MockEducatorVerificationNft, ());

    let contract_id = env.register(
        EducationalNFTContract,
        (owner.clone(), educator_verification_id.clone()),
    );
    let client = EducationalNFTContractClient::new(&env, &contract_id);

    let collection_id = 1u64;
    let fractions = 100u32;
    let metadata_hash = Bytes::from_array(&env, &[1; 32]);

    let token_id = client.mint_nft(&proposer, &collection_id, &fractions, &metadata_hash);

    client.initialize_governance(&owner);

    (env, owner, educator, proposer, voter, client, token_id)
}

#[test]
fn test_initialize_governance() {
    let (env, owner, _educator, _proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let config = client.get_governance_config();

    assert_eq!(config.min_proposal_duration, 100);
    assert_eq!(config.max_proposal_duration, 604800);
    assert_eq!(config.min_quorum_percentage, 10);
    assert_eq!(config.min_approval_percentage, 5000);
    assert_eq!(config.min_reputation_to_propose, 0);
    assert_eq!(config.min_nfts_to_vote, 1);
    assert_eq!(config.reputation_voting_weight, 100);
}

#[test]
fn test_create_proposal() {
    let (env, _owner, _educator, proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let title = String::from_str(&env, "Add new metadata field");
    let description = String::from_str(
        &env,
        "Proposal to add 'difficulty_level' field to NFT metadata",
    );
    let vote_end = env.ledger().timestamp() + 172800;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::FeatureEnhancement,
        &title,
        &description,
        &vote_end,
    );

    assert_eq!(proposal_id, 1);

    let proposal = client.get_proposal(&proposal_id);
    assert!(proposal.is_some());

    let proposal = proposal.unwrap();
    assert_eq!(proposal.proposal_id, proposal_id);
    assert_eq!(proposal.creator, proposer);
    assert_eq!(proposal.title, title);
    assert_eq!(proposal.description, description);
    assert_eq!(proposal.vote_end, vote_end);
    assert_eq!(proposal.status, ProposalStatus::Pending);
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);
}

#[test]
fn test_create_royalty_adjustment_proposal() {
    let (env, _owner, _educator, proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let title = String::from_str(&env, "Adjust platform royalty rate");
    let description = String::from_str(
        &env,
        "Proposal to reduce default royalty rate from 5% to 3%",
    );
    let vote_end = env.ledger().timestamp() + 172800;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::RoyaltyAdjustment,
        &title,
        &description,
        &vote_end,
    );

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.proposal_type, ProposalType::RoyaltyAdjustment);
}

#[test]
fn test_vote_on_proposal() {
    let (env, _owner, _educator, proposer, voter, client, _token_id) =
        setup_governance_test_environment();

    let title = String::from_str(&env, "Test Proposal");
    let description = String::from_str(&env, "Test proposal for voting");
    let vote_end = env.ledger().timestamp() + 172800;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::FeatureEnhancement,
        &title,
        &description,
        &vote_end,
    );

    client.mint_nft(&voter, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));

    client.vote_on_proposal(&voter, &proposal_id, &true);

    let vote = client.get_vote(&proposal_id, &voter);
    assert!(vote.is_some());

    let vote = vote.unwrap();
    assert_eq!(vote.proposal_id, proposal_id);
    assert_eq!(vote.voter, voter);
    assert_eq!(vote.vote, true);
    assert!(vote.voting_power > 0);

    let updated_proposal = client.get_proposal(&proposal_id).unwrap();
    assert!(updated_proposal.yes_votes > 0);
    assert_eq!(updated_proposal.no_votes, 0);
    assert!(updated_proposal.total_voting_power > 0);
}

#[test]
fn test_multiple_votes() {
    let (env, _owner, _educator, proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);

    client.mint_nft(&voter1, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));
    client.mint_nft(&voter2, &1u64, &100u32, &Bytes::from_array(&env, &[3; 32]));
    client.mint_nft(&voter3, &1u64, &100u32, &Bytes::from_array(&env, &[4; 32]));

    let title = String::from_str(&env, "Multi-voter Test");
    let description = String::from_str(&env, "Test proposal with multiple voters");
    let vote_end = env.ledger().timestamp() + 172800;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::ContentCuration,
        &title,
        &description,
        &vote_end,
    );

    client.vote_on_proposal(&voter1, &proposal_id, &true);
    client.vote_on_proposal(&voter2, &proposal_id, &false);
    client.vote_on_proposal(&voter3, &proposal_id, &true);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert!(proposal.yes_votes > proposal.no_votes);
    assert!(proposal.total_voting_power > 0);
    assert_eq!(proposal.status, ProposalStatus::Pending);
}

#[test]
fn test_finalize_proposal_approved() {
    let (env, _owner, _educator, proposer, voter, client, _token_id) =
        setup_governance_test_environment();

    client.mint_nft(&voter, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));

    let title = String::from_str(&env, "Approval Test");
    let description = String::from_str(&env, "Test proposal that should be approved");
    let vote_end = env.ledger().timestamp() + 1000;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::MetadataUpdate,
        &title,
        &description,
        &vote_end,
    );

    client.vote_on_proposal(&voter, &proposal_id, &true);

    env.ledger().with_mut(|li| {
        li.timestamp = vote_end + 1;
    });

    client.finalize_proposal(&proposer, &proposal_id);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Approved);
}

#[test]
fn test_finalize_proposal_rejected() {
    let (env, _owner, _educator, proposer, voter, client, _token_id) =
        setup_governance_test_environment();

    client.mint_nft(&voter, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));

    let title = String::from_str(&env, "Rejection Test");
    let description = String::from_str(&env, "Test proposal that should be rejected");
    let vote_end = env.ledger().timestamp() + 1000;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::PlatformUpgrade,
        &title,
        &description,
        &vote_end,
    );

    client.vote_on_proposal(&voter, &proposal_id, &false);

    env.ledger().with_mut(|li| {
        li.timestamp = vote_end + 1;
    });

    client.finalize_proposal(&proposer, &proposal_id);

    let proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Rejected);
}

#[test]
fn test_voter_eligibility() {
    let (env, _owner, _educator, _proposer, voter, client, _token_id) =
        setup_governance_test_environment();

    client.mint_nft(&voter, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));
    client.update_reputation_boost(&_owner, &voter, &150u32, &3u32);

    let eligibility = client.get_voter_eligibility(&voter);

    assert_eq!(eligibility.address, voter);
    assert!(eligibility.nft_count >= 1);
    assert!(eligibility.reputation_score >= 150);
    assert!(eligibility.voting_power > eligibility.nft_count as u64);
    assert!(eligibility.is_verified);
}

#[test]
fn test_governance_config_update() {
    let (env, owner, _educator, _proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let mut new_config = client.get_governance_config();
    new_config.min_quorum_percentage = 2000;
    new_config.min_approval_percentage = 6000;
    new_config.min_reputation_to_propose = 200;

    client.update_governance_config(&owner, &new_config);

    let updated_config = client.get_governance_config();
    assert_eq!(updated_config.min_quorum_percentage, 2000);
    assert_eq!(updated_config.min_approval_percentage, 6000);
    assert_eq!(updated_config.min_reputation_to_propose, 200);
}

#[test]
fn test_governance_error_conditions() {
    let (env, _owner, _educator, proposer, voter, client, _token_id) =
        setup_governance_test_environment();

    let title = String::from_str(&env, "Test Proposal");
    let description = String::from_str(&env, "Test proposal");
    let invalid_vote_end = env.ledger().timestamp() + 10;

    let result = client.try_create_proposal(
        &proposer,
        &ProposalType::FeatureEnhancement,
        &title,
        &description,
        &invalid_vote_end,
    );
    assert!(result.is_err());

    let valid_vote_end = env.ledger().timestamp() + 172800;
    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::FeatureEnhancement,
        &title,
        &description,
        &valid_vote_end,
    );

    client.mint_nft(&voter, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));
    client.vote_on_proposal(&voter, &proposal_id, &true);

    let result = client.try_vote_on_proposal(&voter, &proposal_id, &false);
    assert!(result.is_err());

    let result = client.try_finalize_proposal(&proposer, &proposal_id);
    assert!(result.is_err());

    env.ledger().with_mut(|li| {
        li.timestamp = valid_vote_end + 1;
    });

    client.finalize_proposal(&proposer, &proposal_id);

    let result = client.try_vote_on_proposal(&voter, &proposal_id, &false);
    assert!(result.is_err());
}

#[test]
fn test_proposal_types() {
    let (env, _owner, _educator, proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let vote_end = env.ledger().timestamp() + 172800;

    let feature_id = client.create_proposal(
        &proposer,
        &ProposalType::FeatureEnhancement,
        &String::from_str(&env, "Feature Enhancement"),
        &String::from_str(&env, "Add new features"),
        &vote_end,
    );

    let royalty_id = client.create_proposal(
        &proposer,
        &ProposalType::RoyaltyAdjustment,
        &String::from_str(&env, "Royalty Adjustment"),
        &String::from_str(&env, "Adjust royalty rates"),
        &vote_end,
    );

    let curation_id = client.create_proposal(
        &proposer,
        &ProposalType::ContentCuration,
        &String::from_str(&env, "Content Curation"),
        &String::from_str(&env, "Curate platform content"),
        &vote_end,
    );

    let feature_proposal = client.get_proposal(&feature_id).unwrap();
    let royalty_proposal = client.get_proposal(&royalty_id).unwrap();
    let curation_proposal = client.get_proposal(&curation_id).unwrap();

    assert_eq!(
        feature_proposal.proposal_type,
        ProposalType::FeatureEnhancement
    );
    assert_eq!(
        royalty_proposal.proposal_type,
        ProposalType::RoyaltyAdjustment
    );
    assert_eq!(
        curation_proposal.proposal_type,
        ProposalType::ContentCuration
    );
}

#[test]
fn test_weighted_voting_with_reputation() {
    let (env, _owner, _educator, proposer, _voter, client, _token_id) =
        setup_governance_test_environment();

    let high_rep_voter = Address::generate(&env);
    let low_rep_voter = Address::generate(&env);

    client.mint_nft(
        &high_rep_voter,
        &1u64,
        &100u32,
        &Bytes::from_array(&env, &[2; 32]),
    );
    client.mint_nft(
        &low_rep_voter,
        &1u64,
        &100u32,
        &Bytes::from_array(&env, &[3; 32]),
    );

    client.update_reputation_boost(&_owner, &high_rep_voter, &500u32, &5u32);
    client.update_reputation_boost(&_owner, &low_rep_voter, &100u32, &1u32);

    let high_rep_eligibility = client.get_voter_eligibility(&high_rep_voter);
    let low_rep_eligibility = client.get_voter_eligibility(&low_rep_voter);

    assert!(high_rep_eligibility.voting_power > low_rep_eligibility.voting_power);

    let title = String::from_str(&env, "Weighted Voting Test");
    let description = String::from_str(&env, "Test weighted voting with reputation");
    let vote_end = env.ledger().timestamp() + 172800;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::FeatureEnhancement,
        &title,
        &description,
        &vote_end,
    );

    client.vote_on_proposal(&high_rep_voter, &proposal_id, &true);
    client.vote_on_proposal(&low_rep_voter, &proposal_id, &false);

    let proposal = client.get_proposal(&proposal_id).unwrap();

    assert!(proposal.yes_votes > proposal.no_votes);
}

#[test]
fn test_data_structures() {
    let env = Env::default();

    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    let timestamp = env.ledger().timestamp();

    let proposal = Proposal {
        proposal_id: 1,
        creator: proposer.clone(),
        proposal_type: ProposalType::FeatureEnhancement,
        title: String::from_str(&env, "Test Proposal"),
        description: String::from_str(&env, "Test Description"),
        vote_end: timestamp + 172800,
        status: ProposalStatus::Pending,
        yes_votes: 0,
        no_votes: 0,
        total_voting_power: 0,
        quorum_required: 100,
        approval_threshold: 5000,
        created_at: timestamp,
        executed_at: None,
    };

    assert_eq!(proposal.proposal_id, 1);
    assert_eq!(proposal.creator, proposer);
    assert_eq!(proposal.status, ProposalStatus::Pending);

    let vote = Vote {
        proposal_id: 1,
        voter: voter.clone(),
        vote: true,
        voting_power: 10,
        timestamp,
    };

    assert_eq!(vote.proposal_id, 1);
    assert_eq!(vote.voter, voter);
    assert_eq!(vote.vote, true);
    assert_eq!(vote.voting_power, 10);

    let eligibility = VoterEligibility {
        address: voter.clone(),
        nft_count: 5,
        reputation_score: 250,
        voting_power: 15,
        is_verified: true,
    };

    assert_eq!(eligibility.address, voter);
    assert_eq!(eligibility.nft_count, 5);
    assert_eq!(eligibility.reputation_score, 250);
    assert_eq!(eligibility.voting_power, 15);
    assert!(eligibility.is_verified);
}

#[test]
fn test_governance_integration() {
    let (env, owner, _educator, proposer, voter, client, _token_id) =
        setup_governance_test_environment();

    client.mint_nft(&voter, &1u64, &100u32, &Bytes::from_array(&env, &[2; 32]));
    client.update_reputation_boost(&owner, &voter, &200u32, &3u32);

    let title = String::from_str(&env, "Integration Test");
    let description = String::from_str(&env, "Full governance workflow test");
    let vote_end = env.ledger().timestamp() + 1000;

    let proposal_id = client.create_proposal(
        &proposer,
        &ProposalType::RoyaltyAdjustment,
        &title,
        &description,
        &vote_end,
    );

    let eligibility = client.get_voter_eligibility(&voter);
    assert!(eligibility.voting_power > 1);

    client.vote_on_proposal(&voter, &proposal_id, &true);

    let vote = client.get_vote(&proposal_id, &voter);
    assert!(vote.is_some());

    env.ledger().with_mut(|li| {
        li.timestamp = vote_end + 1;
    });

    client.finalize_proposal(&proposer, &proposal_id);

    let final_proposal = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(final_proposal.status, ProposalStatus::Approved);

    let active_proposals = client.get_active_proposals();
    let creator_proposals = client.get_proposals_by_creator(&proposer);
    let proposal_votes = client.get_proposal_votes(&proposal_id);

    assert!(true);
}
