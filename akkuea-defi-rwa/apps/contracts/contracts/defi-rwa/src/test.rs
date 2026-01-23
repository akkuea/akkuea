#![cfg(test)]

use soroban_sdk::{Address, Env, String, vec};
use soroban_sdk::testutils::Address as AddressTrait;

use super::{PropertyTokenContract, PropertyTokenContractClient, PauseControl, AdminControl};

fn setup() -> (Address, Env) {
    let env = Env::default();
    (env.register(PropertyTokenContract, ()), env)
}

#[test]
fn test() {
    let env = Env::default();
    let contract_id = env.register(PropertyTokenContract, ());
    let client = PropertyTokenContractClient::new(&env, &contract_id);

    let words = client.hello(&String::from_str(&env, "Dev"));
    assert_eq!(
        words,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Dev"),
        ]
    );
}

#[test]
fn test_admin_initialization() {

}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_require_admin_fails() {
    let (contract_id, env) = setup();
    // let client = PropertyTokenContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let other = Address::generate(&env);

    // AdminControl::initialize(&env.as_contract(&contract_id, f), &admin);
    env.as_contract(&contract_id, || {
        AdminControl::require_admin(&env, &admin);
        AdminControl::require_admin(&env, &other);
    });
}

#[test]
fn test_admin_transfer() {
    let (contract_id, env) = setup();
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    env.as_contract(&contract_id, || {
        AdminControl::initialize(&env, &admin);
        // Start transfer
        AdminControl::transfer_admin_start(&env, &admin, &new_admin);
        assert_eq!(AdminControl::get_pending_admin(&env), Some(new_admin.clone()));
        
        // Accept transfer
        AdminControl::transfer_admin_accept(&env, &new_admin);
        assert!(AdminControl::is_admin(&env, &new_admin));
        assert!(!AdminControl::is_admin(&env, &admin));
    });


}

#[test]
fn test_pause_unpause() {
    let (contract_id, env) = setup();
    let admin = Address::generate(&env);

    env.as_contract(&contract_id, || {
        AdminControl::initialize(&env, &admin);
        assert!(!PauseControl::is_paused(&env));

        PauseControl::pause(&env, &admin);
        assert!(PauseControl::is_paused(&env));
    
        PauseControl::unpause(&env, &admin);
        assert!(!PauseControl::is_paused(&env));
    });
}
