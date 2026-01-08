# User Rating Contract Documentation

## Overview

The User Rating Contract is a comprehensive solution for managing user reputation and ratings within the Akkuea ecosystem. It enables users to rate each other based on their interactions, with ratings tied to specific transactions. The contract calculates and maintains reputation scores based on multiple weighted criteria, providing a transparent and fair assessment of user trustworthiness.

This contract serves as a critical trust layer in the Akkuea platform, allowing community members to make informed decisions about educational content providers and contributors. The multi-dimensional rating system (delivery, communication, accuracy, and value) provides nuanced feedback that is particularly relevant for educational resource exchanges.

The contract implements several security measures to prevent rating manipulation, including self-rating prevention, duplicate rating checks, and time-based restrictions between ratings. It also provides a tiered reputation system that categorizes users based on their accumulated ratings, making it easy to identify established and trusted community members.

## General Features

- Multi-dimensional rating system with weighted criteria
- Transaction-based rating to prevent duplicate or fraudulent ratings
- Tiered reputation system (New, Low, Medium, High)
- Time-based restrictions to prevent rating spam
- Comprehensive rating history tracking
- Detailed rating comments for qualitative feedback

## Functionalities

1. **User Reputation Management**
   - Initialize reputation for new users
   - Calculate and update reputation scores based on received ratings
   - Categorize users into reputation tiers
   - Retrieve current reputation data for any user

2. **Rating Submission**
   - Submit ratings tied to specific transactions
   - Validate rating scores and parameters
   - Prevent self-ratings and duplicate ratings
   - Enforce time intervals between rating submissions

3. **Rating History**
   - Track all ratings received by a user
   - Retrieve complete rating history
   - Access specific rating details by transaction ID

4. **Reputation Calculation**
   - Apply weighted scoring to different rating dimensions
   - Normalize reputation scores on a 0-100 scale
   - Determine reputation tiers based on score thresholds

## Contract Structure

```
user-rating-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point
│   ├── contract.rs             # Contract implementation
│   ├── constants.rs            # System constants and parameters
│   ├── rating.rs               # Rating submission logic
│   ├── reputation.rs           # Reputation calculation logic
│   ├── storage.rs              # Data persistence logic
│   ├── types.rs                # Data structures and enums
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

While the contract doesn't explicitly emit events in the examined code, it would be beneficial to implement events for the following actions:

1. `reputation_initialized` - When a new user's reputation is initialized
   - Data: user, timestamp

2. `rating_submitted` - When a rating is successfully submitted
   - Data: transaction_id, rater, rated_user, scores, timestamp

3. `reputation_updated` - When a user's reputation changes
   - Data: user, new_score, new_tier, previous_score, previous_tier

## Functions

### Reputation Management

#### `init_user_reputation(env: Env, user: Address) -> ReputationData`

- Initializes reputation data for a new user
- Requires user authentication
- Returns the initialized reputation data
- Prevents re-initialization of existing users

#### `get_user_reputation(env: Env, user: Address) -> ReputationData`

- Retrieves the current reputation data for a user
- Returns default "New" reputation if user doesn't exist

### Rating Submission

#### `submit_rating(env: Env, transaction_id: BytesN<32>, rater: Address, rated_user: Address, delivery_score: u32, communication_score: u32, accuracy_score: u32, value_score: u32, comment: String) -> RatingSubmissionResult`

- Submits a new rating for a specific transaction
- Requires rater authentication
- Validates all parameters and conditions
- Updates the rated user's reputation
- Returns the result including success status and new reputation data

### Rating Retrieval

#### `get_user_rating_history(env: Env, user: Address) -> Vec<BytesN<32>>`

- Retrieves a list of transaction IDs for all ratings received by a user

#### `get_transaction_rating(env: Env, transaction_id: BytesN<32>) -> Option<RatingData>`

- Retrieves the rating data for a specific transaction
- Returns None if the transaction hasn't been rated

### Internal Functions

#### `handle_rating_submission`

- Processes rating submissions with validation checks
- Prevents self-ratings and duplicate ratings
- Enforces minimum time intervals between ratings
- Validates score ranges (1-5)
- Updates user reputation after successful submission

#### `update_reputation`

- Calculates new reputation data based on received ratings
- Updates total score and rating count
- Recalculates normalized reputation score
- Determines new reputation tier

#### `calculate_weighted_score`

- Applies dimension weights to individual rating scores
- Combines scores into a single weighted value

#### `calculate_reputation_score`

- Normalizes reputation to a 0-100 scale
- Accounts for maximum possible score

#### `determine_reputation_tier`

- Categorizes users into reputation tiers based on score thresholds

## Technical Details and Implementation Notes

1. **Data Model**
   - `ReputationData`: Stores user reputation metrics
   - `RatingData`: Contains detailed rating information
   - `RatingSubmissionResult`: Provides feedback on rating submission
   - `ReputationTier`: Enum for reputation categories

2. **Storage**
   - Uses structured key system for data organization
   - Separate storage for reputation data, rating history, and timestamps
   - Transaction-based rating storage prevents duplicates

3. **Authorization**
   - Explicit authentication checks using `require_auth()`
   - Users can only initialize their own reputation
   - Raters must authenticate to submit ratings

4. **Validation**
   - Score validation (1-5 range)
   - Self-rating prevention
   - Duplicate rating prevention
   - Time-based restrictions between ratings

5. **Reputation Calculation**
   - Weighted scoring system for different dimensions
   - Normalized scores (0-100) for easy understanding
   - Tiered categorization for simple reputation assessment

6. **Constants and Configuration**
   - Configurable dimension weights
   - Adjustable reputation tier thresholds
   - Minimum time interval between ratings

## Role in Akkuea

The Rating System Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Building Trust**: Provides a transparent mechanism for establishing trust between users in the educational marketplace.

2. **Quality Assurance**: Helps maintain high standards for educational content by allowing users to rate resources based on accuracy and value.

3. **Community Feedback**: Creates a feedback loop that encourages quality contributions and helps identify valuable educational resources.

4. **User Reputation**: Establishes a reputation system that recognizes and rewards consistent high-quality contributions to the platform.

5. **Decision Support**: Helps users make informed decisions about which educational resources to use and which contributors to trust.

This contract aligns with Akkuea's mission of creating a collaborative platform where education is free, accessible, and high-quality by ensuring that contributions are evaluated transparently and contributors are recognized for their value to the community.
