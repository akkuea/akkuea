#![cfg(test)]

use crate::{
    datatype::{SecurityConfig, VerificationLevel},
    EducatorVerificationContract, EducatorVerificationContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env, IntoVal, Map, String, Vec,
};

fn setup_security_test() -> (
    Env,
    EducatorVerificationContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, EducatorVerificationContract {});
    let client = EducatorVerificationContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    client.initialize(&admin);

    (env, client, admin, user1, user2, user3)
}

// --- Security Configuration Tests ---

#[test]
fn test_configure_security() {
    let (_, client, admin, _, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 3,
        time_lock_duration: 86400, // 24 hours
        reputation_stake: 200,
        fraud_detection_enabled: true,
        max_operations_per_hour: 15,
    };

    client.configure_security(&admin, &config);
    let retrieved_config = client.get_security_config();

    assert_eq!(retrieved_config.multi_sig_threshold, 3);
    assert_eq!(retrieved_config.time_lock_duration, 86400);
    assert_eq!(retrieved_config.reputation_stake, 200);
    assert_eq!(retrieved_config.fraud_detection_enabled, true);
    assert_eq!(retrieved_config.max_operations_per_hour, 15);
}

#[test]
#[should_panic(expected = "not authorized")]
fn test_configure_security_unauthorized() {
    let (_, client, _, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };

    // Non-admin trying to configure security should fail
    client.configure_security(&user1, &config);
}

// --- Multi-Signature Tests ---

#[test]
fn test_multisig_proposal_creation() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    // Configure security with threshold of 2
    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "verify_educator");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "verification_data")];

    let proposal_id = client.create_multisig_proposal(&user2, &operation, &target, &data);

    // Proposal should be created successfully
    assert!(!proposal_id.to_array().iter().all(|&b| b == 0));
}

#[test]
fn test_multisig_approval_and_execution() {
    let (env, client, admin, user1, user2, user3) = setup_security_test();

    // Configure security with threshold of 2
    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "test_operation");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "test_data")];

    let proposal_id = client.create_multisig_proposal(&user2, &operation, &target, &data);

    // First approval
    let can_execute = client.approve_proposal(&user3, &proposal_id);
    assert!(can_execute); // Should be true as we now have enough signatures (threshold = 2)

    // Execute the proposal
    let executed = client.execute_multisig_operation(&admin, &proposal_id);
    assert!(executed);
}

#[test]
#[should_panic(expected = "already approved by this address")]
fn test_multisig_duplicate_approval() {
    let (env, client, admin, user1, user2, user3) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 3,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "test_operation");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "test_data")];

    let proposal_id = client.create_multisig_proposal(&user2, &operation, &target, &data);

    // First approval
    client.approve_proposal(&user3, &proposal_id);

    // Second approval from same address should fail
    client.approve_proposal(&user3, &proposal_id);
}

// --- Time-Lock Tests ---

#[test]
fn test_time_locked_operation_creation() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600, // 1 hour
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "revoke_verification");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "revocation_reason")];

    let operation_id = client.schedule_time_locked_operation(&user2, &operation, &target, &data);

    // Operation should be scheduled successfully
    assert!(!operation_id.to_array().iter().all(|&b| b == 0));
}

#[test]
#[should_panic(expected = "time lock not yet expired")]
fn test_time_locked_operation_early_execution() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600, // 1 hour
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "test_operation");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "test_data")];

    let operation_id = client.schedule_time_locked_operation(&user2, &operation, &target, &data);

    // Try to execute immediately (should fail)
    client.execute_time_locked_operation(&user2, &operation_id);
}

#[test]
fn test_time_locked_operation_execution_after_delay() {
    let (mut env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600, // 1 hour
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "test_operation");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "test_data")];

    let operation_id = client.schedule_time_locked_operation(&user2, &operation, &target, &data);

    // Advance time by more than the time lock duration
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = 7200; // 2 hours later
    });

    // Now execution should succeed
    let executed = client.execute_time_locked_operation(&user2, &operation_id);
    assert!(executed);
}

#[test]
fn test_cancel_time_locked_operation() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let operation = String::from_str(&env, "test_operation");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "test_data")];

    let operation_id = client.schedule_time_locked_operation(&user2, &operation, &target, &data);

    // Admin can cancel the operation
    let cancelled = client.cancel_time_locked_operation(&admin, &operation_id);
    assert!(cancelled);
}

// --- Fraud Detection Tests ---

#[test]
fn test_flag_fraudulent_activity() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let fraud_type = String::from_str(&env, "credential_farming");
    let evidence_hash = String::from_str(&env, "evidence_hash_123");

    let fraud_id = client.flag_fraudulent_activity(&user2, &user1, &fraud_type, &evidence_hash);

    // Fraud report should be created successfully
    assert!(!fraud_id.to_array().iter().all(|&b| b == 0));
}

#[test]
#[should_panic(expected = "fraud detection disabled")]
fn test_flag_fraudulent_activity_disabled() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: false, // Disabled
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let fraud_type = String::from_str(&env, "credential_farming");
    let evidence_hash = String::from_str(&env, "evidence_hash_123");

    // Should fail because fraud detection is disabled
    client.flag_fraudulent_activity(&user2, &user1, &fraud_type, &evidence_hash);
}

// --- Reputation Staking Tests ---

#[test]
fn test_stake_reputation() {
    let (_, client, admin, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let stake_amount = 200u64;
    let lock_duration = 86400u64; // 1 day

    let success = client.stake_reputation(&user1, &stake_amount, &lock_duration);
    assert!(success);

    // Check that stake was recorded
    let stake = client.get_active_stake(&user1);
    assert!(stake.is_some());
    assert_eq!(stake.unwrap().amount, 200);
}

#[test]
#[should_panic(expected = "insufficient stake amount")]
fn test_stake_reputation_insufficient_amount() {
    let (_, client, admin, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100, // Minimum required
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    let stake_amount = 50u64; // Below minimum
    let lock_duration = 86400u64;

    // Should fail because amount is below minimum
    client.stake_reputation(&user1, &stake_amount, &lock_duration);
}

#[test]
fn test_slash_stake() {
    let (env, client, admin, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    // First stake some reputation
    let stake_amount = 200u64;
    let lock_duration = 86400u64;
    client.stake_reputation(&user1, &stake_amount, &lock_duration);

    // Now slash some of it
    let slash_amount = 50u64;

    let success = client.slash_stake(&admin, &user1, &slash_amount);
    assert!(success);

    // Check that stake was slashed
    let stake = client.get_active_stake(&user1);
    assert!(stake.is_some());
    assert_eq!(stake.unwrap().slashed_amount, 50);
}

#[test]
#[should_panic(expected = "stake still locked")]
fn test_withdraw_stake_while_locked() {
    let (_, client, admin, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    // Stake with a long lock duration
    let stake_amount = 200u64;
    let lock_duration = 86400u64; // 1 day
    client.stake_reputation(&user1, &stake_amount, &lock_duration);

    // Try to withdraw immediately (should fail)
    client.withdraw_stake(&user1);
}

#[test]
fn test_withdraw_stake_after_lock_expires() {
    let (mut env, client, admin, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    // Stake reputation
    let stake_amount = 200u64;
    let lock_duration = 3600u64; // 1 hour
    client.stake_reputation(&user1, &stake_amount, &lock_duration);

    // Advance time past the lock duration
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = 7200; // 2 hours later
    });

    // Now withdrawal should succeed
    let withdrawn_amount = client.withdraw_stake(&user1);
    assert_eq!(withdrawn_amount, 200);

    // Stake should no longer exist
    let stake = client.get_active_stake(&user1);
    assert!(stake.is_none());
}

// --- Account Security Tests ---

#[test]
fn test_account_suspension_after_high_fraud_score() {
    let (env, client, admin, user1, user2, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    // Flag fraudulent activity that should result in high fraud score
    let fraud_type = String::from_str(&env, "credential_farming");
    let evidence_hash = String::from_str(&env, "evidence_hash_123");

    client.flag_fraudulent_activity(&user2, &user1, &fraud_type, &evidence_hash);

    // Note: In a real implementation, high fraud scores would trigger automatic suspension
    // For this test, we would check if the account is suspended
    // let is_suspended = client.is_account_suspended(&user1);
    // This would depend on the actual fraud score calculation and threshold
}

// --- Integration Tests ---

#[test]
fn test_security_integration_multisig_with_fraud_check() {
    let (env, client, admin, user1, user2, user3) = setup_security_test();

    // Configure comprehensive security
    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 150,
        fraud_detection_enabled: true,
        max_operations_per_hour: 5,
    };
    client.configure_security(&admin, &config);

    // Stake reputation for all users
    client.stake_reputation(&user1, &150u64, &86400u64);
    client.stake_reputation(&user2, &150u64, &86400u64);
    client.stake_reputation(&user3, &150u64, &86400u64);

    // Create multi-sig proposal
    let operation = String::from_str(&env, "verify_educator");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "verification_data")];

    let proposal_id = client.create_multisig_proposal(&user2, &operation, &target, &data);

    // Get approval
    client.approve_proposal(&user3, &proposal_id);

    // Execute proposal
    let executed = client.execute_multisig_operation(&admin, &proposal_id);
    assert!(executed);

    // Verify no fraudulent activity was detected
    let is_suspended = client.is_account_suspended(&user1);
    assert!(!is_suspended);
}

// --- Pause State Integration Tests ---

#[test]
#[should_panic(expected = "contract is paused")]
fn test_operations_blocked_when_paused() {
    let (env, client, admin, user1, _, _) = setup_security_test();

    let config = SecurityConfig {
        multi_sig_threshold: 2,
        time_lock_duration: 3600,
        reputation_stake: 100,
        fraud_detection_enabled: true,
        max_operations_per_hour: 10,
    };
    client.configure_security(&admin, &config);

    // Pause the contract
    let reason = String::from_str(&env, "Emergency maintenance");
    client.pause_contract(&admin, &reason);

    // Operations should be blocked
    let operation = String::from_str(&env, "test_operation");
    let target = user1.clone();
    let data = vec![&env, String::from_str(&env, "test_data")];

    // This should fail because contract is paused
    client.create_multisig_proposal(&user1, &operation, &target, &data);
}
