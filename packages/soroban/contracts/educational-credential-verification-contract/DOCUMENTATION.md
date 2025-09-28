# Educational Credential Verification Contract Documentation

## Overview

The Educational Credential Verification Contract is a Soroban smart contract built for the Stellar blockchain that implements a comprehensive system for verifying educator credentials, issuing verification NFTs, and managing educator profiles within the Akkuea ecosystem. The contract enables educational institutions and authorized reviewers to verify educator credentials, issue tiered verification NFTs, and maintain a trusted registry of verified educators.

## Implemented Features

### Educator Registration and Profiles

- **Educator Registration**: Educators can register by providing their name, credential hashes, and specialty areas.
- **Profile Management**: Educators can update their profiles, including name and specialty areas.
- **Credential Management**: Educators can add new credentials to their existing profiles.
- **Profile Retrieval**: Functions to retrieve educator information and verification status.

### Verification System

- **Multi-level Verification**: Educators can achieve different verification levels (Pending, Basic, Advanced, Expert).
- **Credential Verification**: Authorized reviewers can verify educator credentials through digital signatures.
- **Reviewer Management**: Administrators can add and remove authorized reviewers.
- **Institution Verification**: Verification against a list of authorized educational institutions.
- **Verification Revocation**: Administrators can revoke verification status with documented reasons.

### NFT Integration

- **Verification NFTs**: Verified educators receive NFTs representing their verification level.
- **NFT Metadata**: NFTs include verification level and specialty areas.
- **NFT Burning**: When verification is revoked, the associated NFT is burned.

### Review and Rating System

- **Educator Reviews**: Authorized reviewers can submit ratings for educators.
- **Rating Aggregation**: The contract calculates average ratings and adjusts verification levels accordingly.
- **Review Storage**: All reviews are stored on-chain for transparency and auditability.

### Search and Discovery

- **Specialty Search**: Users can find educators by specialty areas.
- **Verification Status Filter**: Users can retrieve lists of verified educators.

### Security and Authorization

- **Authentication**: All sensitive operations require proper authorization from the relevant address.
- **Admin Controls**: Special administrative functions are restricted to the contract administrator.
- **Reviewer Authorization**: Only authorized reviewers can verify credentials and submit reviews.

## Contract Structure

The contract is organized into several modules:

- **lib.rs**: Main contract implementation with public functions.
- **datatype.rs**: Data structures for educators, verification levels, and reviews.
- **interfaces.rs**: Contract interface definitions.
- **verification.rs**: Verification system implementation.
- **nft.rs**: NFT implementation for verification tokens.
- **test.rs**: Test suite for contract functionality.

## Events

The contract emits events for significant actions (though not explicitly shown in the code):

- Educator registration
- Verification status changes
- NFT issuance
- Review submissions
- Reviewer management changes

## Contract Functions

### Administrator Functions

- `initialize(env, admin)`: Initializes the contract with an administrator.
- `add_reviewer(env, admin, reviewer)`: Adds an authorized reviewer.
- `remove_reviewer(env, admin, reviewer)`: Removes an authorized reviewer.
- `revoke_verification(env, admin, educator_address, reason)`: Revokes verification status.
- `add_authorized_institution(env, admin, institution_id)`: Adds an authorized educational institution.

### Educator Management Functions

- `register_educator(env, educator_address, name, credential_hashes, specialty_areas)`: Registers a new educator.
- `update_educator_profile(env, educator_address, name, specialty_areas)`: Updates an educator's profile.
- `add_credentials(env, educator_address, new_credentials)`: Adds new credentials to an educator's profile.
- `get_educator(env, educator_address)`: Retrieves an educator's profile.
- `get_verified_educators(env)`: Lists all verified educators.
- `get_educators_by_specialty(env, specialty)`: Lists educators with a specific specialty.

### Verification Functions

- `verify_educator(env, reviewer, educator_address, verification_level)`: Verifies an educator's credentials.
- `add_verified_credential(env, reviewer, credential)`: Adds a verified credential to the system.
- `verify_credentials(env, credentials, reviewer)`: Verifies a set of credentials.
- `calculate_verification_level(env, educator)`: Calculates an educator's verification level based on reviews.

### Review System Functions

- `submit_review(env, reviewer, educator_address, rating)`: Submits a review for an educator.
- `get_educator_reviews(env, educator_address)`: Retrieves all reviews for an educator.

### NFT Functions

- `mint_verification_nft(env, recipient, level, specialties)`: Mints a verification NFT.

## Technical Implementation Details

### Data Models

#### Educator

```rust
pub struct Educator {
    pub address: Address,
    pub name: String,
    pub credentials: Vec<String>,
    pub verification_status: bool,
    pub nft_token_id: Option<String>,
    pub verification_timestamp: u64,
    pub specialty_areas: Vec<String>,
    pub verification_level: VerificationLevel,
    pub reviews_count: u32,
    pub rating: u32,
}
```

#### Verification Levels

```rust
pub enum VerificationLevel {
    Pending,
    Basic,
    Advanced,
    Expert,
}
```

#### Review

```rust
pub struct Review {
    pub reviewer: Address,
    pub educator: Address,
    pub rating: u32,
    pub timestamp: u64,
}
```

### Storage Structure

The contract uses several storage keys:

- `admin`: Stores the contract administrator address
- `EDU`: Map of educator addresses to Educator structs
- `REVIEWERS`: List of authorized reviewer addresses
- `vcreds`: Map of credential hashes to verification status
- `sigs`: Map of credential hashes to lists of verifying reviewers
- `AUTH_INST`: List of authorized institution identifiers
- `revs`: Map of educator addresses to lists of reviews
- `REVOKE`: Map of educator addresses to revocation reasons

### Authorization and Security

The contract implements several security measures:

- `require_auth()` calls to ensure transaction signers are authorized
- Admin verification for privileged operations
- Reviewer authorization checks for verification operations
- Duplicate prevention in voting and review systems
- Validation of credential formats and signatures

### Verification Process

The verification process involves several steps:

1. Educators register with credential hashes
2. Authorized reviewers verify credentials
3. Verification includes hash format validation, digital signature verification, and institution verification
4. Upon successful verification, an NFT is minted representing the verification level
5. Reviews can adjust the verification level over time

### Rating System

The rating system works as follows:

1. Authorized reviewers submit ratings (1-10)
2. The contract calculates the average rating
3. Verification levels are assigned based on rating thresholds:
   - 0-3: Basic
   - 4-7: Advanced
   - 8-10: Expert

## Role in Akkuea Ecosystem

The Educator Verification NFT Contract plays a critical role in the Akkuea ecosystem by:

1. **Establishing Trust**: Creating a verified registry of educators with validated credentials.
2. **Quality Assurance**: Enabling a rating system to maintain high educational standards.
3. **Specialty Discovery**: Facilitating the discovery of educators by specialty areas.
4. **Credential Verification**: Providing a secure and transparent system for verifying educational credentials.
5. **Integration Support**: Offering verification status that can be used by other contracts in the ecosystem.

This contract serves as a foundation for educational quality control within the Akkuea platform, ensuring that users can identify and trust verified educators. The NFT component provides a visible, transferable proof of verification that educators can showcase across the ecosystem and potentially in external platforms.
