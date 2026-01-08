# Learning Management Integration Contract

A Soroban smart contract that integrates educational NFTs with learning management systems on the Stellar network.

## Overview

This contract implements issue [#345](https://github.com/akkuea/akkuea/issues/345) by providing a comprehensive system for:
- Tracking learning progress through NFTs
- Automatic NFT issuance upon course completion
- Prerequisite verification through NFT ownership
- Integration with the milestone-finance-contract

## Features

### Core Functionality
- **Learning Progress Tracking**: Link NFTs to course progress with completion percentages
- **Automatic NFT Issuance**: Issue NFTs automatically when users complete courses
- **Prerequisite Verification**: Verify course prerequisites through NFT ownership
- **Platform Authorization**: Restrict issuance to authorized learning platforms

### Integration Features
- **Milestone Finance Integration**: Link learning progress with project milestones
- **Event Emission**: Comprehensive event logging for all major operations
- **Storage Optimization**: Efficient storage design for large-scale tracking

## Architecture

### Data Structures

#### LearningProgress
```rust
pub struct LearningProgress {
    pub token_id: u64,              // Unique NFT token ID
    pub user: Address,              // Learner's address
    pub course_id: u64,             // Course identifier
    pub completion_status: u32,     // Completion percentage (0-100)
    pub prerequisites: Vec<u64>,    // Required prerequisite course IDs
    pub created_at: u64,            // Creation timestamp
    pub updated_at: u64,            // Last update timestamp
    pub nft_issued: bool,           // NFT issuance status
}
```

#### MilestoneInfo
```rust
pub struct MilestoneInfo {
    pub project_id: Option<u64>,
    pub milestone_id: Option<u64>,
    pub linked: bool,
    pub milestone_completed: bool,
}
```

### Contract Functions

#### Initialization
- `initialize(admin: Address)`: Initialize the contract with an admin

#### Platform Management
- `add_platform(admin: Address, platform: Address)`: Add authorized platform
- `remove_platform(admin: Address, platform: Address)`: Remove platform
- `is_platform(platform: Address) -> bool`: Check platform authorization

#### Learning Progress Management
- `initialize_progress(platform: Address, user: Address, course_id: u64, prerequisites: Vec<u64>) -> u64`: Create learning progress
- `update_progress(platform: Address, token_id: u64, completion_status: u32)`: Update completion status
- `get_progress(token_id: u64) -> LearningProgress`: Get progress details
- `get_user_course_progress(user: Address, course_id: u64) -> LearningProgress`: Get user's course progress

#### NFT Management
- `issue_course_nft(platform: Address, token_id: u64)`: Issue NFT upon completion
- `get_user_nfts(user: Address) -> Vec<u64>`: Get all user NFTs
- `get_course_nfts(course_id: u64) -> Vec<u64>`: Get all course NFTs

#### Prerequisite Management
- `verify_prerequisites(user: Address, course_id: u64) -> bool`: Verify user meets prerequisites
- `set_course_prerequisites(platform: Address, course_id: u64, prerequisites: Vec<u64>)`: Set course prerequisites

#### Milestone Integration
- `link_progress_with_milestone(platform: Address, token_id: u64, project_id: u64, milestone_id: u64)`: Link with milestone
- `notify_milestone_completion(platform: Address, token_id: u64, milestone_id: u64)`: Notify milestone completion
- `get_milestone_info(token_id: u64) -> MilestoneInfo`: Get milestone information

## Events

The contract emits the following events:

- **CourseNFTIssuedEvent**: Emitted when an NFT is issued
- **PrerequisiteVerifiedEvent**: Emitted during prerequisite verification
- **ProgressUpdatedEvent**: Emitted when progress is updated
- **PlatformAddedEvent**: Emitted when a platform is added
- **PlatformRemovedEvent**: Emitted when a platform is removed

## Security Features

1. **Authorization Checks**: All state-changing operations require proper authorization
2. **Admin Controls**: Platform management restricted to admin
3. **Platform Restrictions**: Only authorized platforms can issue NFTs and update progress
4. **Prerequisite Enforcement**: NFTs only issued when prerequisites are met
5. **Completion Validation**: NFTs only issued for 100% completed courses

## Best Practices Implemented

### Stellar Soroban Standards
- ✅ Proper error handling with `contracterror` enum
- ✅ Event emission for all major state changes
- ✅ Efficient storage patterns using persistent and instance storage
- ✅ Type-safe data structures with `contracttype`
- ✅ Authorization using `require_auth()`

### Storage Optimization
- Uses indexed storage keys for O(1) lookups
- Separates user data from course data
- Implements efficient tracking lists
- Optimized for large-scale deployments

### Code Quality
- Comprehensive test coverage
- Clear separation of concerns (modules)
- Detailed error types
- Extensive documentation

## Testing

The contract includes comprehensive tests covering:
- Initialization
- Platform management
- Progress tracking
- NFT issuance
- Prerequisite verification
- Milestone integration
- Authorization checks

Run tests with:
```bash
cargo test --lib
```

## Building

Build the contract:
```bash
cargo build --target wasm32-unknown-unknown --release
```

or

```bash
stellar contract build
```

## Deployment

1. Build the contract
2. Deploy to Stellar testnet/mainnet
3. Initialize with admin address
4. Add authorized learning platforms
5. Set course prerequisites as needed

## Integration Guide

### For Learning Platforms

1. **Get Authorized**: Contact admin to be added as authorized platform
2. **Initialize Progress**: Create progress entry when user enrolls
   ```rust
   initialize_progress(platform, user, course_id, prerequisites)
   ```
3. **Update Progress**: Update as user progresses
   ```rust
   update_progress(platform, token_id, completion_percentage)
   ```
4. **Issue NFT**: Issue when course is 100% complete
   ```rust
   issue_course_nft(platform, token_id)
   ```

### With Milestone Finance Contract

1. **Link Progress**: Connect learning progress with project milestone
   ```rust
   link_progress_with_milestone(platform, token_id, project_id, milestone_id)
   ```
2. **Notify Completion**: Notify when milestone is reached
   ```rust
   notify_milestone_completion(platform, token_id, milestone_id)
   ```

## Module Structure

```
src/
├── lib.rs          # Main contract implementation
├── error.rs        # Error definitions
├── events.rs       # Event definitions
├── storage.rs      # Storage layer and data structures
├── lms.rs          # Core LMS logic
├── integration.rs  # Milestone finance integration
└── test.rs         # Comprehensive test suite
```

## License

This contract is part of the _akkuea_ project.

## Contributing

Follow the existing code patterns and ensure all tests pass before submitting changes.
