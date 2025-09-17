#![cfg(test)]

use crate::{
    datatype::{ContractVersion, MigrationStatus},
    EducatorVerificationContract, EducatorVerificationContractClient,
};
use soroban_sdk::{testutils::{Address as _, Ledger}, vec, Address, Env, IntoVal, Map, String, Vec, BytesN};

fn setup_upgrade_test() -> (
    Env,
    EducatorVerificationContractClient<'static>,
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

    client.initialize(&admin);

    (env, client, admin, user1, user2)
}

// --- Version Management Tests ---

#[test]
fn test_get_version_info_initial() {
    let (_, client, _, _, _) = setup_upgrade_test();
    
    // Initially, no version should be set
    let version_info = client.get_version_info();
    assert!(version_info.is_none());
}

#[test]
fn test_set_implementation() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    let new_implementation = Address::generate(&env);
    let success = client.set_implementation(&admin, &new_implementation);
    assert!(success);
    
    let retrieved_impl = client.get_implementation();
    assert!(retrieved_impl.is_some());
    assert_eq!(retrieved_impl.unwrap(), new_implementation);
}

#[test]
#[should_panic(expected = "not authorized")]
fn test_set_implementation_unauthorized() {
    let (env, client, _, user1, _) = setup_upgrade_test();
    
    let new_implementation = Address::generate(&env);
    
    // Non-admin trying to set implementation should fail
    client.set_implementation(&user1, &new_implementation);
}

#[test]
fn test_upgrade_contract() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    let new_implementation = Address::generate(&env);
    let new_version = String::from_str(&env, "2.0.0");
    
    let success = client.upgrade_contract(&admin, &new_implementation, &new_version);
    assert!(success);
    
    // Check that contract is paused during upgrade
    let is_paused = client.is_contract_paused();
    assert!(is_paused);
    
    // Check that version info is updated
    let version_info = client.get_version_info();
    assert!(version_info.is_some());
    assert_eq!(version_info.unwrap().version_string, new_version);
}

// --- Contract Pause/Unpause Tests ---

#[test]
fn test_pause_contract() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    let reason = String::from_str(&env, "Maintenance");
    let success = client.pause_contract(&admin, &reason);
    assert!(success);
    
    let is_paused = client.is_contract_paused();
    assert!(is_paused);
}

#[test]
fn test_unpause_contract() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // First pause
    let reason = String::from_str(&env, "Maintenance");
    client.pause_contract(&admin, &reason);
    assert!(client.is_contract_paused());
    
    // Then unpause
    let success = client.unpause_contract(&admin);
    assert!(success);
    
    let is_paused = client.is_contract_paused();
    assert!(!is_paused);
}

#[test]
#[should_panic(expected = "not authorized")]
fn test_pause_contract_unauthorized() {
    let (env, client, _, user1, _) = setup_upgrade_test();
    
    let reason = String::from_str(&env, "Unauthorized pause");
    
    // Non-admin trying to pause should fail
    client.pause_contract(&user1, &reason);
}

#[test]
fn test_emergency_stop() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    let reason = String::from_str(&env, "Security breach");
    let success = client.emergency_stop(&admin, &reason);
    assert!(success);
    
    // Emergency stop should pause the contract
    let is_paused = client.is_contract_paused();
    assert!(is_paused);
}

// --- Data Migration Tests ---

#[test]
fn test_initialize_migration() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    let to_version = String::from_str(&env, "3.0.0");
    let migration_id = client.initialize_migration(&admin, &to_version);
    
    // Migration should be initialized successfully
    assert!(!migration_id.to_array().iter().all(|&b| b == 0));
}

#[test]
#[should_panic(expected = "not authorized")]
fn test_initialize_migration_unauthorized() {
    let (env, client, _, user1, _) = setup_upgrade_test();
    
    let to_version = String::from_str(&env, "3.0.0");
    
    // Non-admin trying to initialize migration should fail
    client.initialize_migration(&user1, &to_version);
}

#[test]
fn test_migrate_educators() {
    let (env, client, admin, user1, user2) = setup_upgrade_test();
    
    // First register some educators to have data to migrate
    let name1 = String::from_str(&env, "John Doe");
    let name2 = String::from_str(&env, "Jane Smith");
    client.register_educator(&user1, &name1, &Vec::new(&env), &Vec::new(&env));
    client.register_educator(&user2, &name2, &Vec::new(&env), &Vec::new(&env));
    
    // Initialize migration
    let to_version = String::from_str(&env, "3.0.0");
    client.initialize_migration(&admin, &to_version);
    
    // Migrate educators
    let batch_size = 10u32;
    let migrated_count = client.migrate_educators(&admin, &batch_size);
    
    // Since we don't have actual migration logic implemented, 
    // we expect the placeholder to return 0
    assert_eq!(migrated_count, 0);
}

#[test]
fn test_migrate_credentials() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // Initialize migration
    let to_version = String::from_str(&env, "3.0.0");
    client.initialize_migration(&admin, &to_version);
    
    // Migrate credentials
    let batch_size = 10u32;
    let migrated_count = client.migrate_credentials(&admin, &batch_size);
    
    // Placeholder implementation returns 0
    assert_eq!(migrated_count, 0);
}

#[test]
fn test_migrate_nfts() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // Initialize migration
    let to_version = String::from_str(&env, "3.0.0");
    client.initialize_migration(&admin, &to_version);
    
    // Migrate NFTs
    let batch_size = 10u32;
    let migrated_count = client.migrate_nfts(&admin, &batch_size);
    
    // Placeholder implementation returns 0
    assert_eq!(migrated_count, 0);
}

#[test]
fn test_complete_migration() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // Initialize migration
    let to_version = String::from_str(&env, "3.0.0");
    let migration_id = client.initialize_migration(&admin, &to_version);
    
    // Complete migration
    let success = client.complete_migration(&admin, &migration_id);
    assert!(success);
    
    // Contract should be unpaused after migration completion
    let is_paused = client.is_contract_paused();
    assert!(!is_paused);
}

#[test]
#[should_panic(expected = "invalid migration id")]
fn test_complete_migration_invalid_id() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // Initialize migration
    let to_version = String::from_str(&env, "3.0.0");
    client.initialize_migration(&admin, &to_version);
    
    // Try to complete with wrong migration ID
    let wrong_migration_id = BytesN::from_array(&env, &[1u8; 32]);
    client.complete_migration(&admin, &wrong_migration_id);
}

#[test]
fn test_validate_migration_integrity() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    let data_type = String::from_str(&env, "educators");
    let success = client.validate_migration_integrity(&admin, &data_type);
    
    // Placeholder implementation returns true
    assert!(success);
}

// --- Backward Compatibility Tests ---

#[test]
fn test_create_compatibility_adapter() {
    let (env, client, _, _, _) = setup_upgrade_test();
    
    let old_function = String::from_str(&env, "verify_credentials");
    let new_function = String::from_str(&env, "verify_credentials_v2");
    
    let success = client.create_compatibility_adapter(&old_function, &new_function);
    assert!(success);
}

#[test]
fn test_is_function_deprecated() {
    let (env, client, _, _, _) = setup_upgrade_test();
    
    let old_function = String::from_str(&env, "verify_credentials");
    let new_function = String::from_str(&env, "verify_credentials_v2");
    
    // Create adapter first
    client.create_compatibility_adapter(&old_function, &new_function);
    
    // Check if function is deprecated
    let is_deprecated = client.is_function_deprecated(&old_function);
    assert!(is_deprecated);
    
    // Check non-deprecated function
    let non_deprecated = String::from_str(&env, "some_other_function");
    let not_deprecated = client.is_function_deprecated(&non_deprecated);
    assert!(!not_deprecated);
}

#[test]
fn test_get_deprecation_warning() {
    let (env, client, _, _, _) = setup_upgrade_test();
    
    let old_function = String::from_str(&env, "verify_credentials");
    let new_function = String::from_str(&env, "verify_credentials_v2");
    
    // Create adapter first
    client.create_compatibility_adapter(&old_function, &new_function);
    
    // Get deprecation warning
    let retrieved_warning = client.get_deprecation_warning(&old_function);
    assert!(retrieved_warning.is_some());
    assert_eq!(retrieved_warning.unwrap(), new_function);
    
    // Check non-deprecated function
    let non_deprecated = String::from_str(&env, "some_other_function");
    let no_warning = client.get_deprecation_warning(&non_deprecated);
    assert!(no_warning.is_none());
}

// --- Rollback Tests ---

#[test]
#[should_panic(expected = "no previous version to rollback to")]
fn test_rollback_no_previous_version() {
    let (_, client, admin, _, _) = setup_upgrade_test();
    
    // Try to rollback when no previous version exists
    client.rollback_to_previous_version(&admin);
}

#[test]
fn test_rollback_to_previous_version() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // First, create some version history by upgrading
    let implementation_v1 = Address::generate(&env);
    let version_v1 = String::from_str(&env, "1.0.0");
    client.upgrade_contract(&admin, &implementation_v1, &version_v1);
    
    // Unpause to simulate normal operation
    client.unpause_contract(&admin);
    
    // Upgrade to v2
    let implementation_v2 = Address::generate(&env);
    let version_v2 = String::from_str(&env, "2.0.0");
    client.upgrade_contract(&admin, &implementation_v2, &version_v2);
    
    // Now rollback should work
    let success = client.rollback_to_previous_version(&admin);
    assert!(success);
    
    // Contract should be paused during rollback
    let is_paused = client.is_contract_paused();
    assert!(is_paused);
    
    // Implementation should be set to previous version
    let current_impl = client.get_implementation();
    assert!(current_impl.is_some());
    assert_eq!(current_impl.unwrap(), implementation_v1);
}

// --- Integration Tests ---

#[test]
fn test_full_upgrade_cycle() {
    let (env, client, admin, user1, user2) = setup_upgrade_test();
    
    // 1. Register some initial data
    let name1 = String::from_str(&env, "John Doe");
    let name2 = String::from_str(&env, "Jane Smith");
    client.register_educator(&user1, &name1, &Vec::new(&env), &Vec::new(&env));
    client.register_educator(&user2, &name2, &Vec::new(&env), &Vec::new(&env));
    
    // 2. Perform upgrade
    let new_implementation = Address::generate(&env);
    let new_version = String::from_str(&env, "2.0.0");
    let upgrade_success = client.upgrade_contract(&admin, &new_implementation, &new_version);
    assert!(upgrade_success);
    
    // 3. Initialize and perform migration
    let migration_id = client.initialize_migration(&admin, &new_version.clone());
    client.migrate_educators(&admin, &10u32);
    client.migrate_credentials(&admin, &10u32);
    client.migrate_nfts(&admin, &10u32);
    
    // 4. Validate integrity
    let educators_valid = client.validate_migration_integrity(&admin, &String::from_str(&env, "educators"));
    let credentials_valid = client.validate_migration_integrity(&admin, &String::from_str(&env, "credentials"));
    let nfts_valid = client.validate_migration_integrity(&admin, &String::from_str(&env, "nfts"));
    assert!(educators_valid);
    assert!(credentials_valid);
    assert!(nfts_valid);
    
    // 5. Complete migration
    let completion_success = client.complete_migration(&admin, &migration_id);
    assert!(completion_success);
    
    // 6. Verify contract is operational
    let is_paused = client.is_contract_paused();
    assert!(!is_paused);
    
    // 7. Verify version info
    let version_info = client.get_version_info();
    assert!(version_info.is_some());
    assert_eq!(version_info.unwrap().version_string, new_version);
}

#[test]
fn test_emergency_rollback_scenario() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // Setup initial version
    let implementation_v1 = Address::generate(&env);
    let version_v1 = String::from_str(&env, "1.0.0");
    client.upgrade_contract(&admin, &implementation_v1, &version_v1);
    client.unpause_contract(&admin);
    
    // Upgrade to problematic version
    let implementation_v2 = Address::generate(&env);
    let version_v2 = String::from_str(&env, "2.0.0-beta");
    client.upgrade_contract(&admin, &implementation_v2, &version_v2);
    
    // Emergency stop due to issues
    let emergency_reason = String::from_str(&env, "Critical bug detected");
    client.emergency_stop(&admin, &emergency_reason);
    
    // Rollback to previous version
    let rollback_success = client.rollback_to_previous_version(&admin);
    assert!(rollback_success);
    
    // Verify rollback
    let current_impl = client.get_implementation();
    assert_eq!(current_impl.unwrap(), implementation_v1);
}

#[test] 
fn test_compatibility_during_upgrade() {
    let (env, client, admin, _, _) = setup_upgrade_test();
    
    // Setup compatibility adapters before upgrade
    let old_function = String::from_str(&env, "verify_educator_v1");
    let new_function = String::from_str(&env, "verify_educator_v2");
    
    client.create_compatibility_adapter(&old_function, &new_function);
    
    // Perform upgrade
    let new_implementation = Address::generate(&env);
    let new_version = String::from_str(&env, "2.0.0");
    client.upgrade_contract(&admin, &new_implementation, &new_version);
    client.unpause_contract(&admin);
    
    // Verify compatibility adapters still work after upgrade
    let is_deprecated = client.is_function_deprecated(&old_function);
    assert!(is_deprecated);
    
    let retrieved_warning = client.get_deprecation_warning(&old_function);
    assert!(retrieved_warning.is_some());
    assert_eq!(retrieved_warning.unwrap(), new_function);
}

// --- Error Handling Tests ---

#[test]
#[should_panic(expected = "not authorized")]
fn test_migration_operations_require_admin() {
    let (env, client, admin, user1, _) = setup_upgrade_test();
    
    // Initialize migration as admin first
    let to_version = String::from_str(&env, "3.0.0");
    client.initialize_migration(&admin, &to_version);
    
    // Non-admin trying to migrate should fail
    client.migrate_educators(&user1, &10u32);
}

#[test]
#[should_panic(expected = "not authorized")]
fn test_rollback_requires_admin() {
    let (env, client, admin, user1, _) = setup_upgrade_test();
    
    // Setup some version history
    let implementation = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    client.upgrade_contract(&admin, &implementation, &version);
    
    // Non-admin trying to rollback should fail
    client.rollback_to_previous_version(&user1);
}