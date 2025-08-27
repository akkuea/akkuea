# Educational NFT Contract

## Overview

This project implements an Educational NFT contract for the Soroban smart contract platform, designed specifically for educational content ownership and fractional sharing. The contract leverages the `stellar-tokens` library for standard NFT functionality while adding educational-specific features including educator verification and fractionalized ownership.

## Features

### Core Functionality
- ✅ Soroban-native NFT implementation using `stellar_tokens::non_fungible` library
- ✅ Educational NFT minting with educator verification
- ✅ IPFS/Arweave metadata hash support
- ✅ Fractionalized ownership for shared educational NFTs
- ✅ Educator verification through external contract integration
- ✅ Comprehensive event emission for all major operations
- ✅ Ownable contract with admin controls

### Key Components

#### 1. Contract Structure (`lib.rs`)
- Main contract implementing `stellar_tokens::non_fungible::NonFungibleToken`
- Uses `stellar_tokens::non_fungible::Base` for standard NFT functionality
- Implements `stellar_access::ownable::Ownable` for ownership controls
- Constructor-based initialization with educator verification contract address

#### 2. Educational NFT Logic (`nft.rs`)
- `EducationalNFT` struct with educational metadata and collection support
- `FractionalOwnership` struct for managing shared ownership
- Fractionalization logic with majority decision thresholds
- Storage management using Soroban's instance storage with typed keys

#### 3. Utilities (`utils.rs`)
- Comprehensive event system for tracking all NFT operations
- Event emission helpers for mint, transfer, fractionalization, and fraction transfers
- Educational-specific error handling with `NFTError` enum
- Structured event data types for better off-chain integration

## Event System

The contract implements a comprehensive event system to track all major NFT operations. Events are emitted using Soroban's native event system and can be monitored by off-chain applications.

### Event Types

#### 1. Mint Event (`mint`)
Emitted when a new educational NFT is minted.
```rust
pub struct MintEvent {
    pub token_id: u64,
    pub owner: Address,
    pub collection_id: u64,
    pub fractions: u32,
    pub metadata_hash: Bytes,
}
```

#### 2. Transfer Event (`transfer`)
Emitted when an NFT is transferred between addresses.
```rust
pub struct TransferEvent {
    pub token_id: u32,
    pub from: Address,
    pub to: Address,
}
```

#### 3. Fractionalization Event (`fraction`)
Emitted when an NFT is fractionalized into multiple ownership shares.
```rust
pub struct FractionalizeEvent {
    pub token_id: u64,
    pub owner: Address,
    pub total_fractions: u32,
}
```

#### 4. Fraction Transfer Event (`frac_xfer`)
Emitted when fractions of an NFT are transferred between owners.
```rust
pub struct FractionTransferEvent {
    pub token_id: u64,
    pub from: Address,
    pub to: Address,
    pub amount: u32,
}
```

### Event Usage

Events are automatically emitted by the contract functions:
- `mint_nft()` emits a `MintEvent`
- `transfer_nft()` and internal transfers emit `TransferEvent`
- `fractionalize_nft()` emits a `FractionalizeEvent`
- `transfer_fractions()` emits a `FractionTransferEvent`

Off-chain applications can subscribe to these events to:
- Track NFT ownership changes
- Monitor fractionalization activities
- Build analytics and reporting dashboards
- Maintain synchronized databases

## Data Structures

### EducationalNFT
```rust
pub struct EducationalNFT {
    pub token_id: u64,        // Unique identifier for the NFT
    pub owner: Address,       // Current owner's Stellar address
    pub collection_id: u64,   // Collection identifier for organizing content
    pub fractions: u32,       // Number of ownership fractions (0 = non-fractional)
    pub metadata_hash: Bytes, // Hash of metadata stored off-chain (IPFS/Arweave)
}
```

### FractionalOwnership
```rust
pub struct FractionalOwnership {
    pub fraction_owners: Map<Address, u32>, // Map of owners to their fraction amounts
    pub min_decision_threshold: u32,        // Minimum fractions for ownership decisions (majority)
}
```

### Storage Keys (DataKey enum)
```rust
pub enum DataKey {
    EducationalNFT(u64),      // token_id -> EducationalNFT data
    FractionalOwners(u64),    // token_id -> FractionalOwnership data
    EducatorVerificationAddr, // Address of educator verification contract
}
```

## Key Functions

### Contract Initialization
- `__constructor(owner, educator_contract_addr)` - Initialize contract with owner and educator verification contract

### Minting
- `mint_nft(caller, collection_id, fractions, metadata_hash)` - Mint NFTs with educator verification
  - Requires caller to be a verified educator
  - Returns token ID on success
  - Emits mint event

### Transfers
- `transfer_nft(caller, token_id, new_owner)` - Transfer NFT ownership
  - Works for both fractional and non-fractional NFTs
  - For fractional NFTs, requires majority ownership for decisions
  - Emits transfer event

### Fractionalization
- `fractionalize_nft(caller, token_id)` - Convert NFT into fractional shares
  - Only owner can fractionalize
  - Creates fractional ownership structure with majority decision threshold
  - Emits fractionalize event

### Fractional Ownership Management  
- `transfer_fractions(caller, token_id, to, amount)` - Transfer fractional ownership shares
  - Validates sufficient balance before transfer
  - Updates fractional ownership mapping
  - Emits fraction transfer event
- `get_fraction_balance(token_id, owner)` - Query fractional ownership balance

### Information Queries
- `get_nft_info(token_id)` - Get complete NFT information
- Standard NFT functions through `stellar_tokens` inheritance:
  - `owner_of()`, `balance_of()`, `name()`, `symbol()`, `token_uri()`

## Architecture Benefits

1. **Stellar-Native Design**: Built specifically for Soroban using `stellar-tokens` library for standard compliance
2. **Educational Focus**: Educator verification ensures only qualified educators can mint NFTs
3. **Flexible Fractionalization**: Supports both traditional and fractional NFT ownership models
4. **Majority Governance**: Fractional ownership requires majority consensus for major decisions
5. **Comprehensive Events**: Full event logging for transparency and off-chain integration
6. **Efficient Storage**: Optimized use of Soroban instance storage with typed keys
7. **Security-First**: Built-in authorization checks and error handling throughout
8. **Extensible Design**: Modular structure allows for future enhancements

## Security Features

- **Educator Verification**: Only verified educators can mint NFTs through external contract validation
- **Ownership Authorization**: All operations require proper authentication (`require_auth()`)
- **Fractional Safeguards**: Majority ownership required for fractional NFT transfers
- **Input Validation**: Comprehensive validation for all function parameters
- **Error Handling**: Structured error types with descriptive error codes
- **Event Auditability**: All operations emit events for complete audit trails
- **Storage Safety**: Type-safe storage keys prevent data corruption

## Usage Example

```rust
// Deploy and initialize the contract
let contract_id = env.register(
    EducationalNFTContract,
    (admin_address.clone(), educator_verification_contract_address.clone())
);
let client = EducationalNFTContractClient::new(&env, &contract_id);

// Mint a non-fractional educational NFT (only verified educators can mint)
let token_id = client.mint_nft(
    &verified_educator,
    &collection_id,      // Collection identifier
    &0u32,              // 0 = non-fractional NFT
    &metadata_hash      // IPFS/Arweave hash
);

// Mint a fractional educational NFT
let fractional_token_id = client.mint_nft(
    &verified_educator,
    &collection_id,
    &100u32,            // 100 fractions total
    &metadata_hash
);

// Fractionalize the NFT (creates fractional ownership structure)
client.fractionalize_nft(&owner, &fractional_token_id);

// Transfer fractions to another user
client.transfer_fractions(
    &owner,
    &fractional_token_id,
    &new_owner,
    &25u32              // Transfer 25 fractions
);

// Check fraction balance
let balance = client.get_fraction_balance(&fractional_token_id, &owner);
// Should return 75 (100 - 25 transferred)

// Transfer entire NFT (requires majority ownership for fractional NFTs)
client.transfer_nft(&owner, &token_id, &new_owner);
```

## Dependencies

- `soroban-sdk`: Core Soroban blockchain functionality
- `stellar-tokens`: Standard token implementations for Stellar/Soroban
- `stellar-access`: Access control and ownership management utilities
- `stellar-macros`: Macros for stellar_tokens integration

## Project Structure

```
src/
├── lib.rs          # Main contract implementation with public interface
├── nft.rs          # Core NFT logic, storage, and fractionalization
├── utils.rs        # Events, error types, and utility functions
└── tests.rs        # Comprehensive test suite

mock-educator-verification-nft/  # Mock contract for educator verification testing
test_snapshots/                  # Soroban test snapshots for regression testing
```

## Error Handling

The contract defines comprehensive error types in the `NFTError` enum:

```rust
pub enum NFTError {
    TokenNotFound = 1,                    // Requested token doesn't exist
    NotOwner = 2,                        // Caller is not the owner
    InvalidFractions = 3,                // Invalid fractionalization parameters
    AlreadyFractionalized = 4,           // NFT is already fractionalized
    NotFractionalized = 5,               // Operation requires fractionalized NFT
    InsufficientFractions = 6,           // Not enough fractions for operation
    InvalidFractionAmount = 7,           // Invalid fraction transfer amount
    FractionOwnerNotFound = 8,           // Fraction owner not found
    Unauthorized = 9,                    // Not authorized for operation
    InvalidCollection = 10,              // Invalid collection ID
    InsufficientFractionsForTransfer = 11, // Need majority for NFT transfer
    InsufficientFractionsForApprove = 12,  // Need majority for approval
    ContractNotInitialized = 13,         // Contract not properly initialized
}
```

## Testing

The contract includes a comprehensive test suite covering:

- ✅ Contract initialization and metadata
- ✅ Successful and failed NFT minting scenarios
- ✅ NFT transfers (both individual and fractional)
- ✅ Fractionalization workflows
- ✅ Fraction transfer operations
- ✅ Error conditions and edge cases
- ✅ Event emission verification
- ✅ Educator verification integration

Run tests with:
```bash
cd mock-educator-verification-nft && stellar contract build && cd ..
cargo test
```


