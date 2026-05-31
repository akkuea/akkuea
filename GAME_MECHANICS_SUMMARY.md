# Akkuea Land: Game Mechanics & Design Summary

> **Comprehensive guide to the Akkuea Land real estate game mechanics**
> For: Player-facing documentation, developer onboarding, and design reference

---

## Executive Overview

**Akkuea Land** is a real estate investment game on the Stellar blockchain where players:

- Buy and own virtual property tiles in a 20×20 city grid (400 properties)
- Earn passive rental income from their properties
- Improve buildings to increase earning potential
- Trade properties on a peer-to-peer marketplace
- Use LAND tokens as the in-game currency

The entire game is built on **Soroban smart contracts** (Rust, using Cougr ECS framework) with a **Next.js frontend**. Players authenticate via **Pollar** (social login with automatic wallet provisioning).

---

## Part 1: Core Game Entities

### 1.1 City Grid & Property Tiles

| Attribute          | Value                       | Notes                                   |
| ------------------ | --------------------------- | --------------------------------------- |
| Grid Dimensions    | 20 × 20                     | 400 total unique properties             |
| Property ID Scheme | 0–399                       | Calculated as `y * 20 + x`              |
| Coordinate Range   | (0,0) to (19,19)            | Standard x-y grid                       |
| Property Type      | ERC-721-like NFT on Soroban | Each property is a unique token         |
| Initial Owner      | Treasury (game account)     | Properties minted here, sold to players |

**Grid Layout Example:**

```
y=19  [ ][ ][ ]...[ ]
...
y=1   [A] [B] [C]...[ ]
y=0   [P] [ ] [ ]...[ ]
      x=0 x=1 x=2   x=19
```

- Property at coordinates (3, 7) has ID = 7 × 20 + 3 = 143

### 1.2 Property States

Each property has:

- **Owner Address**: Stellar wallet address (null if unowned/Treasury)
- **Improvement Level**: Vacant → Residential → Commercial → Skyscraper
- **Last Claimed Ledger**: Timestamp of last rental income claim (for income calculation)
- **Accrued Income**: Total LAND earned but not yet claimed

### 1.3 LAND Token (Currency)

| Property          | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Token Name        | "Akkuea Land Token"                                       |
| Symbol            | LAND                                                      |
| Decimal Precision | 7 decimals (1 LAND = 10,000,000 stroops)                  |
| Standard          | SEP-41 (Stellar fungible token)                           |
| Supply Model      | Mintable (minted by GameEngine when players claim income) |
| Faucet            | 1,000 LAND per player (one-time, testnet only)            |

**Use Cases:**

1. Buy properties from Treasury (500 LAND)
2. Buy properties from other players (marketplace)
3. Upgrade buildings (200–1,800 LAND per improvement)
4. Earned as rental income

---

## Part 2: How Properties Are Bought/Sold

### 2.1 Buying from Treasury (Initial Purchase)

**Flow:**

1. Player views City Map
2. Selects an unowned property
3. Clicks "Buy from Treasury"
4. System shows price: **500 LAND**
5. Player approves LAND burn via Pollar signature
6. GameEngine burns 500 LAND from player's wallet
7. PropertyNFT contract transfers property to player
8. Property now generates rental income

**On-Chain Calls:**

- `GameEngine.improve()` or treasury purchase method
- `GameLandToken.burn_from(player, 500 * 10^7)` ← deducts cost
- `GamePropertyNFT.transfer(treasury, player, property_id)`

### 2.2 Buying from Players (Marketplace)

**Listing a Property:**

1. Owner opens property detail panel
2. Clicks "List for Sale"
3. Enters desired price (in LAND)
4. Signs transaction to approve NFT escrow
5. Marketplace contract takes possession of NFT
6. Property appears on marketplace with sale indicator
7. Owner can cancel anytime before sale

**On-Chain:**

- `GamePropertyNFT.approve(marketplace_address, property_id)`
- `GameMarketplace.list(seller_address, property_id, price_in_land)`

**Buying a Listed Property:**

1. Buyer browses marketplace listings
2. Selects property and sees price + seller info
3. Clicks "Buy"
4. System shows price
5. Buyer signs approval for LAND transfer
6. Marketplace executes atomic swap:
   - LAND transferred to seller
   - NFT transferred to buyer
7. Listing removed
8. Property owner changes, income resets to 0

**On-Chain (Atomic):**

- `GameLandToken.approve(marketplace_address, price)` ← buyer approval
- `GameMarketplace.buy(buyer_address, property_id)`
  - Internally:
    - `GameLandToken.transfer_from(buyer, seller, price)`
    - `GamePropertyNFT.transfer(marketplace, buyer, property_id)`
    - Remove listing from storage

**Key Guarantees:**

- If LAND transfer fails → NFT transfer doesn't happen
- If NFT transfer fails → LAND transfer doesn't happen
- Listing removed atomically with sale

### 2.3 Selling Cancellation

Owner can cancel a listing anytime:

1. Open property detail
2. Click "Cancel Listing"
3. Sign transaction
4. NFT returned to owner
5. Property removed from marketplace

---

## Part 3: Building Improvements & Costs

### 3.1 Improvement Level System

Four permanent levels increase rental income. Each upgrade is one-way and irreversible:

| Level           | Code | Base Multiplier | Income per 100 Ledgers | Upgrade Cost (from previous) |
| --------------- | ---- | --------------- | ---------------------- | ---------------------------- |
| **Vacant**      | 0    | 1.0×            | 10 LAND                | N/A (initial state)          |
| **Residential** | 1    | 1.5×            | 15 LAND                | 200 LAND                     |
| **Commercial**  | 2    | 3.0×            | 30 LAND                | 600 LAND                     |
| **Skyscraper**  | 3    | 6.0×            | 60 LAND                | 1,800 LAND                   |

### 3.2 Improvement Costs In Detail

```
Vacant → Residential:  200 LAND
Residential → Commercial:  600 LAND
Commercial → Skyscraper:  1,800 LAND

Total to max: 200 + 600 + 1,800 = 2,600 LAND
```

**Cost Breakdown by Level (cumulative to reach each level):**
| Target Level | Cumulative Cost |
|--------------|-----------------|
| Residential | 200 LAND |
| Commercial | 800 LAND |
| Skyscraper | 2,600 LAND |

### 3.3 Improvement ROI & Payback Periods

**Vacant to Residential (200 LAND cost):**

- Income increase: 10 → 15 LAND per epoch
- Payback: 200 ÷ 5 = 40 epochs (~5.3 hours)

**Residential to Commercial (600 LAND cost):**

- Income increase: 15 → 30 LAND per epoch
- Payback: 600 ÷ 15 = 40 epochs (~5.3 hours)

**Commercial to Skyscraper (1,800 LAND cost):**

- Income increase: 30 → 60 LAND per epoch
- Payback: 1,800 ÷ 30 = 60 epochs (~8 hours)

**Vacant to Skyscraper (Full chain, 2,600 LAND):**

- Income increase: 10 → 60 LAND per epoch
- Payback: 2,600 ÷ 50 = 52 epochs (~7 hours)
- **Skyscrapers earn 6× more than vacant lots**

### 3.4 How to Improve Buildings

**In-Game Flow:**

1. Open City Map
2. Click on owned property tile
3. Property detail panel opens
4. View current improvement level (visual progress bar)
5. Click "Improve to [Next Level]"
6. See cost displayed (e.g., "200 LAND to Residential")
7. Approve LAND burn via Pollar signature
8. GameEngine deducts cost
9. Level increases immediately
10. Income multiplier applies to next claim

**On-Chain Mechanics (GameEngine ECS Systems):**

The improvement process uses Cougr's GameApp with three staged systems:

**System 1 — PreUpdate (Validate)**

```
- Verify caller owns property_id via PropertyNFT.get_owner()
- Read current level from PropertyNFT.get_property()
- Verify level < 3 (not already Skyscraper)
- Calculate next level and cost
```

**System 2 — Update (Deduct Cost)**

```
- Burn improvement cost from caller
- GameLandToken.burn_from(caller, cost)
- Revert entire transaction if insufficient balance
```

**System 3 — PostUpdate (Apply)**

```
- Update property level
- PropertyNFT.set_improvement_level(caller, property_id, next_level)
- Emit event: ("improved", caller, property_id, next_level)
```

**Why Three Systems?**

- Ensures validation before any state changes
- Atomicity: if any system fails, entire transaction fails
- Clear separation of concerns

---

## Part 4: Rental Income System

### 4.1 Epoch & Income Timing

| Parameter        | Value        | Duration                                |
| ---------------- | ------------ | --------------------------------------- |
| **Epoch Length** | 100 ledgers  | ~8 minutes (Stellar ledger ≈ 5 seconds) |
| **Base Rate**    | 10 LAND      | Per epoch, for Vacant property          |
| **Multipliers**  | 1.5x, 3x, 6x | Per improvement level                   |

### 4.2 Income Accumulation

**How It Works:**

- Income accrues **automatically** every epoch (~8 min)
- Player **does not** need to claim immediately
- Income persists in contract state until claimed
- Multiple epochs of unclaimed income accumulate

**Example Timeline:**

```
Time    Event                          Accrued Income
0       Buy Vacant property            0 LAND
8 min   Epoch 1 completes             +10 LAND (total: 10)
16 min  Epoch 2 completes             +10 LAND (total: 20)
24 min  Epoch 3 completes             +10 LAND (total: 30)
32 min  ← Player claims now            Reset to 0, receives 40 LAND
40 min  Epoch 5 completes             +10 LAND (total: 10)
```

### 4.3 Income Calculation Formula

```
Accrued Income = BASE_RATE × MULTIPLIER × EPOCHS_ELAPSED

Where:
  BASE_RATE = 10 LAND per epoch
  MULTIPLIER = 1.0x (vacant), 1.5x, 3.0x, or 6.0x
  EPOCHS_ELAPSED = floor((current_ledger - last_claimed_ledger) / 100)
```

**Implementation (Rust, Integer Math Only):**

```rust
fn calculate_accrued_income(
    current_ledger: u64,
    last_claimed_ledger: u64,
    level: u32,
) -> i128 {
    let epochs_elapsed = (current_ledger - last_claimed_ledger) / 100;
    if epochs_elapsed == 0 {
        return 0;  // No income for partial epochs
    }

    let (multiplier_num, multiplier_den) = match level {
        0 => (1, 1),      // Vacant: 1.0x
        1 => (3, 2),      // Residential: 1.5x
        2 => (3, 1),      // Commercial: 3.0x
        3 => (6, 1),      // Skyscraper: 6.0x
        _ => (1, 1),
    };

    let base_rate = 10 * 10_000_000i128;  // 10 LAND, 7 decimals
    (base_rate * multiplier_num / multiplier_den) * epochs_elapsed as i128
}
```

**Key Points:**

- Uses **integer division only** (no floating point)
- Partial epochs do not generate income (e.g., 150 ledgers = 1 epoch, not 1.5)
- Multiplier stored as ratio (3, 2) for 1.5× to avoid precision loss

### 4.4 Claiming Rental Income

**In-Game Flow:**

1. Open player Dashboard
2. View "Accrued Income" amount (e.g., "120 LAND waiting")
3. Click "Claim Income" button
4. Approve transaction via Pollar
5. LAND minted to player's wallet
6. Accrued income resets to 0
7. `last_claimed_ledger` updated to current ledger

**On-Chain (GameEngine.claim_rental):**

```rust
fn claim_rental(caller: Address, property_id: u32) {
    // 1. Verify ownership
    let owner = PropertyNFT::get_owner(property_id);
    assert_eq!(owner, caller);

    // 2. Get property state
    let property = PropertyNFT::get_property(property_id);
    let last_claimed_ledger = property.last_claimed_ledger;
    let level = property.level;

    // 3. Calculate accrued income
    let current_ledger = env.ledger().sequence();
    let accrued = calculate_accrued_income(current_ledger, last_claimed_ledger, level);
    if accrued == 0 {
        panic!("NothingToClaim");
    }

    // 4. Mint new LAND to caller
    GameLandToken::mint(caller, accrued);

    // 5. Update last claimed ledger
    PropertyNFT::set_last_claimed_ledger(caller, property_id, current_ledger);

    // 6. Emit event
    env.events().publish(("claimed", caller, property_id), accrued);
}
```

### 4.5 Income Per Level (Complete Reference)

| Improvement Level | 1 Epoch (100 ledgers ≈ 8 min) | 10 Epochs (~80 min) | 60 Epochs (~8 hrs) |
| ----------------- | ----------------------------- | ------------------- | ------------------ |
| Vacant            | 10 LAND                       | 100 LAND            | 600 LAND           |
| Residential       | 15 LAND                       | 150 LAND            | 900 LAND           |
| Commercial        | 30 LAND                       | 300 LAND            | 1,800 LAND         |
| Skyscraper        | 60 LAND                       | 600 LAND            | 3,600 LAND         |

**Passive Income Over Time (Realistic Play Session):**

- **1 hour:** 7–8 epochs, Skyscraper earns ~420–480 LAND
- **4 hours:** 30 epochs, Skyscraper earns ~1,800 LAND (covers initial cost)
- **8 hours:** 60 epochs, Skyscraper earns ~3,600 LAND

---

## Part 5: Game Strategy Elements

### 5.1 Strategic Gameplay Decisions

**Early Game (First 30 minutes):**

- Claim 1,000 LAND from faucet
- Buy 1–2 properties from Treasury (500 LAND each)
- Start with Vacant properties
- Begin income accumulation

**Mid Game (1–4 hours):**

- Claim accumulated income every 30–60 minutes
- Improve 1–2 key properties to Residential or Commercial
- Buy 3–5 more properties as income allows
- Watch for marketplace opportunities

**Late Game (4+ hours):**

- Multiple Skyscrapers generating 60 LAND/epoch
- Active marketplace trading
- Portfolio optimization (buy underpriced, sell overpriced)
- Reinvestment strategy

### 5.2 Economic Meta-Game

**Income Prioritization:**

- Skyscrapers: 1,800 LAND to upgrade, pays for itself in 30 epochs (~4 hours)
- Commercial: 600 LAND to upgrade, pays for itself in 20 epochs (~2.7 hours)
- Residential: 200 LAND to upgrade, pays for itself in 40 epochs (~5.3 hours)

**Portfolio Diversification:**

- More properties = more total income
- 5 Skyscrapers (2,500 LAND investment) earn 300 LAND/epoch
- vs. 1 Skyscraper (600 LAND invested) earns 60 LAND/epoch

**Marketplace Arbitrage:**

- Buy underpriced properties from impatient sellers
- Improve them, collect income
- Sell at profit after 4–8 hours of play
- Limited by player capital and available inventory

### 5.3 Strategic Tips (For Player Guide)

1. **Don't panic-sell:** Income accumulates automatically; long-term holdings pay off
2. **Improve early:** Upgrade costs pay for themselves quickly; compound growth is powerful
3. **Diversify across grid:** Properties in different areas may have different demand
4. **Monitor marketplace:** Look for properties with high potential ROI (low cost, good location)
5. **Claim regularly:** Reinvest income to accelerate portfolio growth
6. **Time improvements:** Improve just before extended play sessions to maximize income return

---

## Part 6: Smart Contract Implementation

### 6.1 Contract Architecture Overview

Four Soroban contracts work together to enforce game rules:

```
Player Wallet
    │
    ├─→ GamePropertyNFT (Ownership layer)
    │   - Initialize: Mint 400 NFTs to Treasury
    │   - Transfer/Approve: Change ownership
    │   - Query: Get owner, level, income details
    │   - Update: Set level, update claim ledger (GameEngine only)
    │
    ├─→ GameLandToken (Currency)
    │   - Mint/Burn: Create/destroy LAND
    │   - Transfer: Send LAND between players
    │   - Faucet: Initial 1,000 LAND per player
    │
    ├─→ GameMarketplace (Trading)
    │   - List: Place property for sale
    │   - Buy: Purchase from listing (atomic LAND ↔ NFT swap)
    │   - Cancel: Remove listing
    │
    └─→ GameEngine (Rules)
        - Improve: Upgrade building, deduct cost, apply level
        - Claim: Calculate income, mint LAND, reset claim timer
```

### 6.2 Contract Details

#### PropertyNFT Contract (Cougr ECS)

**Storage Architecture:**

- Core state: SimpleWorld (ECS world with entities and components)
- Treasury: Address where initial NFTs reside
- Engine: Address allowed to update game state
- Paused flag: For emergency halting

**Components per Property (ECS Entity):**

```rust
PropertyCoords { x: u32, y: u32 }
PropertyOwner { address: Address }
PropertyMeta {
    level: u32,              // 0–3
    last_claimed_ledger: u64,
    approved_spender: u32    // For marketplace escrow
}
```

**Core Methods:**

- `initialize(treasury)` — Mint all 400 properties to Treasury
- `transfer(from, to, property_id)` — Transfer ownership
- `get_owner(property_id)` — Query current owner
- `get_property(property_id)` — Get full property state
- `list_by_owner(owner)` — Get all properties owned by address
- `set_improvement_level(caller, property_id, level)` — Update level (GameEngine only)
- `set_last_claimed_ledger(caller, property_id, ledger)` — Update claim time (GameEngine only)

**Events:**

- `transfer`: { from, to, id }
- `improved`: { owner, id, level }

**Error Handling:**

- `AlreadyInitialized`, `NotOwner`, `NotApproved`, `InvalidProperty`, `ContractPaused`

#### LandToken Contract (SEP-41)

**Standard Implementation:**

- Full Stellar fungible token interface
- 7 decimals (precision for micro-transactions)
- Mintable by GameEngine (for income claims)
- Burnable by GameEngine (for improvement costs)

**Special Methods:**

- `faucet(recipient)` — Mint 1,000 LAND (testnet only, one-time per address)

**Token Metadata:**

```
Name: "Akkuea Land Token"
Symbol: "LAND"
Decimals: 7
Initial Supply: 0 (minted as needed)
```

#### GameMarketplace Contract

**Listing Data Structure:**

```rust
struct Listing {
    seller: Address,
    property_id: u32,
    price_in_land: i128,
    created_ledger: u64,
}
```

**Methods:**

1. **list(seller, property_id, price)**
   - Verify seller owns property (via PropertyNFT)
   - Transfer NFT to marketplace escrow
   - Store listing in state
   - Emit event

2. **buy(buyer, property_id)**
   - Get listing or error
   - Transfer LAND from buyer to seller (atomic)
   - Transfer NFT from escrow to buyer (atomic)
   - Remove listing
   - Emit event

3. **cancel(seller, property_id)**
   - Verify seller is listing owner
   - Return NFT from escrow to seller
   - Remove listing
   - Emit event

4. **get_listing(property_id)** — Query single listing
5. **get_all_listings(offset, limit)** — Paginated query

**Key Guarantee:** Buy is atomic. If LAND transfer fails, NFT transfer doesn't happen. If NFT transfer fails, LAND is returned.

#### GameEngine Contract (Cougr ECS + GameApp)

**Entry Points:**

1. **improve(caller, property_id)**
   - Validate: Caller owns property, not already Skyscraper
   - Deduct: Burn improvement cost from caller balance
   - Apply: Call PropertyNFT.set_improvement_level(next_level)
   - Emit: ("improved", caller, property_id, next_level)

2. **claim_rental(caller, property_id)**
   - Verify: Caller owns property
   - Calculate: Accrued income using formula
   - Mint: GameLandToken.mint(caller, accrued_income)
   - Update: PropertyNFT.set_last_claimed_ledger(current_ledger)
   - Emit: ("claimed", caller, property_id, amount)

3. **get_accrued_income(property_id)** → i128
   - Read-only calculation of pending income

**Constants:**

```rust
EPOCH_LENGTH: u64 = 100
BASE_RENTAL_RATE: i128 = 10 * 10_000_000  // 10 LAND

IMPROVEMENT_COST_RESIDENTIAL: i128 = 200 * 10_000_000
IMPROVEMENT_COST_COMMERCIAL: i128 = 600 * 10_000_000
IMPROVEMENT_COST_SKYSCRAPER: i128 = 1_800 * 10_000_000

MULTIPLIER_VACANT: (1, 1)
MULTIPLIER_RESIDENTIAL: (3, 2)
MULTIPLIER_COMMERCIAL: (3, 1)
MULTIPLIER_SKYSCRAPER: (6, 1)
```

**ECS Systems (for improve):**

```
PreUpdate Stage:
  → Validate ownership via PropertyNFT
Update Stage:
  → Deduct improvement cost via LandToken.burn_from
PostUpdate Stage:
  → Apply improvement via PropertyNFT.set_improvement_level
```

---

## Part 7: Event System & Real-Time Updates

### 7.1 On-Chain Events

Emitted by contracts for indexing and UI updates:

| Event Type  | Emitted By  | Topic Data       | Value  |
| ----------- | ----------- | ---------------- | ------ |
| `transfer`  | PropertyNFT | { from, to, id } | —      |
| `improved`  | GameEngine  | { owner, id }    | level  |
| `claimed`   | GameEngine  | { owner, id }    | amount |
| `listed`    | Marketplace | { seller, id }   | price  |
| `sold`      | Marketplace | { buyer, id }    | price  |
| `cancelled` | Marketplace | { seller, id }   | —      |

### 7.2 Event Indexing (Frontend)

The Next.js app has an event indexer that:

1. Listens to Soroban events via RPC
2. Parses events into game domain objects
3. Updates in-memory state
4. Broadcasts updates to connected clients via SSE (Server-Sent Events)
5. City Map refreshes without page reload

**Real-Time Features:**

- See when other players buy properties (tile color changes)
- See marketplace listings update in real-time
- See improvement notifications
- Live income clock counting toward next epoch

---

## Part 8: Example Scenarios

### Scenario 1: New Player First Hour

```
Time    Action                          LAND Balance    Properties
0:00    Claim faucet                    +1,000          []
0:05    Buy Treasury property #50       -500 (→ 500)    [#50 Vacant]
0:10    Buy Treasury property #75       -500 (→ 0)      [#50 Vacant, #75 Vacant]
        Income starts accruing...
1:35    10 epochs complete
        Accrued income: 20 LAND (10 per property)
        Claim income                    +20 (→ 20)      [#50 Vacant, #75 Vacant]
        Approve + Improve #50 → Residential  -200 (→ -180) [#50 Res, #75 Vacant]
        (Error: insufficient balance!)

        Wait, need to claim more...
2:00    15 epochs completed on #75 (since claim)
        #50: 7 epochs since improvement
        Accrued:
          #50: 7 × 15 = 105 LAND
          #75: 15 × 10 = 150 LAND
          Total: 255 LAND
        Claim income                    +255 (→ 75)
        Approve + Improve #50 → Commercial  -600 (→ -525)
        (Error: still short)

        Wait more...
3:00    Claim accumulated income        +300 (→ -225)
        Actually, better to restart...
```

→ **Lesson:** New players need patience or better initial capital. Faucet amount (1,000 LAND) is tight but playable.

### Scenario 2: Experienced Player Portfolio Growth

```
Time    Actions
0:00    Player has: 5,000 LAND, 8 properties (6 Commercial, 2 Skyscraper)

        Income per epoch:
        6 × Commercial: 6 × 30 = 180 LAND
        2 × Skyscraper: 2 × 60 = 120 LAND
        Total: 300 LAND per 8 minutes

1:00    Claim accumulated income: 300 × 7.5 = 2,250 LAND
        Balance: 7,250 LAND

        Buy marketplace property (listed at 1,200 LAND)
        Balance: 6,050 LAND
        (This was a Residential, now owned)

2:00    Claim income again: 300 × 8 = 2,400 LAND
        Balance: 8,450 LAND

        Improve new property Residential → Commercial: -600
        Balance: 7,850 LAND

3:00    Marketplace opportunity: Find Vacant at 200 LAND (underpriced)
        Buy + Improve to Commercial: -200 - 600 = -800
        Balance: 7,050 LAND

4:00    This new Commercial now earning 30 LAND/epoch

        After ~27 more epochs, the 800 LAND investment pays for itself
        Then pure profit.
```

---

## Part 9: Smart Contract Security & Guarantees

### 9.1 Atomic Transactions

**Marketplace Buy is Atomic:**

```
IF buyer_approved_LAND AND seller_approved_NFT:
    Transfer LAND from buyer → seller
    Transfer NFT from marketplace → buyer
    Remove listing
ELSE:
    Revert all changes (ROLLBACK)
```

→ Impossible for one side to succeed without the other

### 9.2 Authorization Checks

| Function                  | Who Can Call    | Requirement                        |
| ------------------------- | --------------- | ---------------------------------- |
| `transfer`                | Property owner  | `owner.require_auth()`             |
| `improve`                 | Property owner  | GameEngine checks via PropertyNFT  |
| `claim_rental`            | Property owner  | GameEngine checks via PropertyNFT  |
| `list`                    | Marketplace     | Property owner must approve escrow |
| `buy`                     | Marketplace     | Buyer must approve LAND transfer   |
| `set_improvement_level`   | GameEngine only | Contract address check             |
| `set_last_claimed_ledger` | GameEngine only | Contract address check             |

### 9.3 Error Handling

All contracts include error enums with specific codes:

**PropertyNFT:**

- `AlreadyInitialized`, `NotOwner`, `NotApproved`, `InvalidProperty`, `ContractPaused`, `Unauthorized`

**GameEngine:**

- `AlreadyInitialized`, `NotOwner`, `AlreadyMaxLevel`, `NothingToClaim`, `InsufficientBalance`

**Marketplace:**

- `AlreadyInitialized`, `NotOwner`, `NotSeller`, `ListingNotFound`, `InsufficientBalance`, `AlreadyListed`

---

## Part 10: Economics Summary Table

### All Numeric Constants

| Constant                     | Value         | Use                       |
| ---------------------------- | ------------- | ------------------------- |
| City Grid                    | 20 × 20       | 400 properties            |
| Base Rental (Vacant)         | 10 LAND/epoch | Baseline income           |
| Epoch Duration               | 100 ledgers   | ~8 minutes                |
| Ledger Time                  | ~5 seconds    | Stellar parameter         |
| Starter LAND                 | 1,000 LAND    | Faucet per player         |
| Starter Claim                | 1 property    | One-time free claim       |
| Treasury Price               | 500 LAND      | Cost to buy from Treasury |
| Cost: Vacant→Residential     | 200 LAND      | First upgrade             |
| Cost: Residential→Commercial | 600 LAND      | Second upgrade            |
| Cost: Commercial→Skyscraper  | 1,800 LAND    | Max upgrade               |
| Multiplier: Residential      | 1.5×          | Income: 15 LAND/epoch     |
| Multiplier: Commercial       | 3.0×          | Income: 30 LAND/epoch     |
| Multiplier: Skyscraper       | 6.0×          | Income: 60 LAND/epoch     |

### Revenue Per Hour (Sustained Play)

| Level       | Per Property/Hr | 5 Properties/Hr | 10 Properties/Hr |
| ----------- | --------------- | --------------- | ---------------- |
| Vacant      | 75 LAND         | 375 LAND        | 750 LAND         |
| Residential | 112.5 LAND      | 562.5 LAND      | 1,125 LAND       |
| Commercial  | 225 LAND        | 1,125 LAND      | 2,250 LAND       |
| Skyscraper  | 450 LAND        | 2,250 LAND      | 4,500 LAND       |

---

## Part 11: Game State & Persistence

### 11.1 On-Chain State

All game state lives on Soroban contracts:

- Property ownership
- Improvement levels
- Last claim timestamps
- LAND balances
- Marketplace listings

**No off-chain database controls game logic.**

### 11.2 Off-Chain Indexing

Optional backend services:

- Event indexer (parses Soroban events)
- State snapshot cache (for faster UI queries)
- Analytics dashboard

But players can query contracts directly via Quasar clients.

---

## Part 12: Frontend Integration

### 12.1 Quasar Typed Clients

Generated from contract WASM, provides type-safe methods:

```typescript
// Example usage in React
import { GamePropertyNftClient, GameLandTokenClient } from "@akkuea/shared";

const nftClient = new GamePropertyNftClient({ contractId, rpcUrl });
const property = await nftClient.getProperty(propertyId);
const owner = property.owner;
const level = property.level;
```

### 12.2 Wallet Integration (Pollar)

Players authenticate via:

1. Google login or email signup
2. Pollar creates Stellar wallet automatically
3. All transactions signed via Pollar (no manual wallet management)
4. Transaction fees sponsored (players never pay XLM directly)

---

## Appendix: Glossary

- **Epoch:** 100 ledgers (~8 minutes); unit of income accrual
- **Ledger:** Block in Stellar blockchain (~5 seconds)
- **Soroban:** Stellar smart contract platform
- **ECS:** Entity-Component-System (game engine architecture)
- **Cougr:** Rust framework for ECS contracts
- **SEP-41:** Stellar fungible token standard
- **NFT:** Non-fungible token (unique property ownership)
- **Escrow:** Holding asset pending transaction completion
- **Atomic:** Transaction succeeds or fails entirely; no partial states
- **Treasury:** Initial account holding all 400 properties
- **Multiplier:** Income rate increase per improvement level

---

## Document Information

**Status:** Complete summary of Cycle 5 game mechanics
**Created:** May 27, 2026
**Based on:** Cycle 5 planning documents (issues C5-001 through C5-017)
**Target Audience:** Players, developers, designers, documentation writers
**Maintained in:** `/memories/repo/akkuea-game-mechanics.md`
