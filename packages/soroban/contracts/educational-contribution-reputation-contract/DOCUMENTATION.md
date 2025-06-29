# Contributor Reputation Contract Documentation

## Overview

The Contributor Reputation Contract is a Soroban-based smart contract built for the Stellar blockchain that enables the management of user reputation, expertise verification, and credential issuance within the Akkuea ecosystem. This system allows users to build verifiable reputations in specific subject areas, have their expertise validated, and receive non-transferable credential tokens that verify their identity and contributions.

The contract serves as a trust layer for the educational platform, ensuring that contributors' expertise and contributions are properly recognized, verified, and rewarded. By maintaining a transparent and immutable record of user reputations, the contract facilitates trust between content creators, educators, and learners in the ecosystem.

## General Features

- **User Management**: Registration, verification, and profile retrieval
- **Reputation System**: Domain-specific reputation scoring and tracking
- **Expertise Management**: Definition, verification, and validation of expertise areas
- **Credential System**: Non-transferable token issuance for verified identities
- **Verification Mechanisms**: Multi-level verification processes for user credentials
- **Score Calculation**: Algorithmic reputation score calculation based on contributions and validations

## Functionalities

1. **User Management**

   - **User Registration**: Create user profiles with unique identifiers
   - **User Verification**: Verify user identities through credential tokens
   - **User Retrieval**: Access user profile information
   - **Profile Updates**: Modify user profile information as needed

2. **Reputation System**

   - **Reputation Scoring**: Track reputation scores for users in specific subject areas
   - **Score Retrieval**: Query reputation scores for specific domains of expertise
   - **Score Calculation**: Calculate reputation based on contributions, validations, and time
   - **Score History**: Maintain historical reputation data for trend analysis

3. **Expertise Management**

   - **Expertise Areas**: Define and update a user's areas of expertise with proficiency levels
   - **Expertise Verification**: Allow verified experts to validate other users' knowledge
   - **Expertise Endorsement**: Enable peer endorsement of expertise claims
   - **Expertise Levels**: Categorize expertise into different proficiency levels

4. **Credential System**
   - **Token Issuance**: Mint non-transferable credential tokens tied to user identities
   - **Verification Status**: Mark users as verified when they receive credential tokens
   - **Token Revocation**: Remove credentials when verification criteria are no longer met
   - **Credential Validation**: Verify the authenticity of user credentials

## Contract Structure

```
educational-contribution-reputation-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and implementation
│   ├── user.rs                 # User management functionality
│   ├── reputation.rs           # Reputation scoring and management
│   ├── expertise.rs            # Expertise definition and verification
│   ├── credential.rs           # Credential token issuance and management
│   ├── types.rs                # Data structures and type definitions
│   ├── storage.rs              # Storage management functions
│   ├── events.rs               # Event definitions and emission
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Project documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Improvement suggestions
├── TEST_DOCUMENTATION.md       # Test documentation
└── Makefile                    # Build automation
```

## Events

The contract emits the following events:

1. `user_registered` - When a new user is registered

   - Data: user_id, registration_timestamp

2. `reputation_updated` - When a user's reputation score changes

   - Data: user_id, domain, old_score, new_score, update_timestamp

3. `expertise_verified` - When a user's expertise is verified

   - Data: user_id, domain, level, verifier_id, verification_timestamp

4. `credential_issued` - When a credential token is issued

   - Data: user_id, credential_type, issuer_id, issuance_timestamp

5. `credential_revoked` - When a credential token is revoked
   - Data: user_id, credential_type, revoker_id, revocation_timestamp

## Functions

### User Management

#### `register_user(env: Env, user_address: Address, name: String, bio: Option<String>) -> u64`

- Registers a new user in the system
- Parameters:
  - `user_address`: The Stellar address of the user
  - `name`: The display name of the user
  - `bio`: Optional biography or description
- Returns a unique user ID
- Emits `user_registered` event

#### `get_user(env: Env, user_id: u64) -> Option<User>`

- Retrieves user information by ID
- Parameters:
  - `user_id`: The unique identifier of the user
- Returns user information or None if not found

#### `update_user_profile(env: Env, user_id: u64, name: Option<String>, bio: Option<String>) -> Result<(), Error>`

- Updates a user's profile information
- Parameters:
  - `user_id`: The unique identifier of the user
  - `name`: Optional new display name
  - `bio`: Optional new biography
- Returns success or an error
- Requires authentication from the user's address

### Reputation Management

#### `update_reputation(env: Env, user_id: u64, domain: String, score_change: i32) -> Result<i32, Error>`

- Updates a user's reputation in a specific domain
- Parameters:
  - `user_id`: The unique identifier of the user
  - `domain`: The subject area or domain of expertise
  - `score_change`: The amount to change the reputation score
- Returns the new reputation score or an error
- Requires authentication from an authorized address
- Emits `reputation_updated` event

#### `get_reputation(env: Env, user_id: u64, domain: String) -> Option<i32>`

- Retrieves a user's reputation score in a specific domain
- Parameters:
  - `user_id`: The unique identifier of the user
  - `domain`: The subject area or domain of expertise
- Returns the reputation score or None if not found

### Expertise Management

#### `add_expertise(env: Env, user_id: u64, domain: String, level: u8) -> Result<(), Error>`

- Adds a domain of expertise to a user's profile
- Parameters:
  - `user_id`: The unique identifier of the user
  - `domain`: The subject area or domain of expertise
  - `level`: The proficiency level (1-5)
- Returns success or an error
- Requires authentication from the user's address

#### `verify_expertise(env: Env, verifier_id: u64, user_id: u64, domain: String) -> Result<(), Error>`

- Verifies a user's expertise claim
- Parameters:
  - `verifier_id`: The ID of the verifying expert
  - `user_id`: The ID of the user being verified
  - `domain`: The subject area being verified
- Returns success or an error
- Requires authentication from the verifier's address
- Emits `expertise_verified` event

### Credential Management

#### `issue_credential(env: Env, user_id: u64, credential_type: String) -> Result<(), Error>`

- Issues a credential token to a user
- Parameters:
  - `user_id`: The unique identifier of the user
  - `credential_type`: The type of credential being issued
- Returns success or an error
- Requires authentication from an authorized issuer
- Emits `credential_issued` event

#### `revoke_credential(env: Env, user_id: u64, credential_type: String) -> Result<(), Error>`

- Revokes a previously issued credential
- Parameters:
  - `user_id`: The unique identifier of the user
  - `credential_type`: The type of credential being revoked
- Returns success or an error
- Requires authentication from an authorized issuer
- Emits `credential_revoked` event

## Technical Details and Implementation Notes

1. **Data Model**

   - `User`: Stores basic user information and profile data
   - `Reputation`: Maps users to domain-specific reputation scores
   - `Expertise`: Represents a user's claimed expertise in a domain
   - `Credential`: Represents a verification token issued to a user

2. **Storage**

   - Uses instance storage for contract data
   - Implements key-based storage for users, reputations, expertise, and credentials
   - Uses symbolic keys for storage access
   - Maintains indices for efficient querying

3. **Authentication**

   - Implements `require_auth` for user authentication
   - Uses role-based access control for administrative functions
   - Verifies transaction signatures for sensitive operations

4. **Reputation Algorithm**

   - Calculates reputation scores based on:
     - Quantity and quality of contributions
     - Peer validations and endorsements
     - Time-based decay for inactivity
     - Expertise level in the domain

5. **Credential Tokens**

   - Implements non-transferable tokens using Soroban token interface
   - Links tokens to user identities through cryptographic signatures
   - Provides verification mechanisms for credential authenticity

6. **Error Handling**
   - Implements comprehensive error types
   - Provides detailed error messages for debugging
   - Handles edge cases gracefully

## Role in Akkuea

The Contributor Reputation Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Trust Building**: Establishes trust between content creators, educators, and learners through verifiable reputation scores.

2. **Quality Assurance**: Helps identify high-quality contributors through their reputation scores and verified expertise.

3. **Incentive Alignment**: Creates incentives for positive contributions by rewarding them with reputation points and credentials.

4. **Expertise Verification**: Provides a mechanism for verifying the expertise of educational content creators.

5. **Identity Management**: Offers a decentralized identity solution for contributors in the educational ecosystem.

This contract aligns with Akkuea's mission of making education accessible by ensuring that educational content comes from verified and reputable sources. It supports the platform's goal of creating a trustworthy educational marketplace where quality contributions are recognized and rewarded.
