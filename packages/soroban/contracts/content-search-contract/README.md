# Educational Content Search Contract

A Soroban smart contract for searching and managing educational content based on subject tags.

## Features

- Educational content search by subject tags
- Robust input and content validation
- Efficient metadata storage
- Informative error handling

## Requirements

- Rust 1.70.0 or higher
- [Soroban CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli)
- Stellar Testnet account

## Installation

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Install Soroban CLI:
```bash
cargo install soroban-cli
```

3. Generate a test account:
```bash
soroban keys generate alice
```

## Building and Deployment

1. Build the contract:
```bash
cd packages/soroban/contracts/content-search-contract
soroban contract build
```

2. Deploy the contract:
```bash
soroban contract deploy --source-account alice --wasm ../../target/wasm32v1-none/release/content_search_contract.wasm
```

3. Initialize the contract:
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source-account alice \
  --network testnet \
  -- \
  initialize
```

4. To read the contract:
```bash
soroban contract read --id <CONTRACT_ID> --network testnet
```

## Contract Functions

### `search_content(subject: String) -> Vec<Content>`
Searches for educational content based on subject tags.
- `subject`: The tag or keyword to search for
- Returns: List of content matching the search

### `add_content(title: String, description: String, subject_tags: Vec<String>, content_url: String) -> u64`
Adds new educational content to the system.
- `title`: Content title (max 200 characters)
- `description`: Content description (max 1000 characters)
- `subject_tags`: List of subject tags (max 50 characters per tag)
- `content_url`: Content URL (max 500 characters)
- Returns: ID of the added content

## Usage Examples

### Adding Content
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source-account alice \
  --network testnet \
  -- \
  add_content \
  --title "Test Content" \
  --description "This is a test content" \
  --subject_tags '["math"]' \
  --content_url "https://example.com/test"
```

### Searching Content
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source-account alice \
  --network testnet \
  -- \
  search_content \
  --subject "math"
```

Output:
```json
[{
  "content_url": "https://example.com/test",
  "description": "This is a test content",
  "id": 1,
  "subject_tags": ["math"],
  "title": "Test Content"
}]
```

## Data Structure

```rust
struct Content {
    id: u64,
    title: String,
    description: String,
    subject_tags: Vec<String>,
    content_url: String,
}
```

## Error Handling

The contract handles the following errors:

- `NoMatchingContent`: No content found matching the search criteria
- `InvalidInput`: Provided input does not meet validation requirements
- `NotInitialized`: Contract has not been initialized

## Additional Documentation

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar CLI Guide](https://developers.stellar.org/docs/tools/cli/stellar-cli)
- [Stellar Smart Contracts](https://developers.stellar.org/docs/build/smart-contracts/overview)