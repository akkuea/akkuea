# Storage Module Documentation

## Overview

The storage module provides the foundational data structures and utilities for managing property tokenization on the Soroban blockchain. It implements efficient, collision-free storage patterns optimized for cost and performance.

## Module Structure

```
storage/
├── mod.rs                     # Module exports
├── keys.rs                    # Storage key definitions
├── property.rs                # Property metadata structures
├── shares.rs                  # Share ownership tracking
├── config.rs                  # Token configuration
├── README.md                  # This file
└── STORAGE_OPTIMIZATION.md    # Cost optimization guide
```

## Core Components

### 1. Storage Keys ([keys.rs](keys.rs))

Defines unique storage keys to prevent collisions and organize contract data:

- **TokenConfig**: Global token configuration
- **Property(id)**: Property metadata indexed by ID
- **ShareBalance(property_id, owner)**: Share ownership per property and owner
- **TotalShares(property_id)**: Total shares issued for a property
- **Admin**: Admin address with special permissions
- **PropertyCounter**: Counter for generating unique property IDs

**Key Features**:
- Strongly typed keys prevent storage collisions
- Efficient serialization with `#[contracttype]`
- Debug-friendly symbol names

### 2. Property Metadata ([property.rs](property.rs))

Manages property information stored on-chain:

```rust
pub struct PropertyMetadata {
    pub property_id: u64,
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub location: String,
    pub valuation: i128,
    pub total_shares: u64,
    pub created_at: u64,
    pub is_active: bool,
}
```

**Key Methods**:
- `new()`: Creates a new property metadata instance
- `save()`: Stores metadata in contract storage
- `load()`: Retrieves metadata from storage
- `set_active()`: Updates property active status
- `remove()`: Removes property from storage

### 3. Share Management ([shares.rs](shares.rs))

Tracks property share ownership with optimized storage patterns:

**Core Functions**:
- `get_balance(property_id, owner)`: Get share balance
- `set_balance(property_id, owner, balance)`: Set share balance
- `increase_balance()`: Add shares to balance
- `decrease_balance()`: Remove shares from balance
- `transfer_shares()`: Transfer shares between owners
- `get_total_shares()`: Get total shares for property
- `set_total_shares()`: Set total shares for property

**Optimizations**:
- Zero balances are automatically removed from storage
- Composite keys enable O(1) access
- Safe arithmetic with overflow/underflow checks

### 4. Configuration Management ([config.rs](config.rs))

Manages global token configuration and admin settings:

```rust
pub struct TokenConfig {
    pub symbol: String,
    pub name: String,
    pub decimals: u32,
    pub admin: Address,
    pub initialized: bool,
}
```

**Key Methods**:
- `new()`: Creates new token configuration
- `save()`: Stores configuration
- `load()`: Retrieves configuration
- `is_initialized()`: Checks initialization status
- `update_admin()`: Updates admin address

**Helper Functions**:
- `get_admin()`: Quick admin lookup
- `set_admin()`: Update admin address
- `get_property_counter()`: Get current property counter
- `increment_property_counter()`: Generate next property ID

## Usage Examples

### Registering a Property

```rust
use crate::storage::{property::PropertyMetadata, config::increment_property_counter};

let property_id = increment_property_counter(&env);
let metadata = PropertyMetadata::new(
    property_id,
    owner_address,
    String::from_str(&env, "Beach House"),
    String::from_str(&env, "Beautiful beachfront property"),
    String::from_str(&env, "Miami, FL"),
    1_000_000_0000000, // $1M with 7 decimals
    100_000,           // 100k shares
    env.ledger().timestamp(),
);
metadata.save(&env);
```

### Managing Share Balances

```rust
use crate::storage::shares;

// Allocate initial shares to owner
shares::set_total_shares(&env, property_id, 100_000);
shares::set_balance(&env, property_id, &owner, 100_000);

// Transfer shares to investor
shares::transfer_shares(&env, property_id, &owner, &investor, 10_000);

// Check balance
let balance = shares::get_balance(&env, property_id, &investor);
// balance = 10_000
```

### Initializing Contract

```rust
use crate::storage::config::TokenConfig;

let config = TokenConfig::new(
    String::from_str(&env, "PRPT"),
    String::from_str(&env, "Property Token"),
    7,
    admin_address,
);
config.save(&env);
```

## Storage Patterns

### Instance Storage

All storage operations use `env.storage().instance()` for optimal cost and performance:

```rust
env.storage().instance().set(&key, &value);
let value = env.storage().instance().get(&key);
env.storage().instance().remove(&key);
```

### Composite Keys

Share balances use composite keys for efficient lookup:

```rust
StorageKey::ShareBalance(property_id, owner_address)
```

This enables:
- Direct access without nested structures
- O(1) lookup complexity
- Reduced serialization overhead

### Optional Returns

Storage reads return `Option<T>` with fallback patterns:

```rust
env.storage().instance().get(&key).unwrap_or(0)
```

## Safety Guarantees

### Arithmetic Safety

All arithmetic operations use checked methods:

```rust
current.checked_add(amount).expect("Share balance overflow");
current.checked_sub(amount).expect("Insufficient share balance");
```

### Type Safety

Strong typing prevents storage key collisions:

```rust
StorageKey::Property(u64)          // Cannot collide with
StorageKey::ShareBalance(u64, Address)  // different variants
```

## Testing

### Unit Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_property_storage() {
        let env = Env::default();
        // Test implementation
    }
}
```

### Storage Cost Testing

```rust
#[test]
fn test_storage_costs() {
    let env = Env::default();
    env.budget().reset_default();

    // Perform operations

    env.budget().print();
}
```

## Best Practices

### 1. Always Check Initialization

```rust
if !TokenConfig::is_initialized(&env) {
    panic!("Contract not initialized");
}
```

### 2. Validate Property Existence

```rust
let metadata = PropertyMetadata::load(&env, property_id)
    .expect("Property not found");
```

### 3. Use Helper Functions

Prefer helper functions over direct storage access:

```rust
// Good
shares::increase_balance(&env, property_id, &owner, amount);

// Avoid
let balance = env.storage().instance().get(&key).unwrap_or(0);
env.storage().instance().set(&key, &(balance + amount));
```

### 4. Document Panics

All functions that can panic document their panic conditions:

```rust
/// # Panics
/// Panics if the addition would overflow u64
```

## Performance Considerations

### Read Operations

- Single key lookup: O(1)
- Property metadata: ~1 storage read
- Share balance: ~1 storage read

### Write Operations

- Property registration: ~2 storage writes (metadata + counter)
- Share transfer: ~2 storage writes (decrease + increase)
- Zero balance: ~1 storage removal (cost savings)

## Security Considerations

### No Direct Public Access

Storage functions are internal to the contract. Public access should go through contract interface functions that include proper authorization checks.

### Overflow Protection

All arithmetic operations include overflow/underflow protection to prevent balance manipulation attacks.

### Key Collision Prevention

Strongly typed `StorageKey` enum prevents accidental key collisions that could lead to data corruption.

## Future Enhancements

### Planned Features

1. **Property search/indexing**: Enable efficient property queries
2. **Historical tracking**: Store property value changes over time
3. **Event emission**: Add events for storage modifications
4. **Batch operations**: Support bulk property registration

### Potential Optimizations

1. **Lazy loading**: Defer loading of large property descriptions
2. **Compression**: Compress metadata for frequently used patterns
3. **Caching**: Implement read caching for hot data

## References

- [Soroban Storage Documentation](https://soroban.stellar.org/docs/learn/storing-data)
- [Storage Optimization Guide](STORAGE_OPTIMIZATION.md)
- [Soroban SDK Documentation](https://docs.rs/soroban-sdk)

## Support

For questions or issues related to the storage module:
1. Check the [Storage Optimization Guide](STORAGE_OPTIMIZATION.md)
2. Review test cases for usage examples
3. Open an issue in the repository
