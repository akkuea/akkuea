use crate::educator_contract::{self, Client as EducatorClient};
use crate::{TippingRewards, TippingRewardsClient};
use soroban_sdk::{
    testutils::Address as _,  // Import Address testutils for generating test addresses
    Address, Env, String, Vec,
};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};  // Import token clients for testing with tokens

/**
 * Test suite for the TippingRewards smart contract
 * These tests verify the core functionality of the contract in a simulated environment
 */

/// Test the basic functionality of sending tips and tracking tip history
///
/// This test verifies:
/// 1. Token transfers between users and educators
/// 2. Recording of tip transactions
/// 3. Retrieving tip history by sender and recipient
#[test]
fn test_send_and_track_tips() {
    // Create a default test environment
    let env = Env::default();
    
    // Generate test addresses for the actors in our test
    let admin = Address::generate(&env);       // Admin for the educator contract
    let educator = Address::generate(&env);    // Educator who will receive tips
    let tipper = Address::generate(&env);      // User who will send tips
    
    // Set up a token contract for testing tip transfers
    // Deploy the Stellar Asset Contract
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    
    // Get the contract address for future reference
    let token_address = token_contract.address();
    
    // Create the token client (for standard token operations)
    let token = TokenClient::new(&env, &token_address);
    
    // Create the Stellar Asset specific client (for SAC-specific operations like mint)
    let token_sac = StellarAssetClient::new(&env, &token_address);
    
    // Mock all authentications to simulate signed transactions
    env.mock_all_auths();
    
    // Mint tokens to the tipper for testing
    token_sac.mint(&tipper, &1000);
    
    // Verify the tokens were successfully minted
    assert_eq!(token.balance(&tipper), 1000);
    
    // Deploy educator verification contract
    let educator_contract_id = env.register(educator_contract::WASM, ());
    let educator_client = EducatorClient::new(&env, &educator_contract_id);
    
    // Initialize educator contract with admin
    educator_client.initialize(&admin);
    
    // Register a test educator in the educator contract
    educator_client.register_educator(
        &educator,
        &String::from_str(&env, "Test Educator"),  // Name
        &Vec::new(&env),                           // Empty credentials list
        &Vec::new(&env),                           // Empty specialties list
    );
    
    // Deploy the tipping rewards contract and initialize it with the educator contract address
    let contract_id = env.register(TippingRewards, (&educator_contract_id,));
    let client = TippingRewardsClient::new(&env, &contract_id);
    
    // Send a test tip of 100 tokens
    client.send_tip(&token_address, &tipper, &educator, &100);
    
    // Verify tip history is correctly recorded
    let tips_sent = client.get_tips_sent(&tipper);         // Tips sent by tipper
    let tips_received = client.get_tips_received(&educator); // Tips received by educator
    
    // Assert that exactly one tip transaction was recorded for both sender and recipient
    assert_eq!(tips_sent.len(), 1);
    assert_eq!(tips_received.len(), 1);
}

/// Test the educator reputation calculation functionality
///
/// This test verifies:
/// 1. Correct registration and verification of educators
/// 2. Proper recording of tips to educators
/// 3. Accurate reputation calculation based on tips
#[test]
fn test_educator_reputation() {
    // Create a default test environment
    let env = Env::default();
    
    // Generate test addresses for participants
    let admin = Address::generate(&env);      // Contract admin
    let educator1 = Address::generate(&env);  // Educator to be tipped
    let tipper = Address::generate(&env);     // User who will send tips
    let reviewer = Address::generate(&env);   // Reviewer who can verify credentials
    
    // Deploy the Stellar Asset Contract for token operations
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    
    // Create token clients for standard and Stellar-specific operations
    let token = TokenClient::new(&env, &token_address);
    let token_sac = StellarAssetClient::new(&env, &token_address);
    
    // Mock all authentications and mint tokens to the tipper
    env.mock_all_auths();
    token_sac.mint(&tipper, &1000);
    
    // Verify the tokens were successfully minted
    assert_eq!(token.balance(&tipper), 1000);
    
    // Deploy and initialize educator verification contract
    let educator_contract_id = env.register(educator_contract::WASM, ());
    let educator_client = EducatorClient::new(&env, &educator_contract_id);
    educator_client.initialize(&admin);
    
    // Add a reviewer who can verify educator credentials
    env.mock_all_auths();
    educator_client.add_reviewer(&admin, &reviewer);
    
    // Create a test credential for the educator
    // Using a 64-character hash to simulate a real credential
    let credential_hash = String::from_str(&env, "0123456789012345678901234567890123456789012345678901234567890123");
    let mut credentials = Vec::new(&env);
    credentials.push_back(credential_hash.clone());
    
    // Register an educator with the test credential
    educator_client.register_educator(
        &educator1,
        &String::from_str(&env, "Educator One"),
        &credentials,
        &Vec::new(&env),  // No specialties for this test
    );
    
    // Verify the educator's credential
    let credential = credentials.get_unchecked(0);
    educator_client.add_verified_credential(&reviewer, &credential);
    
    // Deploy tipping rewards contract
    let contract_id = env.register(TippingRewards, (&educator_contract_id,));
    let client = TippingRewardsClient::new(&env, &contract_id);
    
    // Send a tip to the educator
    client.send_tip(&token_address, &tipper, &educator1, &200);
    
    // Verify the tip was recorded correctly
    let educator1_tips = client.get_tips_received(&educator1);
    assert_eq!(educator1_tips.len(), 1);
    
    // Test the reputation calculation functionality
    let reputation = client.get_educator_reputation(&educator1);
    
    // Verify the total tips amount matches what we sent
    assert_eq!(reputation.0, 200);
    
    // Note: We're not testing average rating here since no reviews were added
    // In a more comprehensive test, we would add reviews and verify the complete
    // reputation calculation including ratings
}