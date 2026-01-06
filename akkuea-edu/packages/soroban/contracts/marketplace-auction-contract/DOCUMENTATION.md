# Auction Contract Documentation

## Overview

The Auction Contract is a comprehensive smart contract system that enables decentralized auctions on the Stellar blockchain. It provides a secure, transparent platform for users to create auctions, place bids, verify product authenticity, manage shipping, and resolve disputes. The contract implements a complete auction lifecycle from creation to completion, with robust security measures and role-based access controls.

This contract serves as a marketplace component within the Akkuea ecosystem, allowing users to auction educational resources, materials, and related products. It supports the platform's mission of creating a collaborative educational environment where value exchange is transparent and secure.

## General Features

- Complete auction lifecycle management (creation, bidding, completion)
- Product verification by authorized verifiers
- Shipping tracking and status updates
- Dispute resolution system with dedicated resolvers
- Role-based access control (admin, verifiers, resolvers)
- Comprehensive event emission for frontend integration
- User-specific auction tracking (selling and bidding)

## Functionalities

1. **Auction Management**
   - Create auctions with detailed product information
   - Start, end, and cancel auctions based on specific conditions
   - Track auction status through its lifecycle

2. **Bidding System**
   - Place bids with quantity specification
   - Automatic highest bid tracking
   - Bid history for each auction

3. **Product Verification**
   - Authorized verifiers can authenticate products
   - Verification status tracking

4. **Shipping Management**
   - Add shipping information including tracking numbers
   - Update shipping status (NotShipped, Shipped, InTransit, Delivered)
   - Calculate shipping costs based on destination

5. **Dispute Resolution**
   - Open disputes with detailed reasons
   - Resolve disputes with outcomes for buyer or seller
   - Dispute status tracking

6. **Administrative Functions**
   - Add product verifiers
   - Add dispute resolvers
   - Initialize contract with admin address

7. **Query Functions**
   - Get auction details
   - Get user's selling auctions
   - Get user's bidding auctions
   - Bulk query multiple auctions

## Contract Structure

```
marketplace-auction-contract/
├── src/
│   ├── lib.rs                  # Main contract interface
│   ├── datatype/
│   │   ├── mod.rs              # Data type exports
│   │   ├── enums.rs            # Enumerations (status types, etc.)
│   │   └── models.rs           # Data structures (Auction, Product, etc.)
│   ├── operations/
│   │   ├── mod.rs              # Operation exports
│   │   ├── admin.rs            # Admin operations
│   │   ├── auction.rs          # Auction creation/management
│   │   ├── bid.rs              # Bidding operations
│   │   ├── dispute.rs          # Dispute operations
│   │   ├── query.rs            # Query operations
│   │   ├── shipping.rs         # Shipping operations
│   │   └── storage.rs          # Storage operations
│   └── test.rs                 # Test module
├── Cargo.toml                  # Project configuration
├── DOCUMENTATION.md            # Contract documentation
├── IMPROVEMENT_SUGGESTIONS.md  # Contract improvement suggestions
├── Makefile                    # Build automation
└── TEST_DOCUMENTATION.md       # Test documentation
```

## Events

The contract emits the following events:

1. `auction_created` - When a new auction is created
   - Data: auction_id

2. `auction_started` - When an auction transitions from Pending to Active
   - Data: auction_id

3. `auction_ended` - When an auction reaches its end time
   - Data: auction_id

4. `auction_cancelled` - When an auction is cancelled
   - Data: auction_id

5. `bid_placed` - When a bid is placed
   - Data: auction_id, bidder, amount, quantity

6. `product_verified` - When a product's authenticity is verified
   - Data: auction_id, is_authentic

7. `product_shipped` - When shipping information is added
   - Data: auction_id, tracking_number

8. `product_delivered` - When shipping status is updated to Delivered
   - Data: auction_id

9. `dispute_opened` - When a dispute is opened
   - Data: auction_id, reason

10. `dispute_resolved` - When a dispute is resolved
    - Data: auction_id, resolution

## Functions

### Auction Management

#### `initialize(env: Env, admin: Address)`

- Initializes the contract with an admin address
- The admin has special privileges for adding verifiers and resolvers

#### `create_auction(env: Env, seller: Address, name: String, description: String, condition: ProductCondition, images: Vec<String>, inventory_count: u32, reserve_price: i128, start_time: u64, end_time: u64) -> BytesN<32>`

- Creates a new auction with the specified parameters
- Returns the unique auction ID
- Requires seller authentication
- Validates that end_time > start_time, inventory_count > 0, and reserve_price > 0

#### `start_auction(env: Env, auction_id: BytesN<32>)`

- Transitions an auction from Pending to Active status
- Can only be called by the seller
- Checks that current time >= start_time

#### `end_auction(env: Env, auction_id: BytesN<32>)`

- Ends an active auction
- Can be called by anyone after the end time is reached
- Changes status from Active to Ended

#### `cancel_auction(env: Env, auction_id: BytesN<32>)`

- Cancels a pending auction
- Can only be called by the seller
- Only works for auctions in Pending status

### Bidding

#### `place_bid(env: Env, auction_id: BytesN<32>, bidder: Address, amount: i128, quantity: u32)`

- Places a bid on an active auction
- Requires bidder authentication
- Validates bid amount against reserve price and current highest bid
- Updates highest bid tracking and bid history

### Product Verification

#### `verify_product(env: Env, verifier: Address, auction_id: BytesN<32>, is_authentic: bool)`

- Verifies product authenticity
- Requires verifier authentication and authorization
- Updates product authentication status

### Shipping Management

#### `add_shipping_info(env: Env, auction_id: BytesN<32>, tracking_number: String, carrier: String, estimated_delivery: u64, shipping_cost: i128, recipient_address: String)`

- Adds shipping information for an ended auction
- Can only be called by the seller
- Requires a winning bid to exist

#### `update_shipping_status(env: Env, auction_id: BytesN<32>, new_status: ShippingStatus)`

- Updates the shipping status
- Can only be called by the seller
- If status is set to Delivered, updates auction status to Completed

#### `calculate_shipping_cost(env: Env, auction_id: BytesN<32>, destination: String, shipping_speed: u32) -> i128`

- Calculates shipping cost based on destination and shipping speed
- Returns the calculated cost

### Dispute Resolution

#### `open_dispute(env: Env, auction_id: BytesN<32>, buyer: Address, reason: String)`

- Opens a dispute for an ended or completed auction
- Can only be called by the highest bidder
- Updates auction status to Disputed

#### `resolve_dispute(env: Env, resolver: Address, auction_id: BytesN<32>, resolution: DisputeStatus)`

- Resolves an open dispute
- Can only be called by the admin or an authorized resolver
- Updates dispute status and sets auction status to Completed

### Administrative Functions

#### `add_verifier(env: Env, admin: Address, verifier: Address)`

- Adds an address to the list of authorized product verifiers
- Can only be called by the admin

#### `add_resolver(env: Env, admin: Address, resolver: Address)`

- Adds an address to the list of authorized dispute resolvers
- Can only be called by the admin

### Query Functions

#### `get_auction(env: Env, auction_id: BytesN<32>) -> Option<Auction>`

- Returns the details of a specific auction

#### `get_user_selling_auctions(env: Env, user: Address) -> Vec<BytesN<32>>`

- Returns IDs of auctions where the user is the seller

#### `get_user_bidding_auctions(env: Env, user: Address) -> Vec<BytesN<32>>`

- Returns IDs of auctions where the user has placed bids

#### `get_auctions(env: Env, auction_ids: Vec<BytesN<32>>) -> Vec<Auction>`

- Returns details for multiple auctions in a single call

## Technical Details and Implementation Notes

1. **Data Model**
   - The contract uses a flattened `Auction` structure for efficient storage
   - Helper methods are provided to work with complex nested data
   - Enums are used for status tracking (auction, shipping, dispute)

2. **Storage**
   - Data is organized using a structured key system
   - Maps are used for efficient lookup of auctions and user relationships
   - Separate storage for admin, verifiers, and resolvers

3. **Authorization**
   - Role-based access control for admin, verifiers, and resolvers
   - Operation-specific authorization (e.g., only seller can cancel auction)
   - Explicit authentication checks using `require_auth()`

4. **Event System**
   - Comprehensive events for frontend integration
   - Events include relevant data for tracking state changes
   - Consistent event naming convention

5. **Error Handling**
   - Explicit validation of inputs and state transitions
   - Clear error messages for debugging and user feedback
   - Panic-based error handling for contract safety

6. **Optimizations**
   - Efficient storage patterns to minimize blockchain resource usage
   - Reuse of common validation logic
   - Bulk operations for querying multiple auctions

## Role in Akkuea

The Auction Contract plays a crucial role in Akkuea's decentralized educational ecosystem by:

1. **Facilitating Resource Exchange**: Enables educators and content creators to auction educational materials, creating a marketplace for high-quality resources.

2. **Supporting Creator Economy**: Aligns with Akkuea's reward system by providing a mechanism for creators to monetize their educational content through auctions.

3. **Ensuring Authenticity**: The verification system ensures that educational materials traded on the platform are authentic and meet quality standards.

4. **Transparent Transactions**: Provides a transparent, blockchain-based record of educational resource exchanges, supporting Akkuea's commitment to openness.

5. **Dispute Resolution**: Offers a formal process for resolving disputes, maintaining trust in the educational marketplace.

This contract supports Akkuea's mission of making education accessible and rewarding contributions by creating a secure, transparent marketplace for educational resources.
