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

2. **Advanced Reputation System**
   - **Weighted Scoring**: Advanced reputation calculation based on contribution type and domain specificity
   - **Time-Decay Factors**: Automatic reputation degradation over time to ensure active participation
   - **Domain-Specific Algorithms**: Specialized reputation formulas for technical vs. community contributions
   - **Cross-Domain Normalization**: Standardized reputation scoring across different expertise areas
   - **Score Retrieval**: Query both raw and normalized reputation scores for specific domains
   - **Score History**: Maintain detailed historical reputation data with algorithmic updates

3. **Expertise Management**
   - **Expertise Areas**: Define and update a user's areas of expertise with proficiency levels
   - **Expertise Verification**: Allow verified experts to validate other users' knowledge
   - **Expertise Endorsement**: Enable peer endorsement of expertise claims
   - **Expertise Levels**: Categorize expertise into different proficiency levels

4. **Multi-Tier Verification System**

   - **Verification Tiers**: Four-level verification system (Basic, Verified, Expert, Authority)
   - **Tier-Specific Requirements**: Progressive requirements for higher verification levels
   - **Expiration and Renewal**: Time-bound verification with renewal processes
   - **Verification Delegation**: Authority delegation for scalable verification management
   - **Legacy Support**: Backward compatibility with existing verification functions

5. **Credential System**
   - **Token Issuance**: Mint non-transferable credential tokens tied to user identities
   - **Verification Status**: Mark users as verified when they receive credential tokens
   - **Token Revocation**: Remove credentials when verification criteria are no longer met
   - **Credential Validation**: Verify the authenticity of user credentials

## Contract Structure

```
educational-contribution-reputation-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and implementation
│   ├── algorithms.rs           # Advanced reputation algorithms and calculations
│   ├── analytics.rs            # Analytics and data insights
│   ├── credentials.rs          # Credential token issuance and management
│   ├── error.rs                # Error definitions and handling
│   ├── expertise.rs            # Expertise definition and verification
│   ├── integration.rs          # External system integration
│   ├── recovery.rs             # Dispute resolution and recovery mechanisms
│   ├── reputation.rs           # Basic reputation scoring and management
│   ├── security.rs             # Security auditing and access control
│   ├── storage.rs              # Storage management functions
│   ├── test.rs                 # Test module
│   ├── types.rs                # Data structures and type definitions
│   └── verify.rs               # Multi-tier verification system
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

3. `reputation_updated_advanced` - When reputation is updated using advanced algorithms

   - Data: user_id, domain, weighted_score, contribution_type, algorithm_version

4. `expertise_verified` - When a user's expertise is verified

   - Data: user_id, domain, level, verifier_id, verification_timestamp

5. `user_verified_tier` - When a user achieves a specific verification tier

   - Data: user_id, tier, verified_by, verification_timestamp, expires_at

6. `verification_renewed` - When a user's verification is renewed

   - Data: user_id, tier, renewed_by, renewal_timestamp, new_expires_at

7. `verification_delegated` - When verification authority is delegated

   - Data: delegator, delegate, user_id, max_tier, expires_at

8. `credential_issued` - When a credential token is issued

   - Data: user_id, credential_type, issuer_id, issuance_timestamp

9. `credential_revoked` - When a credential token is revoked
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

### Advanced Reputation Management

#### `update_reputation_advanced(env: Env, caller: Address, user_id: u64, subject: String, base_score: u32, contribution_type: u32) -> Result<(), Error>`

- Updates a user's reputation in a subject/domain using advanced algorithms
- Parameters:
  - `caller`: The admin address (must be authorized)
  - `user_id`: The ID of the user whose reputation is being updated
  - `subject`: The subject/domain of the contribution
  - `base_score`: The base quality score (0-100)
  - `contribution_type`: The type of contribution (0=Code, 1=Mentoring, 2=Review, 3=Other)
- Returns success or an error if the user is not verified, not found, or the caller is not admin
- Requires authentication from an admin address
- Applies domain-specific weighting, time-decay factors, and normalization
- Uses weighted scoring based on contribution type and domain specificity
- Emits `reputation_updated_advanced` event

#### `get_normalized_reputation(env: Env, user_id: u64) -> Result<Map<String, u32>, Error>`

- Retrieves the normalized reputation scores for a user across all domains/subjects
- Parameters:
  - `user_id`: The ID of the user whose normalized reputation is being queried
- Returns a map from subject/domain to normalized reputation score (0-1000), or an error if the user does not exist
- Useful for comparing user reputation across different areas, regardless of the raw score distributions
- Uses cross-domain normalization algorithms for fair comparison
- Handles edge cases like single domain users and zero scores

### Basic Reputation Management

#### `update_reputation(env: Env, user_id: u64, domain: String, score_change: i32) -> Result<i32, Error>`

- Updates a user's reputation in a specific domain using basic scoring
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

### Multi-Tier Verification Management

#### `verify_user_with_tier(env: Env, caller: Address, user_id: u64, verification_details: String, target_tier: u32) -> Result<(), Error>`

- Verifies a user with a specific tier level in the multi-level verification system
- Parameters:
  - `caller`: The address performing the verification (must be authorized for the target tier)
  - `user_id`: The ID of the user being verified
  - `verification_details`: String containing details about the verification process
  - `target_tier`: The verification tier level (1=Basic, 2=Verified, 3=Expert, 4=Authority)
- Returns success or an error if requirements are not met
- Requires proper authorization based on the target tier
- Validates tier-specific requirements (expertise areas, previous verification, etc.)
- Emits `user_verified_tier` event

#### `renew_verification(env: Env, caller: Address, user_id: u64) -> Result<(), Error>`

- Renews an existing user verification before it expires
- Parameters:
  - `caller`: The address performing the renewal (must be authorized)
  - `user_id`: The ID of the user whose verification is being renewed
- Returns success or an error
- Can only be renewed within the renewal window (30 days before expiration)
- Maintains the same tier level but updates expiration timestamp
- Emits `verification_renewed` event

#### `add_verification_delegation(env: Env, caller: Address, delegate_address: Address, user_id: u64, max_tier: u32, duration_days: u32) -> Result<(), Error>`

- Delegates verification authority to another address for a specific user
- Parameters:
  - `caller`: The admin address delegating authority (must be admin)
  - `delegate_address`: The address receiving the verification authority
  - `user_id`: The specific user ID that the delegate can verify
  - `max_tier`: The maximum verification tier the delegate can assign (1-4)
  - `duration_days`: How long the delegation remains valid in days
- Returns success or an error
- Only admins can delegate verification authority
- Creates time-limited verification permissions for scalability
- Emits `verification_delegated` event

#### `get_user_verification(env: Env, user_id: u64) -> Result<UserVerification, Error>`

- Retrieves the verification details for a specific user
- Parameters:
  - `user_id`: The ID of the user whose verification details are being queried
- Returns UserVerification structure containing tier, verified_by, timestamps, and details
- Shows current verification status, tier level, and expiration information
- Returns error if user is not verified or verification not found

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

4. **Advanced Reputation Algorithm**
   - **Weighted Scoring**: Calculates reputation using contribution type and domain multipliers
     - Code contributions: 100% base weight
     - Mentoring contributions: 120% base weight (higher value for community building)
     - Review contributions: 90% base weight
     - Other contributions: 80% base weight
   - **Domain Multipliers**: Different domains have varying importance multipliers
     - Technical domains (Rust, JavaScript, Python, Soroban, Blockchain): 110% multiplier
     - Community domains (Mentoring, Leadership): 120% multiplier
     - General domains: 100% base multiplier
   - **Time-Decay Factors**: Implements exponential decay for inactive reputation scores
     - Formula: `score * (0.95)^periods`, where periods = days_elapsed / 30
     - Ensures active participation is rewarded over historical contributions
   - **Cross-Domain Normalization**: Standardizes scores across different expertise areas
     - Formula: `normalized = (domain_score * 1000) / max_score_found`
     - Handles edge cases for single domain users and zero scores
   - **Score Combination**: Blends new contributions with existing reputation
     - Formula: `(weighted_score * 30% + existing_score * 70%) / 100`
     - Provides stability while allowing for reputation growth

5. **Multi-Tier Verification System**
   - **Four Verification Tiers**:
     - **Basic (Tier 1)**: Entry-level verification, 1-year validity
     - **Verified (Tier 2)**: Moderator-approved, 2-year validity
     - **Expert (Tier 3)**: Requires credentials and expertise, 3-year validity
     - **Authority (Tier 4)**: Institutional authority, 5-year validity
   - **Tier Requirements**: Progressive validation requirements for higher tiers
   - **Verification Delegation**: Authority can be delegated for specific users and time periods
   - **Expiration Management**: Time-bound verification with renewal processes
   - **Backward Compatibility**: Legacy verification functions remain supported

6. **Credential Tokens**
   - Implements non-transferable tokens using Soroban token interface
   - Links tokens to user identities through cryptographic signatures
   - Provides verification mechanisms for credential authenticity

7. **Error Handling**
   - Implements comprehensive error types
   - Provides detailed error messages for debugging
   - Handles edge cases gracefully

## Role in Akkuea

The Contributor Reputation Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Trust Building**: Establishes trust between content creators, educators, and learners through verifiable reputation scores and multi-tier verification system.

2. **Quality Assurance**: Helps identify high-quality contributors through their reputation scores, verified expertise, and tier-based verification levels.

3. **Incentive Alignment**: Creates incentives for positive contributions by rewarding them with weighted reputation points that consider contribution type and domain expertise.

4. **Expertise Verification**: Provides a scalable multi-tier verification mechanism with delegation capabilities for verifying the expertise of educational content creators.

5. **Identity Management**: Offers a decentralized identity solution with time-bound verification and renewal processes for contributors in the educational ecosystem.

6. **Advanced Analytics**: Enables sophisticated reputation analysis through cross-domain normalization and time-decay algorithms that reflect true contributor value.

7. **Scalable Governance**: Supports verification delegation and tier-based authority distribution to handle platform growth efficiently.

This contract aligns with Akkuea's mission of making education accessible by ensuring that educational content comes from verified and reputable sources. The advanced reputation algorithms and multi-tier verification system support the platform's goal of creating a trustworthy educational marketplace where quality contributions are recognized, weighted appropriately, and rewarded fairly based on their type and domain expertise.
