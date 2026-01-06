# Greeting System - Premium Tier Contract

A Soroban smart contract implementing tiered premium levels based on contribution amounts for a greeting system on the Stellar network.

## 🎯 Overview

This contract enables users to access premium features based on their XLM contributions. It implements a three-tier system (Basic, Pro, Elite) with progressively enhanced features and capabilities.

## 🏗 Architecture

```
greeting-system/
├── src/
│   ├── lib.rs          # Contract configuration and exports
│   ├── datatype.rs     # Data structures and tier definitions
│   ├── error.rs        # Error types
│   ├── events.rs       # Event emission functions
│   ├── interface.rs    # Contract interface traits
│   ├── premium.rs      # Premium tier logic implementation
│   ├── storage.rs      # Storage operations
│   ├── utils.rs        # Utility functions for validation
│   └── test.rs         # Comprehensive test suite
├── Cargo.toml          # Dependencies and build configuration
└── README.md           # This file
```

## 📊 Premium Tiers

### Tier Levels

| Tier    | Contribution (XLM) | Max Greetings/Day | Custom Messages | Priority Support | Analytics | API Rate Limit |
|---------|-------------------|-------------------|-----------------|------------------|-----------|----------------|
| **None**   | < 100          | 10                | ❌              | ❌               | ❌        | 10/min         |
| **Basic**  | 100 - 499      | 50                | ✅              | ❌               | ❌        | 30/min         |
| **Pro**    | 500 - 1,999    | 200               | ✅              | ✅               | ✅        | 100/min        |
| **Elite**  | 2,000+         | 1,000             | ✅              | ✅               | ✅        | 500/min        |

### Tier Features

Each tier provides access to specific features:

- **Max Greetings Per Day**: Number of greetings a user can send daily
- **Custom Greeting Messages**: Ability to create personalized greeting templates
- **Priority Support**: Access to priority customer support
- **Analytics Access**: Advanced analytics and insights dashboard
- **API Rate Limit**: Maximum API calls per minute

## 🔑 Core Functions

### `assign_premium_tier`

Assigns a premium tier to a new user based on their initial contribution.

```rust
pub fn assign_premium_tier(
    env: Env,
    user: Address,
    contribution: i128,
) -> Result<(), Error>
```

**Parameters:**
- `env`: Soroban environment
- `user`: Stellar address of the user
- `contribution`: Contribution amount in Stroops (1 XLM = 10,000,000 Stroops)

**Returns:** `Ok(())` on success, `Error` on failure

**Errors:**
- `InvalidContribution`: Zero or negative contribution
- `Unauthorized`: User not authorized
- `TierAlreadyExists`: User already has a tier assigned

### `upgrade_premium_tier`

Upgrades an existing user's tier with additional contributions.

```rust
pub fn upgrade_premium_tier(
    env: Env,
    user: Address,
    additional_contribution: i128,
) -> Result<(), Error>
```

**Parameters:**
- `env`: Soroban environment
- `user`: Stellar address of the user
- `additional_contribution`: Additional contribution in Stroops

**Returns:** `Ok(())` on success, `Error` on failure

**Errors:**
- `InvalidContribution`: Zero or negative contribution
- `Unauthorized`: User not authorized
- `TierNotFound`: User doesn't have an existing tier
- `DowngradeNotAllowed`: New total results in lower tier

### `get_premium_status`

Retrieves the complete premium tier information for a user.

```rust
pub fn get_premium_status(env: Env, user: Address) -> Result<PremiumTier, Error>
```

**Returns:** `PremiumTier` struct containing all tier information

### `get_user_features`

Gets the features available to a user based on their tier.

```rust
pub fn get_user_features(env: Env, user: Address) -> Result<PremiumFeatures, Error>
```

**Returns:** `PremiumFeatures` struct with feature access information

### `get_tier_level`

Gets the tier level of a user.

```rust
pub fn get_tier_level(env: Env, user: Address) -> Result<TierLevel, Error>
```

**Returns:** `TierLevel` enum (None, Basic, Pro, or Elite)

### `get_total_contribution`

Gets the total contribution amount for a user.

```rust
pub fn get_total_contribution(env: Env, user: Address) -> Result<i128, Error>
```

**Returns:** Total contribution in Stroops

## 📦 Data Structures

### `PremiumTier`

```rust
pub struct PremiumTier {
    pub user: Address,           // Stellar address
    pub tier: TierLevel,         // Tier level
    pub contribution: i128,      // Total contribution in Stroops
    pub assigned_at: u64,        // Assignment timestamp
    pub features: PremiumFeatures, // Available features
}
```

### `TierLevel`

```rust
pub enum TierLevel {
    None,    // No premium tier
    Basic,   // 100-499 XLM
    Pro,     // 500-1999 XLM
    Elite,   // 2000+ XLM
}
```

### `PremiumFeatures`

```rust
pub struct PremiumFeatures {
    pub max_greetings_per_day: u32,
    pub custom_greeting_messages: bool,
    pub priority_support: bool,
    pub analytics_access: bool,
    pub api_rate_limit: u32,
}
```

## 🔔 Events

The contract emits the following events:

### `TIER_ASSIGNED`

Emitted when a new tier is assigned to a user.

**Data:**
- User address
- Tier level
- Contribution amount
- Timestamp

### `TIER_UPGRADED`

Emitted when a user's tier is upgraded.

**Data:**
- User address
- Old tier level
- New tier level
- Total contribution
- Timestamp

### `TIER_DOWNGRADED`

Emitted when a tier downgrade occurs (if enabled in future).

**Data:**
- User address
- Old tier level
- New tier level
- Timestamp

## 🚀 Building and Testing

### Prerequisites

- Rust toolchain (1.70+)
- Soroban CLI
- Stellar SDK

### Build

```bash
# From the contract directory
cargo build --target wasm32-unknown-unknown --release
```

### Test

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_assign_basic_tier
```

### Deploy

```bash
# Build optimized WASM
soroban contract build

# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/greeting_system.wasm \
  --network testnet
```

## 💡 Usage Examples

### Assign Initial Tier

```rust
// User contributes 500 XLM (Pro tier)
let contribution = 500 * 10_000_000; // Convert to Stroops
contract.assign_premium_tier(&user_address, &contribution);
```

### Upgrade Tier

```rust
// User adds 1500 XLM to upgrade from Pro to Elite
let additional = 1500 * 10_000_000;
contract.upgrade_premium_tier(&user_address, &additional);
```

### Check User Status

```rust
// Get complete tier information
let tier = contract.get_premium_status(&user_address)?;
println!("Tier: {:?}", tier.tier);
println!("Features: {:?}", tier.features);

// Just get the tier level
let level = contract.get_tier_level(&user_address)?;
```

## 🔒 Security Features

1. **Authorization**: All tier assignments require user authentication via `require_auth()`
2. **Validation**: Contributions are validated to prevent zero or negative amounts
3. **No Downgrades**: The contract prevents tier downgrades to protect user investments
4. **Persistent Storage**: Tier data is stored persistently on the blockchain
5. **Event Logging**: All tier changes are logged as events for transparency

## 🧪 Test Coverage

The contract includes comprehensive tests for:

- ✅ Basic, Pro, and Elite tier assignments
- ✅ Zero and negative contribution validation
- ✅ Duplicate tier assignment prevention
- ✅ Tier upgrades across all levels
- ✅ Downgrade prevention
- ✅ Feature access verification
- ✅ Contribution tracking
- ✅ Error handling for all edge cases

## 📝 Error Handling

| Error                  | Code | Description                                    |
|-----------------------|------|------------------------------------------------|
| `InvalidContribution` | 1    | Contribution must be positive                  |
| `TierNotFound`        | 2    | User doesn't have a tier assigned              |
| `Unauthorized`        | 3    | User not authorized for this operation         |
| `DowngradeNotAllowed` | 4    | Cannot downgrade tier level                    |
| `StorageError`        | 5    | Error accessing contract storage               |
| `InvalidTierLevel`    | 6    | Invalid tier level specified                   |
| `ZeroContribution`    | 7    | Zero contribution not allowed                  |
| `TierAlreadyExists`   | 8    | User already has a tier (use upgrade instead)  |

## 🔗 Integration

### With Subscription Contracts

This contract is designed to work alongside subscription management contracts:

```rust
// Check if user has required tier for a feature
let features = greeting_contract.get_user_features(&user)?;
if features.priority_support {
    // Grant access to priority support
}
```

### With Payment Contracts

```rust
// After receiving payment, assign tier
payment_contract.on_payment_received(|user, amount| {
    greeting_contract.assign_premium_tier(&user, &amount)?;
});
```

## 📚 References

- [Stellar Soroban Documentation](https://soroban.stellar.org/docs)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Soroban SDK](https://docs.rs/soroban-sdk/)
- [Stellar Developer Docs](https://developers.stellar.org/)

## 📄 License

This contract is part of the Akkuea educational platform and follows the project's MIT license.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## ⏳ Development Timeline

- ✅ Contract structure implementation
- ✅ Core tier assignment logic
- ✅ Upgrade functionality
- ✅ Comprehensive test suite
- ✅ Event emission system
- ✅ Documentation

**Status:** Production-ready (v0.1.0)

## 🐛 Known Issues

None at this time.

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Join the Akkuea developer community
- Check the documentation

---

**Built with ❤️ for the Akkuea educational ecosystem on Stellar**
