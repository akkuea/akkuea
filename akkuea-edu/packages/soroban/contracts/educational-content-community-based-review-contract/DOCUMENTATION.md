# Community-Based Review Moderation Contract Documentation

## Overview

The Community-Based Review Moderation Contract provides a decentralized mechanism for moderating user-submitted reviews of educational content within the Akkuea ecosystem. It empowers the community to flag and vote on inappropriate or low-quality reviews, ensuring that the feedback on educational materials remains constructive and trustworthy.

This contract acts as a crucial quality control layer for user-generated content. By integrating with a user reputation system, it weights votes based on a user's standing in the community, giving more influence to trusted members. This creates a robust, self-regulating system that maintains the integrity of the platform's review and rating features.

An administrator role is included for exceptional cases, allowing for manual resolution of disputes if the community voting process stalls or is contentious. The contract is designed with transparency in mind, emitting events for all significant actions.

## General Features

-   Community-powered flagging of content reviews.
-   Reputation-weighted voting system to approve or reject flagged reviews.
-   Automated resolution of moderation cases based on vote thresholds.
-   Administrator override for manual dispute resolution.
-   Protection against common exploits like double-voting.
-   Event-driven architecture for transparent tracking of moderation activities.
-   Secure, on-chain logic for all moderation processes.

## Functionalities

1.  **Contract Initialization**
    -   Set the contract administrator and the address of the external reputation contract.
    -   Initializes storage for moderation flags.

2.  **Review Flagging**
    -   Allows any authenticated user to flag a review for moderation by providing the review ID and a reason.
    -   Prevents a review from being flagged more than once.

3.  **Moderation Voting**
    -   Allows authenticated users to vote on a flagged review (approve or reject removal).
    -   Integrates with a reputation contract to calculate the weight of each vote.
    -   Prevents users from voting more than once on the same review.

4.  **Case Resolution**
    -   Automatically resolves a moderation case when vote counts reach a predefined threshold and a clear majority is established.
    -   Allows a designated administrator to resolve a case manually.

5.  **Data Retrieval**
    -   Provides a public function to retrieve the current status and details of any flagged review.

## Contract Structure

```
educational-content-community-based-review-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and public interface
│   ├── moderation.rs           # Core logic for flagging, voting, and resolution
│   ├── utils.rs                # Data structures, constants, and helper functions
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── Makefile                    # Build automation scripts
└── insstructions.md            # Initial project requirements
```

## Events

The contract emits events to ensure transparency and allow off-chain services to monitor moderation activity.

1.  `review_flagged` - Emitted when a review is flagged for moderation.
    -   Data: `review_id` (u64), `flagger` (Address)

2.  `moderation_voted` - Emitted when a user casts a vote on a flagged review.
    -   Data: `review_id` (u64), `voter` (Address), `approve` (bool)

3.  `moderation_resolved` - Emitted when a moderation case is closed, either automatically or by an admin.
    -   Data: `review_id` (u64), `outcome` (bool)

## Functions

### Public Functions

#### `initialize(env: Env, admin: Address, reputation_contract: Address)`

-   Initializes the contract with essential addresses.
-   **admin**: The address designated as the contract administrator.
-   **reputation_contract**: The address of the contract used to fetch user reputation scores for vote weighting.
-   Panics if the contract has already been initialized.

#### `flag_review(env: Env, flagger: Address, review_id: u64, reason: String)`

-   Flags a review for community moderation.
-   Requires authentication from the `flagger`.
-   **review_id**: The unique identifier of the review being flagged.
-   **reason**: A string explaining why the review is being flagged.
-   Panics if the review has already been flagged.

#### `vote_moderation(env: Env, voter: Address, review_id: u64, approve: bool)`

-   Casts a vote on a flagged review.
-   Requires authentication from the `voter`.
-   **review_id**: The ID of the flagged review to vote on.
-   **approve**: A boolean indicating the vote direction (`true` to approve removal, `false` to reject).
-   Panics if the voter has already voted or if the moderation case is already resolved.

#### `get_flag(env: Env, review_id: u64) -> Option<ModerationFlag>`

-   Retrieves the complete `ModerationFlag` struct for a given review ID.
-   Returns `None` if no flag exists for the specified `review_id`.

#### `admin_resolve(env: Env, review_id: u64, approve: bool)`

-   Allows the administrator to unilaterally resolve a moderation case.
-   Requires authentication from the contract's admin address.
-   **review_id**: The ID of the flagged review to resolve.
-   **approve**: The final outcome of the moderation.
-   Panics if the case is already resolved.

### Internal Functions

#### `get_vote_weight(voter: &Address, env: &Env) -> u32`

-   Calculates the voting power of a user.
-   Calls the `get_user_reputation` function on the linked reputation contract.
-   Returns a vote weight calculated as `1 + (reputation_score / 20)`.

## Technical Details and Implementation Notes

1.  **Data Model**
    -   `ModerationFlag`: A struct that stores all information related to a single moderation case, including the reason, vote counts, resolution status, and a map of voters to prevent duplicates.

2.  **Storage**
    -   `MODERATION_FLAGS`: A persistent `Map` that stores `ModerationFlag` structs, keyed by the `review_id`.
    -   `ADMIN`: A persistent key storing the administrator's `Address`.
    -   `REPUTATION_CONTRACT`: A persistent key storing the `Address` of the reputation contract.
    -   Storage entries are automatically bumped on access to extend their lifetime and prevent premature expiration.

3.  **Authorization**
    -   All state-changing functions (`flag_review`, `vote_moderation`, `admin_resolve`) use `require_auth()` to ensure the caller is authorized to perform the action.

4.  **Resolution Logic**
    -   A moderation case is automatically resolved if one side (approve/reject) accumulates a vote weight of 2 or more and has a majority over the other side. This threshold is simple but effective for early-stage implementation.

5.  **Vote Weighting**
    -   The system gives a base vote weight of 1 to every user, plus additional weight based on their reputation score. This ensures that all users can participate while giving more influence to established community members.

## Role in Akkuea

The Community-Based Review Moderation Contract is a cornerstone of Akkuea's trust and quality assurance framework. Its role is to:

1.  **Maintain Feedback Integrity**: Ensures that the review system, a primary source of truth for content quality, is not compromised by spam, abuse, or other malicious behavior.

2.  **Empower the Community**: Fosters a sense of ownership and responsibility among users by giving them the tools to self-regulate the platform.

3.  **Reinforce the Reputation System**: Creates a virtuous cycle where users with high reputation have a greater ability to maintain platform quality, which in turn reinforces the value of having a good reputation.

4.  **Increase Trust**: By making moderation transparent and community-driven, the contract builds user trust in the fairness and reliability of the entire Akkuea ecosystem.

This contract directly supports Akkuea's mission to provide high-quality, accessible education by ensuring that the mechanisms for evaluating that education are robust, fair, and resistant to manipulation.
