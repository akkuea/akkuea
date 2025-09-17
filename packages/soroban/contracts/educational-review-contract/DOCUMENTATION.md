# Educational Review Contract Documentation

## Overview

The Educational Review Contract is a comprehensive solution for managing educational content reviews within the Akkuea ecosystem. It enables verified purchasers to submit detailed reviews with category-specific ratings, textual feedback, and multimedia attachments. The contract implements a robust verification system to ensure that only actual purchasers can submit reviews, while also providing mechanisms for dispute resolution and review moderation.

This contract serves as a critical trust and quality assurance layer in the Akkuea platform, allowing users to make informed decisions about educational resources based on authentic feedback from verified purchasers. The category-specific rating system (Content Quality, Instructor Support) is specifically designed for educational resources, providing nuanced feedback that helps learners identify high-quality educational content.

The contract includes several security and quality control mechanisms, including purchase verification, review window limitations, content moderation through disputes, and helpfulness voting to surface the most valuable reviews. It also supports interactive discussions through responses from both product owners and other purchasers.

## General Features

- Category-specific rating system tailored for educational content
- Verified purchase requirement for review submission
- Rich review content with text and multimedia attachments
- Interactive responses from product owners and other users
- Dispute resolution system for content moderation
- Helpfulness voting to identify valuable reviews
- Time-limited review window to ensure relevant feedback
- Comprehensive rating summaries for products

## Functionalities

1. **Review Submission and Management**
   - Submit detailed reviews with category ratings, text, and multimedia
   - Enforce purchase verification before review submission
   - Limit reviews to a specific time window after purchase
   - Track review metrics including helpful/not helpful votes
   - Support interactive discussions through responses

2. **Rating System**
   - Category-specific ratings for educational content
   - 5-star rating scale for standardized evaluation
   - Automatic calculation of rating summaries
   - Segmented ratings for different aspects of educational resources

3. **Purchase Verification**
   - Record purchases through integration with payment contract
   - Verify purchase eligibility before allowing reviews
   - Link reviews to specific purchases for traceability
   - Prevent duplicate reviews for the same purchase

4. **Dispute Resolution**
   - Flag problematic reviews through admin-initiated disputes
   - Track dispute evidence and resolution status
   - Resolve disputes with appropriate status updates
   - Maintain review integrity through moderation

5. **Community Engagement**
   - Allow responses to reviews from product owners and other users
   - Enable helpfulness voting to identify valuable reviews
   - Track engagement metrics for reviews
   - Support community-driven quality assessment

## Contract Structure

```
educational-review-contract/
├── src/
│   ├── lib.rs                  # Main contract entry point and implementation
│   ├── datatype.rs             # Data structures and enums
│   ├── interface.rs            # Trait definitions for contract interfaces
│   ├── dispute.rs              # Dispute handling functionality
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

The contract emits several events to track important actions:

1. `contract_initialized` - When the contract is initialized
   - Data: admin, payment_contract

2. `product_owner_set` - When a product owner is assigned
   - Data: product_id, owner

3. `purchase` - When a purchase is recorded
   - Data: "product_id", product_id

4. `review_submitted` - When a review is successfully submitted
   - Data: user, (product_id, review_id, sum_ratings)

5. `summary_retrieved` - When a review summary is retrieved
   - Data: product_id, total_ratings

6. `response_added` - When a response is added to a review
   - Data: author, (product_id, review_id, response_text)

7. `review_disputed` - When a review is marked as disputed
   - Data: product_id, review_id

8. `dispute_resolved` - When a dispute is resolved
   - Data: product_id, (review_id, dispute_id)

## Functions

### Contract Management

#### `initialize(env: Env, admin: Address, payment_contract: Address) -> Result<(), ReviewError>`

- Initializes the contract with an admin address and payment contract
- Prevents re-initialization
- Sets up the initial contract state
- Emits a contract_initialized event

#### `set_product_owner(env: Env, product_id: u64, owner: Address) -> Result<(), ReviewError>`

- Sets the owner for a specific product
- Requires admin authentication
- Enables product owners to respond to reviews
- Emits a product_owner_set event

### Rating Operations

#### `submit_review(env: Env, user: Address, product_id: u64, category_ratings: Vec<CategoryRating>, text: Option<String>, multimedia: Vec<MediaAttachment>) -> Result<u32, ReviewError>`

- Submits a new review for a purchased product
- Requires user authentication and purchase verification
- Validates all inputs including ratings, text length, and multimedia count
- Enforces review window limitations
- Updates product rating summary
- Returns the assigned review ID

#### `get_review_summary(env: Env, product_id: u64) -> Result<ReviewSummary, ReviewError>`

- Retrieves the rating summary for a product
- Returns total ratings and sum of ratings
- Provides data for average rating calculation
- Emits a summary_retrieved event

### Review Operations

#### `add_response(env: Env, author: Address, product_id: u64, review_id: u32, response_text: String) -> Result<(), ReviewError>`

- Adds a response to an existing review
- Requires author authentication
- Validates that the author is either the product owner or the reviewer
- Enforces text length limitations
- Updates the review with the new response
- Emits a response_added event

#### `vote_helpful(env: Env, voter: Address, product_id: u64, review_id: u32, helpful: bool) -> Result<(), ReviewError>`

- Records a helpfulness vote for a review
- Requires voter authentication
- Prevents duplicate votes from the same user
- Updates helpful or not helpful vote counts
- Helps surface valuable reviews

#### `get_review(env: Env, product_id: u64, review_id: u32) -> Result<Review, ReviewError>`

- Retrieves the full details of a specific review
- Returns all review data including ratings, text, multimedia, and responses
- Provides complete review information for display

### Verification Operations

#### `record_purchase(env: Env, user: Address, product_id: u64, purchase_link: Option<String>) -> Result<(), ReviewError>`

- Records a product purchase, enabling review submission
- Requires payment contract authentication
- Prevents duplicate purchase records
- Stores purchase details including timestamp
- Emits a purchase event

#### `has_verified_purchase(env: Env, user: Address, product_id: u64) -> Result<bool, ReviewError>`

- Checks if a user has a verified purchase for a product
- Returns boolean indicating purchase status
- Used to verify eligibility for review submission

#### `dispute_review(env: Env, product_id: u64, review_id: u32) -> Result<u32, ReviewError>`

- Marks a review as disputed for moderation
- Requires admin authentication
- Creates a dispute record with timestamp
- Updates review status to Disputed
- Returns the assigned dispute ID
- Emits a review_disputed event

#### `resolve_dispute(env: Env, dispute_id: u32) -> Result<(), ReviewError>`

- Resolves a previously opened dispute
- Requires admin authentication
- Updates dispute status to resolved
- Reverts review status to Verified
- Emits a dispute_resolved event

## Technical Details and Implementation Notes

1. **Data Model**
   - `Review`: Core data structure containing ratings, text, multimedia, and responses
   - `CategoryRating`: Category-specific ratings with timestamps
   - `MediaAttachment`: Multimedia content references (IPFS links or URLs)
   - `Purchase`: Purchase record linking users to products
   - `Dispute`: Dispute records for review moderation
   - `ReviewSummary`: Aggregated rating data for products

2. **Storage**
   - Uses persistent storage for all data
   - Structured key system for data organization
   - Separate storage for reviews, purchases, disputes, and summaries
   - Efficient lookup by product ID and review ID

3. **Authorization**
   - Explicit authentication checks using `require_auth()`
   - Admin-only functions for sensitive operations
   - Payment contract authentication for purchase recording
   - User authentication for review submission and voting

4. **Validation**
   - Purchase verification before review submission
   - Review window enforcement (30 days from purchase)
   - Text length validation (max 500 characters)
   - Multimedia attachment limits (max 5 attachments)
   - Rating validation (1-5 stars)

5. **Error Handling**
   - Comprehensive error types for different failure scenarios
   - Descriptive error messages for client feedback
   - Proper error propagation throughout the contract

6. **Constants and Configuration**
   - Configurable review window (30 days)
   - Adjustable multimedia attachment limits
   - Customizable text length restrictions

## Role in Akkuea

The Review System Contract plays a vital role in Akkuea's educational ecosystem by:

1. **Quality Assurance**: Provides a mechanism for verifying the quality of educational resources through authentic user feedback.

2. **Trust Building**: Creates trust in the platform by ensuring reviews come from verified purchasers and maintaining review integrity through moderation.

3. **Informed Decision Making**: Helps users make informed decisions about educational resources based on detailed, category-specific ratings and authentic feedback.

4. **Community Engagement**: Fosters community interaction through responses and helpfulness voting, creating a collaborative environment for educational resource evaluation.

5. **Content Improvement**: Provides valuable feedback to educational content creators, helping them improve their offerings based on user experiences.

This contract supports Akkuea's mission of making education accessible and high-quality by ensuring that educational resources are transparently evaluated and that users can easily identify valuable content through authentic reviews and ratings.
