# Milestone Finance Contract with Reputation System Integration

A Soroban smart contract that implements a reputation-based voting system for project funding decisions, tracking creator success rates and applying reputation-based voting power.

## 🎯 Objective

This contract integrates a comprehensive reputation system for project creators and voters, tracking success rates and applying reputation-based voting power for funding decisions. It builds upon existing reputation contracts in the ecosystem while providing specialized functionality for milestone-based project funding.

## 🏗 Contract Structure

```
milestone-finance/src/
├── lib.rs                // Contract configuration and exports
├── reputation.rs         // Reputation tracking and integration logic
├── utils.rs              // Shared utilities for reputation calculations
└── test.rs               // Comprehensive test suite
```

## 📦 Key Data Structures

### Reputation

```rust
struct Reputation {
    user: Address,         // Stellar address of the user
    score: u32,            // Reputation score (0-100)
    projects_completed: u32, // Number of successfully completed projects
    milestones_missed: u32,  // Number of missed milestones
    total_projects: u32,     // Total number of projects participated in
    last_updated: u64,       // Timestamp of last reputation update
}
```

### User

```rust
struct User {
    id: u64,
    address: Address,
    name: String,
    reputation: Reputation,
    created_at: u64,
}
```

### ProjectVote

```rust
struct ProjectVote {
    project_id: u64,
    total_voting_power: u32,
    voter_count: u32,
    is_approved: bool,
}
```

## 🔑 Key Functions

### Core Reputation Functions

#### `initialize_user(caller: Address, name: String) -> Result<u64, Error>`

- Initializes a new user in the reputation system
- Assigns initial neutral reputation score of 50
- Returns unique user ID

#### `update_reputation(caller: Address, user: Address, project_id: u64, success: bool) -> Result<(), Error>`

- Updates reputation based on project or milestone outcomes
- Success: +10 points, Failure: -5 points
- Emits reputation update events

#### `get_voting_power(user: Address) -> Result<u32, Error>`

- Calculates voting power based on reputation score
- Formula: `base_power + (reputation_score / 10)`
- Base power: 1, Maximum voting power: 20

#### `penalize_missed_milestone(caller: Address, user: Address, milestone_id: u64) -> Result<(), Error>`

- Applies reputation penalty for missed milestones
- Penalty: -15 points per missed milestone
- Emits reputation update events

### Voting Functions

#### `vote_for_project(voter: Address, project_id: u64) -> Result<u32, Error>`

- Vote for a project with reputation-based voting power
- Prevents duplicate votes
- Auto-approves projects when total voting power reaches 100
- Returns the voter's voting power

#### `get_project_voting_power(project_id: u64) -> Result<u32, Error>`

- Get total voting power for a specific project
- Sum of all individual voter powers

#### `get_project_voters(project_id: u64) -> Result<Map<Address, u32>, Error>`

- Get all voters for a project with their individual voting power
- Returns mapping of voter address to voting power

### Milestone Functions

#### `complete_milestone(caller: Address, project_id: u64, milestone_id: u64, creator: Address) -> Result<(), Error>`

- Complete a milestone and update creator reputation
- Automatically applies success bonus to creator
- Emits milestone completion events

### Analytics Functions

#### `get_reputation_stats() -> Result<ReputationStats, Error>`

- Get comprehensive reputation statistics for analytics
- Includes total users, average reputation, completion rates, etc.

## 🎯 Reputation System Features

### Reputation Scoring

- **Initial Score**: 50 (neutral)
- **Success Bonus**: +10 points per successful project/milestone
- **Failure Penalty**: -5 points per failed project
- **Milestone Penalty**: -15 points per missed milestone
- **Range**: 0-100 (capped)

### Voting Power Calculation

- **Formula**: `1 + (reputation_score / 10)`
- **Examples**:
  - Reputation 50 → Voting Power 6
  - Reputation 80 → Voting Power 9
  - Reputation 100 → Voting Power 11

### Project Approval

- **Threshold**: 100 total voting power
- **Auto-approval**: Projects are automatically approved when threshold is met
- **Voter Tracking**: All voters and their individual voting power are tracked

## 🔒 Security Features

### Overflow/Underflow Protection

- All arithmetic operations use `saturating_add` and `saturating_sub`
- Reputation scores are validated to stay within 0-100 range
- Voting power is capped at maximum of 20

### Authorization

- All state-changing operations require proper authorization
- Users can only update their own reputation through authorized calls
- Admin functions require caller authentication

### Duplicate Vote Prevention

- Users cannot vote multiple times for the same project
- Voting records are permanently stored to prevent manipulation

## 📊 Event System

The contract emits comprehensive events for tracking and analytics:

### Reputation Events

```rust
("rep_update", user_address) -> (old_score, new_score, reason)
```

### Voting Events

```rust
("vote_cast", voter_address) -> (project_id, voting_power)
```

### Milestone Events

```rust
("milestone_complete", creator_address) -> (project_id, milestone_id, success)
```

## 🧪 Testing

The contract includes comprehensive tests covering:

- User initialization and duplicate prevention
- Reputation updates (success/failure scenarios)
- Voting power calculations
- Milestone penalties
- Project voting and approval
- Multiple voter scenarios
- Reputation statistics
- Overflow/underflow protection
- Event emission verification

Run tests with:

```bash
cargo test
```

## 🚀 Integration with Existing Contracts

This contract is designed to integrate with existing contracts in the ecosystem:

- **Educational Contribution Reputation Contract**: Can leverage existing reputation data
- **Platform User Reputation Contract**: Compatible with basic reputation structures
- **Educational Project Funding Contract**: Enhances voting with reputation-based power

## 📈 Use Cases

### For Project Creators

1. **Build Reputation**: Complete projects successfully to increase reputation
2. **Higher Voting Power**: Higher reputation gives more influence in voting
3. **Track Performance**: Monitor completion rates and milestone adherence

### For Voters

1. **Weighted Voting**: Reputation determines voting influence
2. **Quality Decisions**: Higher reputation voters have more impact
3. **Track Participation**: Monitor voting history and impact

### For Platform Administrators

1. **Analytics**: Comprehensive reputation statistics
2. **Quality Control**: Penalize missed milestones
3. **Fair Funding**: Reputation-based voting ensures quality projects get funded

## 🔧 Configuration

### Reputation Parameters

- **Initial Score**: 50 (configurable)
- **Success Bonus**: 10 points (configurable)
- **Failure Penalty**: 5 points (configurable)
- **Milestone Penalty**: 15 points (configurable)
- **Max Score**: 100 (configurable)

### Voting Parameters

- **Base Voting Power**: 1 (configurable)
- **Reputation Multiplier**: 10 (configurable)
- **Max Voting Power**: 20 (configurable)
- **Approval Threshold**: 100 (configurable)

## 📝 License

This contract is part of the Akkuea educational platform ecosystem and follows the same licensing terms as other contracts in the project.

## 🤝 Contributing

When contributing to this contract:

1. Follow Soroban best practices
2. Add comprehensive tests for new features
3. Update documentation for any changes
4. Ensure all tests pass before submitting
5. Follow the existing code style and patterns
