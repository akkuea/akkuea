# Tokenized Educational Content Contract

A Soroban smart contract for publishing, verifying, and upvoting educational content on the Stellar blockchain.

## Overview

This smart contract enables a decentralized platform for educational content where users can:

- Publish educational content with metadata
- Upvote valuable content
- Verify content accuracy and quality
- Track content popularity

The contract is built on Soroban, Stellar's smart contract platform, utilizing Rust for type safety and performance.

## Features

### Content Publishing

Content creators can publish educational materials with:

- Title
- Content hash (reference to the actual content stored elsewhere)
- Subject tags (categories/topics)
- Creation timestamp (automatically recorded)

### Content Verification

The verification system allows:

- Marking content as verified
- Maintaining verification status alongside upvotes
- Enabling creators to self-verify their content
- Building trust in the educational ecosystem

### Upvoting System

The upvoting mechanism includes:

- Protection against duplicate votes
- Tracking content popularity
- Facilitating content discovery based on community endorsement

## Contract Structure

The contract is organized into modular components:

- `lib.rs`: Contract interface and entry points
- `storage.rs`: Data structures and storage management
- `publish.rs`: Content publishing functionality
- `vote.rs`: Upvoting logic and duplicate vote protection
- `verify.rs`: Content verification mechanism
- `tests.rs`: Comprehensive test suite

## Technical Implementation

### Data Structures

The primary data structure is the `Content` struct:

```rust
pub struct Content {
    pub id: u64,                // Unique identifier
    pub creator: Address,       // Content creator
    pub title: String,          // Content title
    pub content_hash: BytesN<32>, // Hash reference to content
    pub creation_date: u64,     // Timestamp
    pub subject_tags: Vec<String>, // Categories
    pub upvotes: u32,           // Vote counter
    pub is_verified: bool,      // Verification status
}
```

### Public Interface

The contract exposes four main functions:

```rust
// Publish new educational content
pub fn publish_content(env: Env, creator: Address, title: String,
                       content_hash: BytesN<32>, subject_tags: Vec<String>) -> u64

// Upvote content (with duplicate protection)
pub fn upvote_content(env: Env, content_id: u64, voter: Address) -> u32

// Verify content
pub fn verify_content(env: Env, content_id: u64, verifier: Address) -> bool

// Retrieve content data
pub fn get_content(env: Env, content_id: u64) -> Content
```

### Events

The contract emits events for tracking activities:

- `PUBLISH`: When new content is published
- `UPVOTE`: When content receives an upvote
- `VERIFY`: When content is verified

## Building and Testing

### Prerequisites

- Rust and Cargo
- Soroban CLI (v22.0.0 or later)

### Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

### Running Tests

```bash
cargo test
```

The contract includes 15 comprehensive tests that verify all aspects of functionality, including:

- Content publishing
- Upvoting mechanics
- Verification process
- Complex workflows

---
