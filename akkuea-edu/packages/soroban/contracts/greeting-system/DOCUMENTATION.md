# Greeting System Premium Tier Contract - Technical Documentation

## Overview

The Greeting System Premium Tier Contract is a Soroban smart contract that implements a tiered premium subscription system based on user contributions in XLM. It provides a transparent and automated way to manage premium features and benefits for users of a greeting system on the Stellar network.

## Contract Architecture

### Module Structure

```
greeting-system/
├── datatype.rs      # Core data structures and enums
├── error.rs         # Error definitions
├── events.rs        # Event emission logic
├── interface.rs     # Public interface traits
├── lib.rs           # Contract entry point
├── premium.rs       # Premium tier implementation
├── storage.rs       # Storage operations
├── utils.rs         # Utility functions
└── test.rs          # Test suite
```

### Design Principles

1. **Modularity**: Each module has a single responsibility
2. **Type Safety**: Strong typing with enums and structs
3. **Event-Driven**: All state changes emit events
4. **Security-First**: Authorization checks on all sensitive operations
5. **Testability**: Comprehensive test coverage

## Data Model

### TierLevel Enum

Represents the four possible premium tiers:

```rust
pub enum TierLevel {
    None,    // < 100 XLM
    Basic,   // 100-499 XLM
    Pro,     // 500-1999 XLM
    Elite,   // 2000+ XLM
}
```

**Key Methods:**
- `from_contribution(contribution: i128) -> Self`: Determines tier from contribution amount
- `get_features() -> PremiumFeatures`: Returns features for the tier
- `to_str() -> &str`: String representation for events

### PremiumTier Struct

The main data structure stored for each user:

```rust
pub struct PremiumTier {
    pub user: Address,           // Stellar account address
    pub tier: TierLevel,         // Current tier level
    pub contribution: i128,      // Total contribution in Stroops
    pub assigned_at: u64,        // Unix timestamp of assignment
    pub features: PremiumFeatures, // Available features
}
```

### PremiumFeatures Struct

Defines the capabilities available at each tier:

```rust
pub struct PremiumFeatures {
    pub max_greetings_per_day: u32,     // Daily greeting limit
    pub custom_greeting_messages: bool,  // Custom message capability
    pub priority_support: bool,          // Priority support access
    pub analytics_access: bool,          // Analytics dashboard access
    pub api_rate_limit: u32,            // API calls per minute
}
```

## Core Functionality

### Tier Assignment

**Function:** `assign_premium_tier(env: Env, user: Address, contribution: i128)`

**Process Flow:**
1. Verify user authorization via `require_auth()`
2. Validate contribution amount (must be positive)
3. Check if user already has a tier (prevent duplicates)
4. Calculate tier level from contribution amount
5. Create PremiumTier with appropriate features
6. Save to persistent storage
7. Emit TIER_ASSIGNED event

**Storage:**
- Key: `StorageKey::PremiumTier(user_address)`
- Value: `PremiumTier` struct
- Type: Persistent storage

**Events:**
- Symbol: `TIER_ASGN`
- Data: user, tier_level, contribution, timestamp

### Tier Upgrade

**Function:** `upgrade_premium_tier(env: Env, user: Address, additional_contribution: i128)`

**Process Flow:**
1. Verify user authorization
2. Validate additional contribution
3. Load existing tier from storage
4. Calculate new total contribution
5. Determine new tier level
6. Prevent downgrades (enforce upgrade-only policy)
7. Update tier with new values
8. Save updated tier to storage
9. Emit TIER_UPGRADED event

**Downgrade Prevention:**
```rust
if new_tier_level < existing_tier.tier {
    return Err(Error::DowngradeNotAllowed);
}
```

### Status Queries

**Functions:**
- `get_premium_status()`: Full tier information
- `get_tier_level()`: Just the tier level
- `get_user_features()`: Available features
- `get_total_contribution()`: Total contribution amount

All queries simply load and return the stored `PremiumTier` data or specific fields.

## Storage Strategy

### Storage Type: Persistent

The contract uses Soroban's persistent storage for tier data:

```rust
env.storage().persistent().set(&key, &value);
env.storage().persistent().get(&key);
env.storage().persistent().has(&key);
env.storage().persistent().remove(&key);
```

**Rationale:**
- Tier data must survive contract upgrades
- Users expect their tier status to persist indefinitely
- Read-heavy workload (queries are frequent)

### Storage Keys

```rust
pub enum StorageKey {
    PremiumTier(Address),  // One entry per user
}
```

Simple key-value structure where each user address maps to their PremiumTier.

## Event System

### Event Types

1. **TIER_ASSIGNED** (`TIER_ASGN`)
   - Emitted: When a new user receives a tier
   - Data: (user, tier_string, contribution, timestamp)

2. **TIER_UPGRADED** (`TIER_UPG`)
   - Emitted: When a user's tier is upgraded
   - Data: (user, old_tier_string, new_tier_string, contribution, timestamp)

3. **TIER_DOWNGRADED** (`TIER_DWN`)
   - Emitted: Reserved for future use
   - Data: (user, old_tier_string, new_tier_string, timestamp)

### Event Implementation

Events use Soroban's `env.events().publish()` API:

```rust
env.events().publish(
    (TIER_ASSIGNED, symbol_short!("assigned")),
    (user, tier_str, contribution, timestamp)
);
```

## Security Features

### Authorization

Every state-changing operation requires authorization:

```rust
pub fn verify_user_authorization(env: &Env, user: &Address) -> Result<(), Error> {
    user.require_auth();
    // Additional checks could be added here
    Ok(())
}
```

**Future Enhancements:**
- Whitelist verification
- Account age checks
- Trustline requirements
- Account flag validation

### Validation

All inputs are validated:

```rust
pub fn validate_contribution(contribution: i128) -> Result<(), Error> {
    if contribution <= 0 {
        return Err(Error::InvalidContribution);
    }
    Ok(())
}
```

### Upgrade Protection

Downgrades are explicitly prevented to protect user investments:

```rust
if new_tier_level < existing_tier.tier {
    return Err(Error::DowngradeNotAllowed);
}
```

## Error Handling

### Error Types

All errors are defined in the `Error` enum with specific error codes:

```rust
#[contracterror]
pub enum Error {
    InvalidContribution = 1,    // Non-positive amount
    TierNotFound = 2,           // User has no tier
    Unauthorized = 3,           // Auth failed
    DowngradeNotAllowed = 4,    // Attempted downgrade
    StorageError = 5,           // Storage operation failed
    InvalidTierLevel = 6,       // Invalid tier specified
    ZeroContribution = 7,       // Zero amount
    TierAlreadyExists = 8,      // Duplicate assignment
}
```

### Error Propagation

Functions return `Result<T, Error>` for proper error handling:

```rust
pub fn assign_premium_tier(...) -> Result<(), Error> {
    verify_user_authorization(&env, &user)?;
    validate_contribution(contribution)?;
    // ... more operations
    Ok(())
}
```

## Currency Handling

### Stroops Conversion

Stellar uses Stroops as the base unit (1 XLM = 10,000,000 Stroops):

```rust
pub fn xlm_to_stroops(xlm: i128) -> i128 {
    xlm * 10_000_000
}

pub fn stroops_to_xlm(stroops: i128) -> i128 {
    stroops / 10_000_000
}
```

### Tier Thresholds (in Stroops)

```rust
const ONE_XLM: i128 = 10_000_000;

// Tier determination
if contribution >= 2000 * ONE_XLM {
    TierLevel::Elite
} else if contribution >= 500 * ONE_XLM {
    TierLevel::Pro
} else if contribution >= 100 * ONE_XLM {
    TierLevel::Basic
} else {
    TierLevel::None
}
```

## Testing Strategy

### Test Categories

1. **Tier Assignment Tests**
   - Basic tier assignment
   - Pro tier assignment
   - Elite tier assignment
   - Edge case handling

2. **Validation Tests**
   - Zero contribution rejection
   - Negative contribution rejection
   - Duplicate assignment prevention

3. **Upgrade Tests**
   - Basic to Pro upgrade
   - Pro to Elite upgrade
   - Same-tier contribution addition
   - Downgrade prevention

4. **Query Tests**
   - Status retrieval
   - Feature access
   - Tier level lookup
   - Contribution tracking

5. **Unit Tests**
   - Tier level from contribution
   - Feature generation
   - Currency conversion

### Test Utilities

```rust
fn create_test_env() -> (Env, GreetingSystemClient, Address) {
    let env = Env::default();
    let contract_id = env.register_contract(None, GreetingSystem);
    let client = GreetingSystemClient::new(&env, &contract_id);
    let user = Address::generate(&env);
    (env, client, user)
}
```

### Mock Authorization

```rust
env.mock_all_auths(); // Bypasses auth checks in tests
```

## Performance Considerations

### Gas Optimization

1. **Storage Efficiency**: Single storage entry per user
2. **Feature Calculation**: Computed on-demand, not stored separately
3. **Event Publishing**: Lightweight data structures
4. **Validation**: Early return on validation failures

### Read vs Write Operations

- **Reads**: Constant time O(1) - Direct storage lookup
- **Writes**: Constant time O(1) - Single storage update
- **Events**: Minimal overhead - Asynchronous emission

## Integration Patterns

### With Payment Contracts

```rust
// Payment contract calls after receiving XLM
greeting_system.assign_premium_tier(&user, &amount)?;
```

### With Subscription Management

```rust
// Check feature access
let features = greeting_system.get_user_features(&user)?;
if !features.priority_support {
    return Err(Error::FeatureNotAvailable);
}
```

### With Analytics Systems

```rust
// Track tier distribution
let tier_level = greeting_system.get_tier_level(&user)?;
analytics.track_tier_distribution(tier_level);
```

## Upgrade Path

### Future Enhancements

1. **Time-Based Tiers**: Add expiration dates
2. **Referral Bonuses**: Tier boosts for referrals
3. **Family Plans**: Shared tier benefits
4. **Tier Decay**: Gradual tier reduction for inactivity
5. **Custom Tiers**: Allow custom tier creation
6. **Tier Transfers**: Move tier to another account (with restrictions)

### Contract Upgradeability

The contract can be upgraded using Soroban's upgrade mechanism. Tier data will persist through upgrades due to persistent storage.

## Best Practices

### For Developers

1. Always call `assign_premium_tier` for new users
2. Use `upgrade_premium_tier` for additional contributions
3. Query features before granting access
4. Monitor events for tier changes
5. Handle all error cases explicitly

### For Integrators

1. Convert XLM to Stroops before calling contract functions
2. Implement event listeners for real-time updates
3. Cache tier data but revalidate periodically
4. Handle `TierNotFound` errors gracefully
5. Test with testnet before mainnet deployment

### For Auditors

1. Review authorization checks in all public functions
2. Verify no arithmetic overflow/underflow
3. Check storage key collision prevention
4. Validate event data completeness
5. Test edge cases and boundary conditions

## Limitations

1. **No Downgrades**: Once a tier is achieved, it cannot be reduced
2. **No Refunds**: Contributions are final
3. **No Transfers**: Tiers are bound to the original address
4. **No Expiration**: Tiers do not expire (could be a feature)
5. **Single Currency**: Only XLM contributions supported

## Conclusion

This contract provides a robust, secure, and scalable foundation for premium tier management in the greeting system. Its modular design allows for easy extension while maintaining security and performance.

For questions or contributions, please refer to the main README.md or contact the development team.
