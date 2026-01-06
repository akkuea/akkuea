# Akkuea Funding Contract Documentation

## Overview

The Akkuea Funding Contract is a Soroban smart contract built for the Stellar blockchain that implements a crowdfunding platform for projects. The contract allows creators to register projects with milestones, enables users to vote for projects, and facilitates the release of funds when milestones are completed.

## Implemented Features

### Project Management

- **Project Registration**: Creators can register new projects with details including title, description, funding target, and milestones.
- **Project Data Storage**: Projects are stored on-chain with a unique ID, creator address, title, description, total funding target, milestone list, vote count, funded amount, and approval status.
- **Project Retrieval**: Functions to retrieve project information and milestone details.

### Milestone System

- **Milestone Definition**: Projects can define multiple milestones, each with an ID, description, completion status, and associated funding amount.
- **Milestone Completion**: Project creators can mark milestones as completed when work is done.
- **Milestone Validation**: Functions to validate milestone existence before operations.

### Voting Mechanism

- **Project Voting**: Users can vote for projects they want to support.
- **Vote Tracking**: The contract tracks votes per project and maintains a list of voters.
- **Duplicate Vote Prevention**: Users cannot vote for the same project multiple times.
- **Automatic Approval**: Projects are automatically approved when they reach a predefined vote threshold (10 votes).

### Fund Management

- **Fund Release**: Project creators can release funds for completed milestones.
- **Token Transfer**: Integration with Soroban token interface to transfer funds from a treasury to the project creator.
- **Fund Tracking**: The contract tracks how much has been funded for each project.

### Validation

- **Project Existence Validation**: Functions to validate project existence before operations.
- **Milestone Existence Validation**: Functions to validate milestone existence before operations.
- **Authorization Checks**: All sensitive operations require proper authorization from the relevant address.

### Testing

- **Unit Tests**: Comprehensive unit tests for core functionality including project registration, voting, and duplicate vote prevention.
- **Integration Tests**: Tests that verify the entire workflow from project creation to funding.

## Contract Functions

### Project Management

- `register_project(env, id, creator, title, description, total_funds, milestones)`: Registers a new project with the specified details.
- `get_project_info(env, id)`: Returns public metadata about a project (title, description, total funds, votes, approval status, funded amount).
- `get_milestones(env, id)`: Returns the list of milestones for a project.

### Voting System

- `vote_for_projects(env, project_id, voter)`: Records a vote for a project from the specified voter.
- `get_vote(env, project_id)`: Returns the number of votes for a project.
- `get_voter(env, project_id)`: Returns the list of addresses that have voted for a project.

### Milestone Management

- `complete_milestone(env, project_id, milestone_id, caller)`: Marks a milestone as completed.
- `release_funds(env, project_id, caller, token_address, treasury_address)`: Releases funds for completed milestones.

## Additional Functions Needed

1. **Project Updates**: Allow creators to update project details or milestone information before funding begins.

2. **Refund Mechanism**: Implement a refund system if projects fail to meet voting thresholds within a specified timeframe.

3. **Deadline Management**: Add time-based constraints for project funding periods and milestone completion.

4. **Partial Funding**: Allow projects to proceed with partial funding if they reach a minimum threshold but not their full goal.

5. **Dispute Resolution**: Implement a mechanism for resolving disputes between funders and creators.

6. **Funder Withdrawal**: Allow funders to withdraw support before a project is approved.

7. **Project Categories**: Add support for categorizing projects to improve discoverability.

8. **Multiple Currency Support**: Extend the contract to handle different token types for funding.

9. **Governance Voting**: Implement voting for governance decisions beyond just project approval.

10. **Milestone Verification**: Add a verification step where multiple parties must confirm milestone completion.

11. **Fee Structure**: Implement a fee mechanism to sustain the platform.

12. **Staking Mechanism**: Require creators to stake tokens as a commitment to project completion.

13. **Event Emissions**: Add event emissions for important actions to improve off-chain tracking.

14. **Batch Operations**: Support for batch operations like voting for multiple projects at once.

15. **Project Cancellation**: Allow creators to cancel projects before they're fully funded.
