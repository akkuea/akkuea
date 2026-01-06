
use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, Map, Symbol, U256};

// Define the contract structure
#[contract]
#[allow(dead_code)]
pub struct YourContract;

// Helper functions to generate storage keys
// These keys are used to store and retrieve data in the contract's persistent storage
#[allow(dead_code)]
fn get_greeting_key(env: &Env) -> Symbol {
    // Create a new `Symbol` for the greeting key
    Symbol::new(env, "greeting")
}

#[allow(dead_code)]
fn get_premium_key(env: &Env) -> Symbol {
    // Create a new `Symbol` for the premium status key
    Symbol::new(env, "premium")
}

#[allow(dead_code)]
fn get_total_counter_key(env: &Env) -> Symbol {
    // Create a new `Symbol` for the total counter key
    Symbol::new(env, "total_counter")
}

#[allow(dead_code)]
fn get_user_greeting_counter_key(env: &Env) -> Symbol {
    // Create a new `Symbol` for the user-specific greeting counter key
    Symbol::new(env, "user_greeting_counter")
}

#[allow(dead_code)]
fn get_owner_key(env: &Env) -> Symbol {
    // Create a new `Symbol` for the owner key
    Symbol::new(env, "owner")
}

// Implementation of the contract logic
#[contractimpl]
#[allow(dead_code)]
impl YourContract {
    // Initialize the contract
    // This function sets up the initial state of the contract
    pub fn initialize(env: Env, owner: Address) {
        let greeting_key = get_greeting_key(&env); // Key for the greeting message
        let _premium_key = get_premium_key(&env); // Key for the premium status (unused here)
        let total_counter_key = get_total_counter_key(&env); // Key for the total greeting counter
        let user_greeting_counter_key = get_user_greeting_counter_key(&env); // Key for user-specific counters
        let owner_key = get_owner_key(&env); // Key for the contract owner

        // Store the owner address in persistent storage
        env.storage().instance().set(&owner_key, &owner);

        // Set the initial greeting message
        env.storage().instance().set(
            &greeting_key,
            &Bytes::from_slice(&env, b"Building Unstoppable Apps!!!"),
        );

        // Initialize the total greeting counter to 0
        env.storage()
            .instance()
            .set(&total_counter_key, &U256::from_u32(&env, 0));

        // Initialize an empty map for tracking user-specific greeting counts
        env.storage()
            .instance()
            .set(&user_greeting_counter_key, &Map::<Address, U256>::new(&env));
    }

    // Get the current greeting message
    pub fn greeting(env: Env) -> Bytes {
        let greeting_key = get_greeting_key(&env); // Retrieve the greeting key

        // Fetch the greeting message from storage or panic if not initialized
        env.storage()
            .instance()
            .get(&greeting_key)
            .unwrap_or_else(|| panic!("Greeting not initialized"))
    }

    // Set a new greeting message and optionally mark the caller as premium
    pub fn set_greeting(env: Env, new_greeting: Bytes, amount_xlm: U256) {
        let caller = env.current_contract_address(); // Get the address of the caller
        let greeting_key = get_greeting_key(&env); // Key for the greeting message
        let total_counter_key = get_total_counter_key(&env); // Key for the total greeting counter
        let user_greeting_counter_key = get_user_greeting_counter_key(&env); // Key for user-specific counters
        let premium_key = get_premium_key(&env); // Key for the premium status

        // Retrieve the current total greeting counter or initialize it to 0
        let mut total_counter: U256 = env
            .storage()
            .instance()
            .get(&total_counter_key)
            .unwrap_or(U256::from_u32(&env, 0));

        // Retrieve the user-specific greeting counter map or initialize it as empty
        let mut user_greeting_counter: Map<Address, U256> = env
            .storage()
            .instance()
            .get(&user_greeting_counter_key)
            .unwrap_or(Map::new(&env));

        // Update the greeting message in storage
        env.storage().instance().set(&greeting_key, &new_greeting);

        // Increment the total greeting counter
        total_counter = total_counter.add(&U256::from_u32(&env, 1));

        // Retrieve the caller's current greeting count or initialize it to 0
        let user_count = user_greeting_counter
            .get(caller.clone())
            .unwrap_or(U256::from_u32(&env, 0));

        // Increment the caller's greeting count
        user_greeting_counter.set(caller.clone(), user_count.add(&U256::from_u32(&env, 1)));

        // Save the updated counters back to storage
        env.storage()
            .instance()
            .set(&total_counter_key, &total_counter);
        env.storage()
            .instance()
            .set(&user_greeting_counter_key, &user_greeting_counter);

        // Check if the caller sent any XLM and update their premium status accordingly
        if amount_xlm > U256::from_u32(&env, 0) {
            env.storage().instance().set(&premium_key, &true);
        } else {
            env.storage().instance().set(&premium_key, &false);
        }

        // Publish an event indicating that the greeting was changed
        env.events().publish(
            ("GreetingChanged",),
            (
                caller.clone(),
                new_greeting,
                env.storage().instance().get(&premium_key).unwrap_or(false),
                amount_xlm,
            ),
        );
    }

    // Simulate a withdrawal (only callable by the owner)
    pub fn withdraw(env: Env) {
        let owner_key = get_owner_key(&env); // Key for the owner address

        // Retrieve the owner address from storage or panic if not initialized
        let owner: Address = env
            .storage()
            .instance()
            .get(&owner_key)
            .unwrap_or_else(|| panic!("Owner not initialized"));

        // Ensure that the caller is authorized as the owner
        owner.require_auth();

        // Log a simulated withdrawal event
        env.logs().add("Withdrawal simulated", &[]);
    }

    // Check if the caller is marked as premium
    pub fn premium(env: Env) -> bool {
        let premium_key = get_premium_key(&env); // Key for the premium status

        // Retrieve the premium status from storage or return false if not set
        env.storage().instance().get(&premium_key).unwrap_or(false)
    }
}
