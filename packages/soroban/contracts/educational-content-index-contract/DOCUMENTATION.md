# Content Search Contract Documentation

## Overview

The Content Search Contract is a specialized smart contract designed to index, store, and search educational content within the Akkuea ecosystem. It provides a decentralized search infrastructure that enables users to discover relevant educational resources based on subject tags. The contract implements a simple yet effective tagging system that allows content to be categorized and retrieved efficiently.

This contract serves as a critical discovery layer in the Akkuea platform, connecting learners with educational content that matches their interests and needs. By maintaining a searchable index of content metadata, it enhances content discoverability while keeping the actual educational resources distributed across the ecosystem.

The contract includes validation mechanisms to ensure that all indexed content meets minimum quality standards, such as having appropriate titles, descriptions, and valid subject tags. It also implements error handling to provide meaningful feedback when operations fail.

## General Features

- Content indexing with metadata storage
- Subject-based search functionality
- Content validation for quality assurance
- Persistent storage with TTL management
- Unique content identification

## Functionalities

1. **Content Indexing**

   - Add new educational content to the search index
   - Store comprehensive metadata about each content item
   - Assign unique identifiers to each content entry
   - Validate content metadata for completeness and quality

2. **Subject-Based Search**

   - Search for content by specific subject tags
   - Return all content matching search criteria
   - Handle cases where no matching content is found
   - Validate search queries for proper formatting

3. **Contract Management**
   - Initialize contract storage and state
   - Maintain content indices with appropriate TTL
   - Prevent duplicate initialization
   - Track content IDs with auto-incrementing counters

## Contract Structure

```
educational-content-index-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and implementation
│   ├── metadata.rs             # Content data structures and storage management
│   ├── search.rs               # Search implementation logic
│   ├── validate.rs             # Input and content validation functions
│   ├── error.rs                # Error definitions and handling
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Project documentation
├── TEST_DOCUMENTATION.md       # Test documentation
├── IMPROVEMENTS_SUGGESTIONS.md # Improvement suggestions
└── Makefile                    # Build automation
```

## Events

While the contract doesn't explicitly emit events in the examined code, it would be beneficial to implement events for the following actions:

1. `content_added` - When new content is successfully added to the index

   - Data: content_id, title, subject_tags

2. `content_updated` - When existing content is updated

   - Data: content_id, title, subject_tags

3. `search_performed` - When a search is executed
   - Data: subject, result_count

## Functions

### Contract Management

#### `initialize(env: Env)`

- Initializes the contract's storage and state
- Creates empty content list and sets initial ID counter
- Prevents re-initialization
- Sets appropriate TTL for storage entries

### Content Management

#### `add_content(env: Env, title: String, description: String, subject_tags: Vec<String>, content_url: String) -> Result<u64, Error>`

- Adds new educational content to the search index
- Parameters:
  - `title`: Title of the educational content
  - `description`: Detailed description of the content
  - `subject_tags`: List of subject tags for categorization
  - `content_url`: URL or reference to the actual content
- Validates all input parameters
- Assigns a unique ID to the content
- Returns the assigned content ID or an error

### Search Functionality

#### `search_content(env: Env, subject: String) -> Result<Vec<Content>, Error>`

- Searches for content matching a specific subject tag
- Parameters:
  - `subject`: The subject tag to search for
- Validates the search query
- Returns a list of matching content or an error if none found

### Internal Functions

#### `ContentStorage::set_content(env: &Env, content: &Content)`

- Stores content metadata in contract storage
- Updates existing content or adds new content
- Extends storage TTL appropriately

#### `ContentStorage::get_all_content(env: &Env) -> Vec<Content>`

- Retrieves all indexed content from storage
- Returns an empty list if no content exists

#### `search_content(env: &Env, subject: SorobanString) -> Result<Vec<Content>, Error>`

- Internal implementation of content search
- Iterates through all content to find matches
- Returns error if no matches found

#### `validate_content(content: &Content) -> Result<(), Error>`

- Validates content metadata for completeness and quality
- Checks title, description, URL, and tags
- Returns error for invalid content

#### `validate_subject(subject: &String) -> bool`

- Validates search query format
- Ensures non-empty and reasonable length

## Technical Details and Implementation Notes

1. **Data Model**

   - `Content`: Stores metadata about educational content
   - `ContentList`: Container for multiple content items
   - Simple key-value storage model for content indexing

2. **Storage**

   - Uses instance storage for content data
   - Implements TTL extension (50 ledgers, 100 entries)
   - Auto-incrementing ID system for content identification

3. **Validation**

   - Input validation for all user-provided data
   - Length constraints for text fields
   - Non-empty validation for required fields
   - Tag validation for proper formatting

4. **Error Handling**

   - Structured error types with descriptive messages
   - Specific error codes for different failure scenarios
   - Custom error conversion for client-friendly messages

5. **Search Algorithm**

   - Simple tag-based exact matching
   - Linear search through all content items
   - No partial matching or relevance ranking (potential improvement area)

6. **Performance Considerations**
   - Linear search complexity (O(n)) may become inefficient with large content volumes
   - No pagination implemented for search results
   - Simple storage model without advanced indexing

## Role in Akkuea

The Content Search Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Content Discovery**: Provides a decentralized mechanism for discovering educational resources across the platform.

2. **Knowledge Organization**: Helps categorize and organize educational content through a subject tagging system.

3. **Educational Access**: Improves access to education by making relevant content more discoverable to learners.

4. **Platform Integration**: Serves as a foundational layer that other contracts can integrate with to enable content discovery.

5. **Quality Control**: Enforces basic quality standards for educational content through metadata validation.

This contract aligns with Akkuea's mission of making education accessible by providing a decentralized search infrastructure that connects learners with relevant educational resources. It supports the platform's goal of organizing and categorizing educational content in a way that makes it easily discoverable by users seeking specific subjects or topics.
