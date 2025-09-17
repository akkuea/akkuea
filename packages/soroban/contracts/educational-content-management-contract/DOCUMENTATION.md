# Educational Content Management Contract Documentation

## Overview

The Educational Content Management Contract is a Soroban-based smart contract built for the Stellar blockchain that enables a decentralized platform for educational content within the Akkuea ecosystem. This contract allows users to publish educational materials, upvote valuable content, verify content accuracy and quality, create collaborative workflows, manage content versions, and track content popularity through a transparent and immutable system.

The contract serves as a foundation for Akkuea's educational marketplace, ensuring that educational content is properly attributed, verified, and valued by the community. By maintaining a transparent record of content creation, verification, popularity, versioning, and collaborative contributions, the contract facilitates trust between content creators and learners while incentivizing high-quality educational contributions.

## General Features

- **Content Publishing**: Create and manage educational content with comprehensive metadata
- **Content Verification**: Multi-tier verification system (Peer, Expert, Institutional)
- **Upvoting System**: Track and reward valuable educational content
- **Content Versioning**: Create and manage multiple versions of content with change tracking
- **Collaborative Workflows**: Enable collaborative content creation with review processes
- **Content Discovery**: Facilitate finding quality content based on community endorsement and verification
- **Transparent Attribution**: Ensure proper credit for educational content creators
- **Event Emission**: Track all significant content-related activities

## Functionalities

### 1. Content Publishing

- **Content Creation**: Publish educational materials with metadata
- **Content Attribution**: Link content to creator addresses
- **Content Categorization**: Tag content with subject categories
- **Content Referencing**: Store content hashes for verification
- **Timestamp Recording**: Track content creation time

### 2. Multi-Tier Content Verification

- **Verification Levels**: Four-tier verification system (None, Peer, Expert, Institutional)
- **Progressive Verification**: Cannot downgrade verification levels
- **Quality Assurance**: Mark content as verified for different trust levels
- **Trust Building**: Enhance credibility of educational materials
- **Version-Specific Verification**: Each version can have its own verification level

### 3. Upvoting System

- **Vote Tracking**: Count upvotes for educational content
- **Version-Specific Voting**: Vote on specific versions of content
- **Duplicate Protection**: Prevent users from voting multiple times
- **Popularity Metrics**: Track content popularity for discovery
- **Community Endorsement**: Enable community-driven content evaluation

### 4. Content Versioning

- **Version Creation**: Create new versions of existing content
- **Version History**: Track all changes and versions of content
- **Change Documentation**: Record notes explaining version changes
- **Version Comparison**: Compare differences between versions
- **Version-Specific Metrics**: Each version has its own upvotes and verification level
- **Content Snapshots**: Preserve historical states of content

### 5. Collaborative Workflows

- **Permission Management**: Grant collaboration permissions to users
- **Submission Process**: Submit content changes for review
- **Review System**: Accept or reject collaborative submissions
- **Contribution History**: Track user contributions to specific content
- **Feedback System**: Provide feedback on submissions

### 6. Advanced Content Filtering

- **Verification Filtering**: Retrieve content by verification level
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
│   ├── versioning.rs           # Content versioning functionality
│   ├── collaborative.rs        # Collaborative workflows
│   └── tests.rs                # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

The contract emits the following events:

### Core Events

1. `PUBLISH` - When new educational content is published
   - Data: content_id, creator, title, creation_timestamp

2. `UPVOTE` - When content receives an upvote
   - Data: content_id, voter, new_upvote_count

3. `VERIFY` - When content is verified
   - Data: content_id, verifier, verification_level

### Versioning Events

4. `VERSION` - When a new version is created
   - Data: content_id, version_number, creator

5. `V_UPVOTE` - When a specific version receives an upvote
   - Data: content_id, version, voter, new_upvote_count

6. `V_VERIFY` - When a specific version is verified
   - Data: content_id, version, verifier, verification_level

## Data Structures

### Content

Stores comprehensive information about educational content:

- `id`: Unique identifier for the content
- `creator`: Address of the content creator
- `title`: Title of the educational content
- `content_hash`: Hash reference to the actual content
- `creation_date`: Timestamp when the content was created
- `subject_tags`: Categories/topics for the content
- `upvotes`: Counter for community endorsements
- `verification_level`: Current verification level (None, Peer, Expert, Institutional)

### VerificationLevel

Four-tier verification system:

- `None` (0): No verification
- `Peer` (1): Peer-reviewed content
- `Expert` (2): Expert-verified content
- `Institutional` (3): Institutionally verified content

### ContentVersion

Metadata for content versions:

- `version`: Version number
- `creator`: Address of the version creator
- `creation_date`: When the version was created
- `change_notes`: Description of changes made
- `upvotes`: Version-specific upvote count
- `verification_level`: Version-specific verification level

### VersionDiff

Comparison between two versions:

- `from_version`: Starting version number
- `to_version`: Target version number
- `title_changed`: Whether the title changed
- `content_changed`: Whether the content hash changed

### CollaboratorPermission

Permission structure for collaboration:

- `collaborator`: Address of the collaborator
- `content_id`: ID of the content
- `permission_type`: Type of permission (Collaborator)
- `granted_by`: Address who granted the permission
- `granted_date`: When permission was granted

### CollaboratorSubmission

Submission for collaborative review:

- `content_id`: ID of the content
- `collaborator`: Address of the submitter
- `submission_date`: When submitted
- `status`: Review status (Pending, Accepted, Rejected)
- `new_content_hash`: Proposed new content hash
- `new_subject_tags`: Proposed new subject tags
- `change_notes`: Description of changes
- `reviewer`: Address of reviewer (optional)
- `review_date`: When reviewed (optional)
- `review_feedback`: Reviewer feedback (optional)

## Functions

### Core Content Functions

#### `publish_content(env: Env, creator: Address, title: String, content_hash: BytesN<32>, subject_tags: Vec<String>) -> u64`

- Publishes new educational content with metadata
- Returns the unique content ID
- Requires authentication from the creator
- Emits `PUBLISH` event

#### `upvote_content(env: Env, content_id: u64, voter: Address) -> u32`

- Upvotes educational content
- Returns the new upvote count
- Prevents duplicate votes from the same user
- Requires authentication from the voter
- Emits `UPVOTE` event

#### `verify_content(env: Env, content_id: u64, verifier: Address, level: VerificationLevel) -> VerificationLevel`

- Verifies content at a specific verification level
- Cannot downgrade verification levels
- Returns the new verification level
- Requires authentication from the verifier
- Emits `VERIFY` event

#### `get_content(env: Env, content_id: u64) -> Content`

- Retrieves detailed information about educational content
- Returns the complete content data structure
- Panics if content does not exist

### Content Filtering Functions

#### `filter_by_verification(env: Env) -> Vec<Content>`

- Retrieves only verified content (verification_level > None)
- Returns vector of verified content items
- View-only function

#### `filter_by_verification_level(env: Env, level: VerificationLevel) -> Vec<Content>`

- Retrieves content with specific verification level
- Returns vector of content matching the exact verification level
- View-only function

#### `filter_by_min_upvotes(env: Env, min_upvotes: u32) -> Vec<Content>`

- Retrieves content with upvotes >= minimum threshold
- Returns vector of popular content
- View-only function

### Versioning Functions

#### `create_new_version_content(env: Env, content_id: u64, creator: Address, title: String, content_hash: BytesN<32>, subject_tags: Vec<String>, change_notes: String) -> u32`

- Creates a new version of existing content
- Only the original creator can create versions
- Returns the new version number
- Requires authentication from creator
- Emits `VERSION` event

#### `get_content_at_version(env: Env, content_id: u64, version: u32) -> Content`

- Retrieves content as it existed at a specific version
- Returns content snapshot for the specified version
- Panics if version doesn't exist

#### `get_version_info(env: Env, content_id: u64, version: u32) -> ContentVersion`

- Gets metadata for a specific content version
- Returns version-specific information
- Panics if version doesn't exist

#### `upvote_version(env: Env, content_id: u64, version: u32, voter: Address) -> u32`

- Upvotes a specific version of content
- Returns total upvotes for the version
- Prevents duplicate votes
- Requires authentication from voter
- Emits `V_UPVOTE` event

#### `verify_version(env: Env, content_id: u64, version: u32, verifier: Address, level: VerificationLevel) -> VerificationLevel`

- Verifies a specific version at given level
- Cannot downgrade verification
- Returns new verification level
- Requires authentication from verifier
- Emits `V_VERIFY` event

#### `get_version_diff(env: Env, content_id: u64, from_version: u32, to_version: u32) -> VersionDiff`

- Compares two versions and returns differences
- Shows what changed between versions
- View-only function

### Collaboration Functions

#### `grant_permission(env: Env, content_id: u64, owner: Address, collaborator: Address) -> bool`

- Grants collaboration permission to a user
- Only content creator can grant permissions
- Returns true if successful
- Requires authentication from owner

#### `submit_for_review(env: Env, content_id: u64, submitter: Address, new_content_hash: BytesN<32>, new_subject_tags: Vec<String>, change_notes: String) -> bool`

- Submits content update for review
- Requires collaboration permission
- Returns true if successful
- Requires authentication from submitter

#### `review_submission(env: Env, content_id: u64, submitter: Address, reviewer: Address, accept: bool, feedback: String) -> bool`

- Reviews and accepts/rejects submission
- Only content creator can review
- If accepted, creates new version automatically
- Saves contribution to history
- Returns true if successful
- Requires authentication from reviewer

#### `get_collaborative_permission(env: Env, user: Address, content_id: u64) -> CollaboratorPermission`

- Gets permission details for a user
- Returns permission structure
- Panics if permission doesn't exist

#### `get_collaborative_submission(env: Env, submitter: Address, content_id: u64) -> CollaboratorSubmission`

- Gets submission details
- Returns submission structure
- Panics if submission doesn't exist

#### `get_user_contribution_history(env: Env, user: Address, content_id: u64) -> Vec<CollaboratorSubmission>`

- Gets user's contribution history for specific content
- Returns vector of historical contributions
- Requires authentication from user

## Usage Examples

### Basic Content Management

```rust
// Publish content
let content_id = client.publish_content(&creator, &title, &content_hash, &tags);

// Upvote content
let upvotes = client.upvote_content(&content_id, &voter);

// Verify content
let verification_level = client.verify_content(&content_id, &verifier, &VerificationLevel::Expert);
```

### Versioning Workflow

```rust
// Create new version
let version = client.create_new_version_content(&content_id, &creator, &new_title, &new_hash, &new_tags, &"Updated content");

// Get version info
let version_info = client.get_version_info(&content_id, &version);

// Compare versions
let diff = client.get_version_diff(&content_id, &1, &2);

// Upvote specific version
let version_upvotes = client.upvote_version(&content_id, &version, &voter);
```

### Collaboration Workflow

```rust
// Grant permission
client.grant_permission(&content_id, &owner, &collaborator);

// Submit for review
client.submit_for_review(&content_id, &collaborator, &new_hash, &new_tags, &"My changes");

// Review submission
client.review_submission(&content_id, &collaborator, &owner, &true, &"Great work!");

// Check contribution history
let history = client.get_user_contribution_history(&collaborator, &content_id);
```

### Content Discovery

```rust
// Get verified content
let verified = client.filter_by_verification();

// Get expert-verified content
let expert_verified = client.filter_by_verification_level(&VerificationLevel::Expert);

// Get popular content
let popular = client.filter_by_min_upvotes(&10);
```

## Technical Details and Implementation Notes

### 1. Data Model

- Enhanced `Content` struct with `VerificationLevel` enum
- Separate storage for version snapshots and metadata
- Collaborative permission and submission tracking
- Comprehensive event emission for all operations

### 2. Storage Architecture

- **Main Content**: Current state of each content item
- **Version Snapshots**: Historical states preserved for each version
- **Version Metadata**: Change notes, upvotes, and verification per version
- **Collaboration Data**: Permissions and submission tracking
- **Vote Tracking**: Prevents duplicate votes on both content and versions

### 3. Security Model

- **Authentication**: All state-changing operations require proper authentication
- **Authorization**: Permission checks for collaborative operations
- **Creator Control**: Only creators can manage versions and review submissions
- **Vote Integrity**: Duplicate vote prevention across content and versions

### 4. Versioning System

- **Immutable History**: Previous versions are preserved as snapshots
- **Independent Metrics**: Each version has its own upvotes and verification
- **Change Tracking**: Comprehensive diff system for version comparison
- **Creator Control**: Only original creators can create new versions

### 5. Collaboration Framework

- **Permission-Based**: Explicit permission required for collaboration
- **Review Process**: All collaborative changes go through review
- **History Tracking**: Complete audit trail of contributions
- **Feedback System**: Structured feedback for all submissions

## Role in Akkuea

The Enhanced Educational Content Management Contract plays a vital role in Akkuea's educational ecosystem by:

### 1. Content Quality Assurance

- **Multi-tier Verification**: Supports different levels of content validation
- **Version Control**: Enables iterative improvement of educational materials
- **Community Review**: Facilitates peer review and expert validation

### 2. Collaborative Learning

- **Controlled Collaboration**: Enables safe collaborative content creation
- **Knowledge Evolution**: Supports continuous improvement of educational content
- **Community Contribution**: Recognizes and tracks community contributions

### 3. Trust and Transparency

- **Verification Levels**: Clear indication of content trustworthiness
- **Attribution Tracking**: Complete history of who contributed what and when
- **Immutable Records**: Permanent record of all content changes and reviews

### 4. Scalable Content Management

- **Version Management**: Efficient handling of content evolution
- **Discovery Systems**: Advanced filtering for finding quality content
- **Collaboration Workflows**: Structured processes for content improvement

This enhanced contract supports Akkuea's mission of creating a comprehensive, trustworthy, and collaborative educational platform where high-quality content is properly attributed, continuously improved, and fairly valued by the community.
