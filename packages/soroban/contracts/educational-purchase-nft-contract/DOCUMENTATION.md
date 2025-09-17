# Educational Purchase NFT Contract Documentation

## Overview

The Educational Purchase NFT Contract is a Soroban-based smart contract built for the Stellar blockchain that enables the creation and management of non-fungible tokens (NFTs) representing proof of educational content purchases within the Akkuea ecosystem. This contract allows for the minting of NFTs that serve as verifiable receipts for educational transactions, providing users with permanent proof of ownership for their educational investments.

The contract creates a transparent and immutable record of educational purchases, enhancing trust in the Akkuea marketplace while providing users with collectible digital assets that represent their educational journey. These NFTs can serve as credentials, proof of purchase, and potentially unlock additional value in the educational ecosystem.

## General Features

- **NFT Minting**: Create unique tokens representing educational purchases
- **Purchase Verification**: Verify the authenticity of educational transactions
- **Metadata Management**: Store comprehensive purchase details in NFT metadata
- **Ownership Tracking**: Track current and historical ownership of educational content
- **Transaction Linking**: Connect NFTs directly to blockchain transactions
- **Query Capabilities**: Retrieve NFT information by various identifiers

## Functionalities

1. **NFT Creation and Management**
   - **NFT Minting**: Create unique tokens for educational purchases
   - **Metadata Storage**: Store comprehensive purchase details
   - **Ownership Assignment**: Assign NFTs to purchasers
   - **Transaction Linking**: Connect NFTs to blockchain transactions

2. **Purchase Verification**
   - **Transaction Verification**: Verify that purchases occurred on-chain
   - **Ownership Verification**: Confirm the current owner of educational content
   - **Purchase Details**: Access comprehensive purchase information
   - **Duplicate Prevention**: Ensure each transaction has only one NFT

3. **Administrative Functions**
   - **Contract Initialization**: Set up the contract with administrative controls
   - **Access Control**: Restrict sensitive operations to authorized users
   - **System Monitoring**: Track the total number of NFTs in the system

4. **Query Functions**
   - **NFT Information**: Retrieve detailed information about specific NFTs
   - **Transaction Lookup**: Find NFTs associated with specific transactions
   - **Existence Checks**: Verify if a transaction already has an associated NFT
   - **System Statistics**: Get information about the overall NFT system

## Contract Structure

```
educational-purchase-nft-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and data structures
│   ├── minting.rs              # NFT minting functionality
│   ├── distribution.rs         # NFT distribution and transfer logic
│   ├── metadata.rs             # Metadata management functions
│   ├── validation.rs           # Input validation and verification
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

The contract emits the following events:

1. `nft_minted` - When a new NFT is minted
   - Data: token_id, owner, transaction_id

2. `nft_transferred` - When an NFT is transferred to a new owner
   - Data: token_id, from_address, to_address

3. `metadata_updated` - When NFT metadata is updated
   - Data: token_id, updated_fields

## Data Structures

### PurchaseMetadata

Stores detailed information about the educational purchase:

- `purchase_id`: Unique purchase identifier
- `timestamp`: Transaction timestamp
- `amount`: Transaction amount
- `currency`: Currency used for transaction
- `product_id`: ID of the purchased product
- `product_name`: Name of the purchased product
- `additional_attributes`: Additional flexible metadata as key-value pairs

### NFTMetadata

Stores the complete metadata for the NFT:

- `name`: Name of the NFT
- `description`: Description of the NFT
- `purchase_data`: Embedded PurchaseMetadata
- `attributes`: Additional attributes as strings

### NFTDetail

Stores the complete NFT information:

- `owner`: Current owner (buyer) address
- `seller`: Seller address
- `metadata`: NFT metadata
- `transaction_id`: Reference to the actual blockchain transaction

## Functions

### Administrative Functions

#### `initialize(env: Env, admin: Address)`

- Initializes the contract with an admin address
- Parameters:
  - `admin`: The address that will have administrative privileges
- Sets up initial storage for admin, counter, and transaction mapping
- Requires authentication from the admin address
- Can only be called once

#### `check_admin(env: &Env, caller: &Address)`

- Internal function to verify admin privileges
- Parameters:
  - `caller`: The address to check for admin privileges
- Panics if the caller is not the admin

### NFT Query Functions

#### `get_nft_info(env: Env, token_id: u32) -> NFTDetail`

- Retrieves detailed information about a specific NFT
- Parameters:
  - `token_id`: The unique identifier of the NFT
- Returns the complete NFT details including owner, seller, and metadata
- Panics if the NFT does not exist

#### `has_transaction_nft(env: Env, transaction_id: BytesN<32>) -> bool`

- Checks if a transaction already has an associated NFT
- Parameters:
  - `transaction_id`: The blockchain transaction identifier
- Returns true if an NFT exists for the transaction, false otherwise

#### `get_nft_by_transaction(env: Env, transaction_id: BytesN<32>) -> Option<u32>`

- Retrieves the NFT token ID associated with a transaction
- Parameters:
  - `transaction_id`: The blockchain transaction identifier
- Returns the token ID if found, None otherwise

#### `get_total_nfts(env: Env) -> u32`

- Gets the total number of NFTs minted by the contract
- Returns the current NFT count

### NFT Minting Functions (in minting.rs)

#### `mint_nft(env: Env, to: Address, seller: Address, metadata: NFTMetadata, transaction_id: BytesN<32>) -> u32`

- Mints a new NFT representing an educational purchase
- Parameters:
  - `to`: The address of the purchaser/recipient
  - `seller`: The address of the content seller
  - `metadata`: The NFT metadata including purchase details
  - `transaction_id`: The blockchain transaction identifier
- Returns the newly minted token ID
- Requires authentication from the admin
- Emits `nft_minted` event

### NFT Distribution Functions (in distribution.rs)

#### `transfer_nft(env: Env, token_id: u32, from: Address, to: Address) -> bool`

- Transfers an NFT from one owner to another
- Parameters:
  - `token_id`: The unique identifier of the NFT
  - `from`: The current owner's address
  - `to`: The new owner's address
- Returns true if the transfer was successful
- Requires authentication from the current owner
- Emits `nft_transferred` event

### Metadata Management Functions (in metadata.rs)

#### `update_metadata(env: Env, token_id: u32, updated_fields: Map<String, String>) -> bool`

- Updates specific fields in the NFT metadata
- Parameters:
  - `token_id`: The unique identifier of the NFT
  - `updated_fields`: Map of field names to new values
- Returns true if the update was successful
- Requires authentication from the admin
- Emits `metadata_updated` event

## Technical Details and Implementation Notes

1. **Storage Model**
   - Uses persistent storage for NFT data
   - Uses instance storage for contract configuration
   - Implements mapping from transaction IDs to token IDs
   - Uses counter for sequential token ID assignment

2. **Authentication**
   - Implements admin authentication for sensitive operations
   - Uses `require_auth` for ownership verification
   - Restricts minting operations to authorized addresses

3. **Transaction Linking**
   - Uses 32-byte transaction identifiers (BytesN<32>)
   - Maintains a mapping between transactions and NFTs
   - Prevents duplicate NFTs for the same transaction

4. **Metadata Management**
   - Stores comprehensive purchase details
   - Supports flexible additional attributes
   - Includes both structured and unstructured data

5. **Error Handling**
   - Implements panic-based error handling
   - Provides descriptive error messages
   - Validates inputs before operations

## Role in Akkuea

The Educational Purchase NFT Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Purchase Verification**: Provides immutable proof of educational content purchases, enhancing trust in the marketplace.

2. **Ownership Records**: Creates permanent records of educational content ownership, allowing users to build a verifiable portfolio of their educational investments.

3. **Value Addition**: Transforms simple transactions into collectible digital assets that may have additional utility within the ecosystem.

4. **Educational Journey**: Allows users to showcase their educational journey through collectible NFTs representing their learning path.

5. **Integration Potential**: Enables integration with other parts of the Akkuea ecosystem, such as unlocking additional content or providing proof of learning.

This contract aligns with Akkuea's mission of making education accessible and valuable by providing users with tangible digital assets representing their educational investments. It enhances the platform's transparency and trust while creating new opportunities for recognizing and rewarding educational achievements.
