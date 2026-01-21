#![cfg(test)]

use soroban_sdk::{vec, Env, String};

use super::{PropertyTokenContract, PropertyTokenContractClient};

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
