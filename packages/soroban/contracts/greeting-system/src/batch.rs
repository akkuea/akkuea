use soroban_sdk::{Env, Vec, Address, String};
use alloc::string::ToString;
use crate::Error;
use crate::utils;
use crate::storage;
use crate::datatype::{BatchUpdate, Greeting, OperationStatus};
use crate::events::{emit_batch_update, BatchUpdateEvent};

/// Maximum batch size to prevent gas exhaustion (tune based on testing).
const MAX_BATCH_SIZE: u32 = 100;

/// Perform a batch update on multiple greetings.
/// Restricted to authorized users (e.g., creators or admins).
/// Emits events and stores audit record.
pub fn batch_update_greetings(
    env: &Env,
    user: Address,
    greeting_ids: Vec<u64>,
    updates: Vec<String>,
) -> Result<u64, Error> {
    // Authorization: Reuse your utils for admin/creator check.
    utils::verify_user_authorization(env, &user)?;

    // Validate inputs.
    validate_batch_inputs(&greeting_ids, &updates)?;

    let batch_id = storage::next_batch_id(env);
    let num_greetings = greeting_ids.len() as u32;

    // Create pending batch record.
    let mut batch = BatchUpdate {
        batch_id,
        greeting_ids: greeting_ids.clone(),
        updates: updates.clone(),
        status: OperationStatus::Pending,
        processed_by: user.clone(),
        processed_at: utils::get_current_timestamp(env),
    };
    storage::write_batch(env, &batch)?;

    // Emit pending event.
    emit_batch_update(env, &BatchUpdateEvent {
        batch_id,
        num_greetings,
        status: OperationStatus::Pending,
        processed_by: user.clone(),
    })?;

    // Process updates.
    let mut success_count = 0u32;
    let len = greeting_ids.len();
    for i in 0..len {
        let gid = greeting_ids.get(i).unwrap();  
        let update = updates.get(i).unwrap().clone();  // Clone String

        if let Err(e) = process_single_update(env, &user, gid, update) {
            // On first failure, mark batch failed and emit.
            batch.status = OperationStatus::Failed(
                String::from_str(env, &e.to_string())
            );
            batch.processed_at = utils::get_current_timestamp(env); // Update timestamp.
            storage::write_batch(env, &batch)?;
            emit_batch_update(env, &BatchUpdateEvent {
                batch_id,
                num_greetings,
                status: batch.status.clone(),
                processed_by: user.clone(),
            })?;
            return Err(e); // Fail the tx.
        }
        success_count += 1;
    }

    // All good: mark completed.
    batch.status = OperationStatus::Completed;
    batch.processed_at = utils::get_current_timestamp(env);
    storage::write_batch(env, &batch)?;

    emit_batch_update(env, &BatchUpdateEvent {
        batch_id,
        num_greetings,
        status: OperationStatus::Completed,
        processed_by: user,
    })?;

    Ok(batch_id)
}

/// Get the status of a batch update (for auditing).
pub fn get_batch_status(env: &Env, batch_id: u64) -> Result<BatchUpdate, Error> {
    storage::read_batch(env, batch_id)
}

/// Create a new greeting (helper function—added to fix "not found")
pub fn create_greeting(
    env: &Env,
    greeting_id: u64,
    text: String,
    creator: Address,
) -> Result<(), Error> {
    // Quick check if exists (to avoid overwrite)
    if storage::read_greeting(env, greeting_id).is_ok() {
        return Err(Error::TierAlreadyExists); // Proxy error; add GreetingExists if you wan
    }

    let timestamp = utils::get_current_timestamp(env);
    let greeting = Greeting {
        id: greeting_id,
        text,
        creator,
        updated_at: timestamp,
    };

    storage::write_greeting(env, &greeting)
}

/// Internal: Validate batch inputs for safety.
fn validate_batch_inputs(greeting_ids: &Vec<u64>, updates: &Vec<String>) -> Result<(), Error> {
    if greeting_ids.len() > MAX_BATCH_SIZE {
        return Err(Error::BatchTooLarge);
    }
    if greeting_ids.len() != updates.len() {
        return Err(Error::InvalidUpdateLength);
    }

    // Manual duplicate check (since we can't use BTreeSet).
    let len = greeting_ids.len();
    for i in 0..len {
        let gid_i = greeting_ids.get(i).unwrap();  // Fix: * for u64
        for j in (i + 1)..len {
            let gid_j = greeting_ids.get(j).unwrap();  // Fix: *
            if gid_i == gid_j {
                return Err(Error::DuplicateGreetingIds);
            }
        }
    }

    // Check for empty updates
    for i in 0..updates.len() {
        if updates.get(i).unwrap().is_empty() {
            return Err(Error::EmptyUpdate);
        }
    }

    Ok(())
}

/// Internal: Update a single greeting (assumes it exists and user is authorized).
fn process_single_update(
    env: &Env,
    user: &Address,
    id: u64,
    new_text: String,
) -> Result<(), Error> {
    let mut greeting = storage::read_greeting(env, id).map_err(|_| Error::UnauthorizedGreeting)?;
    
    // Auth check: User must be creator (extend for admin).
    if greeting.creator != *user {
        return Err(Error::UnauthorizedGreeting);
    }

    // Apply update.
    greeting.text = new_text;
    greeting.updated_at = utils::get_current_timestamp(env);
    storage::write_greeting(env, &greeting)
        .map_err(|_| Error::StorageError)
}