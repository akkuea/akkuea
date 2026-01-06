use crate::errors::TippingError;
use soroban_sdk::{Address, BytesN, Env, String, Vec};

pub struct Utils;

impl Utils {
    /// Generate a unique ID using current timestamp and ledger sequence
    pub fn generate_id(env: &Env) -> BytesN<32> {
        let timestamp = env.ledger().timestamp();
        let sequence = env.ledger().sequence();

        // Create a simple hash from timestamp and sequence
        let mut hash_input = [0u8; 32];
        let timestamp_bytes = timestamp.to_be_bytes();
        let sequence_bytes = sequence.to_be_bytes();

        // Fill the hash input with timestamp and sequence data
        for i in 0..8 {
            hash_input[i] = timestamp_bytes[i % timestamp_bytes.len()];
            hash_input[i + 8] = sequence_bytes[i % sequence_bytes.len()];
        }

        // Fill remaining bytes with a pattern
        for i in 16..32 {
            hash_input[i] = (i as u8).wrapping_mul(timestamp as u8);
        }

        BytesN::from_array(env, &hash_input)
    }

    /// Validate amount is positive
    pub fn validate_amount(amount: i128) -> Result<(), TippingError> {
        if amount <= 0 {
            Err(TippingError::InvalidAmount)
        } else {
            Ok(())
        }
    }

    /// Validate address is not null
    pub fn validate_address(_address: &Address) -> Result<(), TippingError> {
        // Basic validation
        Ok(())
    }

    /// Validate time period string
    pub fn validate_time_period(period: &String) -> Result<(), TippingError> {
        if period == &String::from_str(&Env::default(), "daily")
            || period == &String::from_str(&Env::default(), "weekly")
            || period == &String::from_str(&Env::default(), "monthly")
        {
            Ok(())
        } else {
            Err(TippingError::InvalidInput)
        }
    }

    /// Sort a vector of (Address, i128) tuples by amount in descending order
    pub fn sort_by_amount(vec: &mut Vec<(Address, i128)>) {
        // Simple bubble sort implementation for small vectors
        let len = vec.len();
        for i in 0..len {
            for j in 0..(len - i - 1) {
                if let (Some(current), Some(next)) = (vec.get(j), vec.get(j + 1)) {
                    if current.1 < next.1 {
                        // Swap elements
                        let temp = current.clone();
                        vec.set(j, next.clone());
                        vec.set(j + 1, temp);
                    }
                }
            }
        }
    }

    /// Calculate percentage change between two values
    pub fn _calculate_percentage_change(current: i128, previous: i128) -> i128 {
        if previous == 0 {
            if current > 0 {
                10000 // 100% represented as 10000 (with 2 decimal places)
            } else {
                0
            }
        } else {
            ((current - previous) * 10000) / previous
        }
    }

    /// Convert string to bytes for storage keys
    pub fn _string_to_key(env: &Env, input: &str) -> BytesN<32> {
        let mut key_bytes = [0u8; 32];
        let input_bytes = input.as_bytes();
        let copy_len = if input_bytes.len() < 32 {
            input_bytes.len()
        } else {
            32
        };

        for i in 0..copy_len {
            key_bytes[i] = input_bytes[i];
        }

        BytesN::from_array(env, &key_bytes)
    }
}
