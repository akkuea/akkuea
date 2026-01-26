# Storage Cost Optimization Guide

## Overview

This document outlines the storage optimization strategies implemented in the property tokenization smart contract to minimize costs on the Soroban blockchain.

## Storage Cost Considerations

### 1. Instance Storage Usage

All storage operations use **instance storage** (`env.storage().instance()`), which provides the optimal balance between cost and persistence for this use case:

- **Lower cost** compared to persistent storage
- **Suitable for mutable data** that's accessed frequently
- **Automatic cleanup** when instance is archived (after sufficient time of inactivity)

### 2. Zero-Balance Optimization

**Implementation**: In [shares.rs](shares.rs), when a share balance reaches zero, the storage entry is automatically removed:

```rust
if balance == 0 {
    env.storage().instance().remove(&key);
} else {
    env.storage().instance().set(&key, &balance);
}
```

**Benefit**: Reduces storage footprint by eliminating unnecessary zero-balance entries.

### 3. Composite Storage Keys

**Implementation**: ShareBalance uses composite keys `(property_id, owner_address)`:

```rust
StorageKey::ShareBalance(u64, Address)
```

**Benefits**:
- Eliminates need for nested data structures
- Direct O(1) access to any balance
- Reduces serialization overhead

### 4. Efficient Data Types

**Integer Selection**:
- `u64` for counters, IDs, and share amounts (sufficient range, lower cost than u128)
- `i128` for valuations (supports large monetary values with sign)
- `u32` for decimals (small values, minimal storage)

**String Usage**:
- Only used where human-readable text is essential (names, descriptions)
- Stored as Soroban `String` type for efficiency

### 5. Single-Instance Global Data

**Implementation**: TokenConfig and Admin stored as singleton entries:

```rust
StorageKey::TokenConfig  // Single instance
StorageKey::Admin        // Single instance
```

**Benefit**: Avoids duplication of global configuration data.

### 6. Optimized Property Counter

**Implementation**: Separate counter for property ID generation:

```rust
StorageKey::PropertyCounter
```

**Benefits**:
- Efficient ID generation without loading full config
- Prevents counter collisions
- Minimal storage footprint

## Storage Size Estimates

### Per Property
- PropertyMetadata: ~200-400 bytes (depending on string lengths)
- TotalShares: ~16 bytes
- **Total per property**: ~216-416 bytes

### Per Share Balance
- ShareBalance entry: ~48 bytes (property_id + Address + u64)

### Global State
- TokenConfig: ~100-150 bytes
- Admin: ~32 bytes
- PropertyCounter: ~16 bytes
- **Total global**: ~148-198 bytes

## Best Practices

### 1. Batch Operations
When possible, batch related storage operations to minimize transaction costs.

### 2. Lazy Initialization
Storage entries are created only when needed:
- Share balances created on first allocation
- Properties created on registration

### 3. Cleanup on Deactivation
Consider implementing cleanup logic for deactivated properties if needed in future versions.

### 4. Monitoring
Track storage usage during development:
```rust
// Use Soroban budget to monitor storage costs
env.budget().print();
```

## Future Optimizations

### Potential Improvements
1. **Archive old properties**: Move inactive properties to persistent storage
2. **Compress metadata**: Use shorter string encodings for common fields
3. **Pagination**: Implement iterators for large property lists
4. **Caching**: Add in-memory caching for frequently accessed data

### Trade-offs
- **Storage cost vs. Access speed**: Current implementation favors fast access
- **Simplicity vs. Optimization**: Maintains readable code over extreme optimization
- **Flexibility vs. Efficiency**: Allows for future extensions while keeping base costs low

## Testing Storage Costs

Use the following approach to test storage costs:

```rust
#[test]
fn test_storage_costs() {
    let env = Env::default();

    // Reset budget
    env.budget().reset_default();

    // Perform storage operations
    // ...

    // Print budget usage
    env.budget().print();
}
```

## References

- [Soroban Storage Documentation](https://soroban.stellar.org/docs/learn/storing-data)
- [Soroban Budget and Resource Limits](https://soroban.stellar.org/docs/learn/resource-limits)
