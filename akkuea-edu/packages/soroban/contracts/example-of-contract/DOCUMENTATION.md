# Example Contract Documentation

## Overview

The Example Contract is a demonstration Soroban smart contract that showcases fundamental smart contract concepts and best practices within the Akkuea ecosystem. This contract serves as a reference implementation for developers building on the Soroban platform, illustrating key patterns such as state management, authentication, event emission, and counter tracking.

The contract implements a simple greeting system with premium user features, demonstrating how to store and retrieve data, manage user interactions, implement ownership controls, and track usage statistics. It provides a foundation for understanding Soroban contract development while adhering to security best practices.

## General Features

- **Contract Initialization**: Secure setup with owner assignment
- **Greeting Management**: Store and retrieve greeting messages
- **Premium User System**: Track premium status based on token contributions
- **Usage Statistics**: Track interaction counts globally and per user
- **Ownership Controls**: Restrict sensitive operations to the contract owner
- **Event Emission**: Notify off-chain systems of state changes

## Functionalities

1. **Contract Initialization**
   - **Owner Assignment**: Set the contract owner during initialization
   - **Initial State Setup**: Configure default greeting and counters
   - **Storage Initialization**: Set up persistent storage structures

2. **Greeting Management**
   - **Greeting Retrieval**: Get the current greeting message
   - **Greeting Updates**: Set a new greeting message
   - **Usage Tracking**: Count greeting updates globally and per user

3. **Premium User System**
   - **Premium Status Assignment**: Mark users as premium based on contributions
   - **Status Verification**: Check if a user has premium status
   - **Premium Benefits**: Demonstrate conditional logic based on status

4. **Ownership Controls**
   - **Owner Authentication**: Verify caller is the contract owner
   - **Restricted Operations**: Limit sensitive functions to the owner
   - **Simulated Withdrawals**: Demonstrate owner-only financial operations

## Contract Structure

```
example-of-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point
│   ├── your_contract.rs        # Core contract implementation
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
└── Makefile                    # Build automation
```

## Events

The contract emits the following events:

1. `GreetingChanged` - When a user updates the greeting message
   - Data: caller_address, new_greeting, premium_status, amount_contributed

## Data Structures

### Storage Keys

The contract uses the following storage keys:

- `greeting`: Stores the current greeting message
- `premium`: Tracks premium status
- `total_counter`: Counts total greeting updates
- `user_greeting_counter`: Maps user addresses to their update counts
- `owner`: Stores the contract owner's address

## Functions

### Initialization

#### `initialize(env: Env, owner: Address)`

- Initializes the contract with the specified owner
- Parameters:
  - `owner`: The address to be set as the contract owner
- Sets up initial storage values:
  - Default greeting message
  - Zero counters
  - Empty user tracking map
- No return value
- No authentication required (should only be called once)

### Greeting Management

#### `greeting(env: Env) -> Bytes`

- Retrieves the current greeting message
- Parameters: None
- Returns the current greeting as a byte array
- No authentication required
- Panics if the greeting is not initialized

#### `set_greeting(env: Env, new_greeting: Bytes, amount_xlm: U256)`

- Updates the greeting message and potentially marks the caller as premium
- Parameters:
  - `new_greeting`: The new greeting message as a byte array
  - `amount_xlm`: The amount of XLM contributed (for premium status)
- Updates the greeting in storage
- Increments the total greeting counter
- Increments the caller's personal greeting counter
- Sets premium status if amount_xlm > 0
- Emits a `GreetingChanged` event
- No return value
- No authentication required

### Premium Status

#### `premium(env: Env) -> bool`

- Checks if the caller has premium status
- Parameters: None
- Returns true if the caller is marked as premium, false otherwise
- No authentication required

### Owner Operations

#### `withdraw(env: Env)`

- Simulates a withdrawal operation (owner-only)
- Parameters: None
- Requires authentication from the contract owner
- Logs a "Withdrawal simulated" message
- No return value
- Panics if the owner is not initialized

## Technical Details and Implementation Notes

1. **Storage Management**
   - Uses Soroban's persistent storage for maintaining state
   - Implements helper functions for generating consistent storage keys
   - Properly handles initialization and retrieval of stored values

2. **Authentication**
   - Implements owner authentication for sensitive operations
   - Uses `require_auth()` to verify transaction signatures
   - Restricts withdrawal functionality to the contract owner

3. **Counter Implementation**
   - Tracks global usage statistics with a total counter
   - Maintains per-user statistics with an address-to-count map
   - Properly increments counters during greeting updates

4. **Event System**
   - Emits structured events for off-chain tracking
   - Includes relevant data in event payloads
   - Uses standardized event topics

5. **Error Handling**
   - Implements panic conditions for uninitialized state
   - Uses unwrap_or and unwrap_or_else for graceful fallbacks
   - Provides clear error messages for debugging

## Role in Akkuea

The Example Contract serves as an educational resource within the Akkuea ecosystem by:

1. **Reference Implementation**: Providing a well-structured example of Soroban contract development.

2. **Best Practices Demonstration**: Showcasing recommended patterns for storage, authentication, and event emission.

3. **Developer Onboarding**: Helping new developers understand the fundamentals of Soroban contract development.

4. **Testing Framework**: Illustrating how to implement comprehensive tests for contract functionality.

5. **Integration Example**: Demonstrating how contracts can be structured to integrate with the broader Akkuea ecosystem.

This contract aligns with Akkuea's mission of making blockchain development accessible by providing clear examples and educational resources for developers building on the Soroban platform.
