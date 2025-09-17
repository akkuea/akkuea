# Platform User Reputation Contract Documentation

## Overview

The Platform User Reputation Contract is a Soroban-based smart contract built for the Stellar blockchain that enables the management of user profiles, expertise tracking, and reputation scoring within the Akkuea ecosystem. This system allows users to register, declare their areas of expertise, and build reputation through positive contributions to the platform.

The contract serves as a foundational layer for the Akkuea educational platform, providing a transparent and immutable record of user reputations and expertise areas. By maintaining this information on-chain, the contract facilitates trust between users and helps identify valuable contributors to the educational community.

## General Features

- **User Registration**: Create and manage user profiles with unique identifiers
- **Expertise Management**: Track and update user expertise areas
- **Reputation System**: Score-based reputation tracking with history
- **User Queries**: Retrieve user information and filter by criteria
- **Event Emission**: Transparent tracking of all reputation changes
- **Administrative Controls**: System management functions for maintenance

## Functionalities

1. **User Management**
   - **User Registration**: Register new users with initial expertise areas
   - **Profile Updates**: Modify user expertise information
   - **User Verification**: Check if a user is registered in the system
   - **User Retrieval**: Access user profile information
   - **User Removal**: Remove users from the system when necessary

2. **Expertise Management**
   - **Expertise Declaration**: Allow users to declare their areas of expertise
   - **Expertise Updates**: Modify expertise areas as skills evolve
   - **Expertise Addition**: Add new expertise areas to existing profiles
   - **Expertise Removal**: Remove expertise areas from user profiles

3. **Reputation System**
   - **Reputation Scoring**: Track reputation scores for users
   - **Score Updates**: Modify reputation based on user contributions
   - **Reputation Reset**: Reset individual user reputation when necessary
   - **System-wide Reset**: Reset all reputations for system maintenance

4. **User Queries**
   - **All Users**: Retrieve all registered users
   - **Recent Users**: Filter users by registration time
   - **User Count**: Get the total number of registered users
   - **Profile Retrieval**: Get detailed user profile information

## Contract Structure

```
platform-user-reputation-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and implementation
│   ├── register.rs             # User registration functionality
│   ├── reputation.rs           # Reputation scoring and management
│   ├── storage.rs              # Storage management functions
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

The contract emits the following events:

1. `usr_reg` - When a new user is registered
   - Data: user_address, expertise_areas

2. `expertise` - When a user's expertise areas are updated
   - Data: user_address, new_expertise_areas

3. `rep_upt` - When a user's reputation score changes
   - Data: user_address, score_delta, reason

4. `rep_reset` - When a user's reputation is reset
   - Data: user_address

5. `usr_rem` - When a user is removed
   - Data: user_address

6. `exp_added` - When an expertise area is added to a user profile
   - Data: user_address, expertise_area

7. `exp_rem` - When an expertise area is removed from a user profile
   - Data: user_address, expertise_area

## Functions

### User Management

#### `register(env: Env, user: Address, expertise: Vec<Symbol>)`

- Registers a new user in the system with initial expertise areas
- Parameters:
  - `user`: The Stellar address of the user
  - `expertise`: List of expertise areas as symbols
- Emits `usr_reg` event

#### `is_registered(env: Env, user: Address) -> bool`

- Checks if a user is already registered in the system
- Parameters:
  - `user`: The Stellar address of the user
- Returns true if the user is registered, false otherwise

#### `get_user(env: Env, user: Address) -> storage::User`

- Retrieves full user profile information
- Parameters:
  - `user`: The Stellar address of the user
- Returns the user profile with all details

#### `remove_user(env: Env, user: Address)`

- Removes a user from the system
- Parameters:
  - `user`: The Stellar address of the user
- Emits `usr_rem` event

#### `get_all_users(env: Env) -> Vec<Address>`

- Retrieves all registered user addresses
- Returns a vector of all user addresses

#### `get_recent_users(env: Env, cutoff_time: u64) -> Vec<storage::User>`

- Retrieves users registered after a specific time
- Parameters:
  - `cutoff_time`: The timestamp to filter users by
- Returns a vector of user profiles registered after the cutoff time

#### `get_user_count(env: Env) -> u64`

- Gets the total number of registered users
- Returns the user count as a u64

### Expertise Management

#### `update_expertise(env: Env, user: Address, new_expertise: Vec<Symbol>)`

- Updates a user's expertise areas
- Parameters:
  - `user`: The Stellar address of the user
  - `new_expertise`: New list of expertise areas
- Emits `expertise` event

#### `add_expertise(env: Env, user: Address, expertise: Symbol)`

- Adds a single expertise area to a user's profile
- Parameters:
  - `user`: The Stellar address of the user
  - `expertise`: The expertise area to add
- Emits `exp_added` event

#### `remove_expertise(env: Env, user: Address, expertise: Symbol)`

- Removes a single expertise area from a user's profile
- Parameters:
  - `user`: The Stellar address of the user
  - `expertise`: The expertise area to remove
- Emits `exp_rem` event

### Reputation Management

#### `update_reputation(env: Env, user: Address, score_delta: i64, reason: Symbol)`

- Updates a user's reputation score
- Parameters:
  - `user`: The Stellar address of the user
  - `score_delta`: The amount to change the reputation (positive or negative)
  - `reason`: Symbol indicating the reason for the change
- Emits `rep_upt` event

#### `reset_reputation(env: Env, user: Address)`

- Resets a user's reputation score to 0
- Parameters:
  - `user`: The Stellar address of the user
- Emits `rep_reset` event

#### `reset_all_reputations(env: Env)`

- Resets all users' reputation scores to 0
- Emits `rep_reset` event with contract address

#### `remove_all_users(env: Env)`

- Removes all users from the system
- Emits `usr_rem` event with contract address

## Technical Details and Implementation Notes

1. **Data Model**
   - `User`: Stores user information including address, expertise areas, reputation score, and registration timestamp
   - Uses Soroban's native types for addresses and symbols

2. **Storage**
   - Uses instance storage for contract data
   - Implements key-based storage for users
   - Uses symbolic keys for storage access
   - Maintains indices for efficient querying

3. **Authentication**
   - Implements basic authentication for user operations
   - Does not currently implement role-based access control
   - Relies on transaction signatures for operation authorization

4. **Reputation System**
   - Uses a simple integer-based reputation score
   - Supports both positive and negative reputation adjustments
   - Tracks reasons for reputation changes
   - Does not implement time decay or weighted scoring

5. **Event System**
   - Emits events for all significant state changes
   - Uses standardized event topics for consistent tracking
   - Includes relevant data in event payloads

6. **Error Handling**
   - Implements basic error handling
   - Does not currently have comprehensive error types
   - Relies on Soroban's native error handling

## Role in Akkuea

The User Reputation Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Trust Building**: Establishes trust between users through transparent reputation tracking.

2. **Expertise Identification**: Helps identify users with specific expertise areas for educational content creation and validation.

3. **Contribution Recognition**: Provides a mechanism for recognizing and rewarding positive contributions to the platform.

4. **Community Building**: Facilitates the formation of communities around specific expertise areas.

5. **Quality Assurance**: Helps maintain content quality by identifying reputable contributors.

This contract aligns with Akkuea's mission of making education accessible by ensuring that users can build and maintain reputations based on their contributions to the educational ecosystem. It supports the platform's goal of creating a trustworthy educational marketplace where quality contributions are recognized and rewarded.
