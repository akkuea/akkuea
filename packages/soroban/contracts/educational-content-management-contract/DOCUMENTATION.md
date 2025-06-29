# Educational Content Management Contract Documentation

## Overview

The Educational Content Management Contract is a Soroban-based smart contract built for the Stellar blockchain that enables a decentralized platform for educational content within the Akkuea ecosystem. This contract allows users to publish educational materials, upvote valuable content, verify content accuracy and quality, and track content popularity through a transparent and immutable system.

The contract serves as a foundation for Akkuea's educational marketplace, ensuring that educational content is properly attributed, verified, and valued by the community. By maintaining a transparent record of content creation, verification, and popularity, the contract facilitates trust between content creators and learners while incentivizing high-quality educational contributions.

## General Features

- **Content Publishing**: Create and manage educational content with comprehensive metadata
- **Content Verification**: Verify the accuracy and quality of educational materials
- **Upvoting System**: Track and reward valuable educational content
- **Content Discovery**: Facilitate finding quality content based on community endorsement
- **Transparent Attribution**: Ensure proper credit for educational content creators
- **Event Emission**: Track all significant content-related activities

## Functionalities

1. **Content Publishing**
   - **Content Creation**: Publish educational materials with metadata
   - **Content Attribution**: Link content to creator addresses
   - **Content Categorization**: Tag content with subject categories
   - **Content Referencing**: Store content hashes for verification
   - **Timestamp Recording**: Track content creation time

2. **Content Verification**
   - **Verification Status**: Mark content as verified for quality assurance
   - **Verification Tracking**: Maintain verification status alongside other metrics
   - **Self-Verification**: Enable creators to verify their own content
   - **Trust Building**: Enhance credibility of educational materials

3. **Upvoting System**
   - **Vote Tracking**: Count upvotes for educational content
   - **Duplicate Protection**: Prevent users from voting multiple times
   - **Popularity Metrics**: Track content popularity for discovery
   - **Community Endorsement**: Enable community-driven content evaluation

4. **Content Retrieval**
   - **Content Access**: Retrieve educational content by ID
   - **Metadata Retrieval**: Access comprehensive content metadata
   - **Popularity Queries**: Find content based on upvote counts
   - **Category Filtering**: Discover content by subject tags

5. **Advanced Content Filtering**
   - **Verification Filtering**: Retrieve only verified, trusted content
   - **Popularity Filtering**: Find content with minimum upvote thresholds
   - **Quality Discovery**: Enable users to discover high-quality content efficiently
   - **Trust-based Search**: Support frontend features for advanced content discovery

## Contract Structure

```
educational-content-management-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and implementation
│   ├── storage.rs              # Data structures and storage management
│   ├── publish.rs              # Content publishing functionality
│   ├── vote.rs                 # Upvoting logic and duplicate vote protection
│   ├── verify.rs               # Content verification mechanism
│   └── tests.rs                # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

The contract emits the following events:

1. `PUBLISH` - When new educational content is published
   - Data: content_id, creator, title, creation_timestamp

2. `UPVOTE` - When content receives an upvote
   - Data: content_id, voter, new_upvote_count

3. `VERIFY` - When content is verified
   - Data: content_id, verifier, verification_timestamp

## Data Structures

### Content
Stores comprehensive information about educational content:
- `id`: Unique identifier for the content
- `creator`: Address of the content creator
- `title`: Title of the educational content
- `content_hash`: Hash reference to the actual content (stored elsewhere)
- `creation_date`: Timestamp when the content was created
- `subject_tags`: Categories/topics for the content
- `upvotes`: Counter for community endorsements
- `is_verified`: Verification status of the content

## Functions

### Content Publishing

#### `publish_content(env: Env, creator: Address, title: String, content_hash: BytesN<32>, subject_tags: Vec<String>) -> u64`
- Publishes new educational content with metadata
- Parameters:
  - `creator`: The address of the content creator
  - `title`: The title of the educational content
  - `content_hash`: Hash reference to the actual content
  - `subject_tags`: Categories/topics for the content
- Returns the unique content ID
- Requires authentication from the creator
- Emits `PUBLISH` event

### Content Upvoting

#### `upvote_content(env: Env, content_id: u64, voter: Address) -> u32`
- Upvotes educational content
- Parameters:
  - `content_id`: The unique identifier of the content
  - `voter`: The address of the user upvoting the content
- Returns the new upvote count
- Prevents duplicate votes from the same user
- Requires authentication from the voter
- Emits `UPVOTE` event

### Content Verification

#### `verify_content(env: Env, content_id: u64, verifier: Address) -> bool`
- Verifies the accuracy and quality of educational content
- Parameters:
  - `content_id`: The unique identifier of the content
  - `verifier`: The address of the verifier
- Returns true if verification was successful
- Requires authentication from the verifier
- Emits `VERIFY` event

### Content Retrieval

#### `get_content(env: Env, content_id: u64) -> Content`
- Retrieves detailed information about educational content
- Parameters:
  - `content_id`: The unique identifier of the content
- Returns the complete content data structure
- Panics if the content does not exist

### Advanced Content Filtering

#### `filter_by_verification(env: Env) -> Vec<Content>`
- Filters and retrieves only verified educational content
- Parameters: None
- Returns a vector of all content items where `is_verified == true`
- This is a view-only function that does not modify contract state
- Returns an empty vector if no verified content exists
- Useful for discovering trusted, quality-assured educational materials

**Usage Example:**
```rust
// Get all verified content
let verified_content = client.filter_by_verification();

// Process verified content
for i in 0..verified_content.len() {
    let content = verified_content.get(i).unwrap();
    // Use verified content...
}
```

#### `filter_by_min_upvotes(env: Env, min_upvotes: u32) -> Vec<Content>`
- Filters and retrieves content with upvotes greater than or equal to the minimum threshold
- Parameters:
  - `min_upvotes`: The minimum number of upvotes required (inclusive)
- Returns a vector of all content items where `upvotes >= min_upvotes`
- This is a view-only function that does not modify contract state
- Returns an empty vector if no content meets the upvote threshold
- Useful for discovering popular, community-endorsed educational content

**Usage Examples:**
```rust
// Get content with at least 10 upvotes (popular content)
let popular_content = client.filter_by_min_upvotes(&10);

// Get content with at least 5 upvotes (moderately popular)
let moderately_popular = client.filter_by_min_upvotes(&5);

// Get all content (including those with 0 upvotes)
let all_content = client.filter_by_min_upvotes(&0);

// Process popular content
for i in 0..popular_content.len() {
    let content = popular_content.get(i).unwrap();
    // Use popular content...
}
```

**Combining Filters:**
While the contract provides individual filter functions, clients can combine their results to find content that meets multiple criteria:

```rust
// Get verified content
let verified_content = client.filter_by_verification();

// Get popular content (10+ upvotes)
let popular_content = client.filter_by_min_upvotes(&10);

// Find content that is both verified AND popular
// (This would be done client-side by finding intersection of results)
```

## Technical Details and Implementation Notes

1. **Data Model**
   - Uses the `Content` struct for comprehensive content representation
   - Implements unique identifiers for content tracking
   - Stores content metadata on-chain while referencing actual content off-chain
   - Uses vector storage for subject tags to support multiple categories

2. **Storage**
   - Uses persistent storage for content data
   - Implements mapping from content IDs to content structures
   - Uses counter for sequential content ID assignment
   - Maintains vote tracking to prevent duplicate votes

3. **Authentication**
   - Implements authentication for content publishing
   - Uses `require_auth` for upvoting verification
   - Validates transaction signatures for sensitive operations

4. **Content Referencing**
   - Uses 32-byte content hashes (BytesN<32>) for content referencing
   - Supports integration with decentralized storage systems
   - Enables content verification through hash comparison

5. **Event System**
   - Emits events for all significant content operations
   - Uses standardized event topics for consistent tracking
   - Includes relevant data in event payloads

6. **Error Handling**
   - Implements comprehensive error handling
   - Provides descriptive error messages
   - Validates inputs before operations

## Role in Akkuea

The Tokenized Educational Content Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Content Attribution**: Ensures proper attribution and ownership of educational materials, protecting creators' intellectual property.

2. **Quality Assurance**: Provides mechanisms for verifying content quality and accuracy, enhancing trust in the educational marketplace.

3. **Community Engagement**: Enables community participation through upvoting, creating a collaborative educational environment.

4. **Content Discovery**: Facilitates finding valuable educational content through popularity metrics and categorization.

5. **Incentive Alignment**: Creates incentives for creating high-quality educational content through recognition and potential rewards.

This contract aligns with Akkuea's mission of making education accessible by ensuring that educational content is properly attributed, verified, and valued by the community. It supports the platform's goal of creating a trustworthy educational marketplace where quality contributions are recognized and rewarded.
