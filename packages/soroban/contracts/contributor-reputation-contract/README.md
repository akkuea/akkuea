# Contributor Reputation Contract

## Overview

The Contributor Reputation Contract is a Soroban-based smart contract built for the Stellar blockchain that enables the management of user reputation, expertise verification, and credential issuance. This system allows users to build verifiable reputations in specific subject areas, have their expertise validated, and receive non-transferable credential tokens that verify their identity and contributions.

## Features

### User Management

- **User Registration**: Create user profiles with unique identifiers
- **User Verification**: Verify user identities through credential tokens
- **User Retrieval**: Access user profile information

### Reputation System

- **Reputation Scoring**: Track reputation scores for users in specific subject areas
- **Score Retrieval**: Query reputation scores for specific domains of expertise

### Expertise Management

- **Expertise Areas**: Define and update a user's areas of expertise with proficiency levels
- **Expertise Verification**: Allow verified experts to validate other users' knowledge

### Credential System

- **Token Issuance**: Mint non-transferable credential tokens tied to user identities
- **Verification Status**: Mark users as verified when they receive credential tokens

### Content Verification

- **Subject-Based Verification**: Allow experts to verify content in their domains
- **Authorization Controls**: Restrict verification to users with proven expertise

## Technical Implementation

The contract is structured into several modules:

- **lib.rs**: Main contract interface exposing all public functions
- **types.rs**: Data structures and storage keys for the contract
- **credentials.rs**: Logic for credential token issuance
- **reputation.rs**: Functions managing reputation scores
- **expertise.rs**: Code handling expertise area management
- **verify.rs**: User and content verification logic
- **error.rs**: Custom error definitions
- **test.rs**: Comprehensive unit tests

## Usage

### Getting Started

1. Build the contract:

   ```bash
   make build
   ```

2. Run tests:
   ```bash
   make test
   ```

### Contract Functions

#### User Management

- `initialize_user(caller: Address, name: String) -> u64`: Register a new user and return their ID
- `get_user(user_id: u64) -> User`: Retrieve user profile data

#### Reputation

- `update_reputation(caller: Address, user_id: u64, subject: String, score: u32)`: Update reputation score
- `get_reputation(user_id: u64, subject: String) -> u32`: Get reputation score for a specific domain

#### Credentials

- `mint_credential_token(caller: Address, user_id: u64) -> u64`: Issue a verification credential

#### Expertise

- `update_expertise_areas(caller: Address, user_id: u64, expertise_areas: Map<String, u32>)`: Set expertise levels
- `get_expertise_areas(user_id: u64) -> Map<String, u32>`: Retrieve expertise mapping

#### Verification

- `verify_user(caller: Address, user_id: u64, verification_details: String) -> u64`: Verify user identity
- `verify_content(caller: Address, content_id: u64, subject: String)`: Validate subject-specific content

## Requirements

- Soroban SDK
- Rust compiler with wasm32-unknown-unknown target
- Stellar development environment

## Security Model

The contract implements several security measures:

- **Auth Requirements**: All state-changing operations require caller authentication
- **Verification Checks**: Critical operations are restricted to verified users
- **Expertise Validation**: Content verification requires proven expertise in the subject

## Development

### Project Structure

```
contributor-reputation-contract/
├── src/
│   ├── lib.rs         # Main contract interface
│   ├── types.rs       # Data structures
│   ├── credentials.rs # Credential token logic
│   ├── reputation.rs  # Reputation management
│   ├── expertise.rs   # Expertise area handling
│   ├── verify.rs      # Verification logic
│   ├── error.rs       # Error definitions
│   └── test.rs        # Unit tests
├── Cargo.toml         # Dependencies
├── Makefile           # Build scripts
└── README.md          # Documentation
```

### Building and Testing

- Format code: `make fmt`
- Build contract: `make build`
- Run tests: `make test`
- Clean build artifacts: `make clean`

## Use Cases

- Decentralized expertise verification systems
- Reputation-based access control
- Content curation by domain experts
- Credential issuance for specialized knowledge
- Community-driven knowledge validation
