# Akkuea Land Game Contracts

Complete set of Soroban smart contracts for the Akkuea Land real estate investment game on Stellar.

## Overview

The game consists of four interconnected contracts:

| Contract            | Purpose                                               | Dependencies                   |
| ------------------- | ----------------------------------------------------- | ------------------------------ |
| **GameLandToken**   | SEP-41 fungible token for in-game currency (LAND)     | None                           |
| **GamePropertyNFT** | Property ownership and state (400 NFTs in 20×20 grid) | None                           |
| **GameMarketplace** | P2P property trading with atomic swaps                | GameLandToken, GamePropertyNFT |
| **GameEngine**      | Core rules: improvements, rental income, purchases    | All three above                |

## Deployment Order

1. **GameLandToken** (no dependencies)
2. **GamePropertyNFT** (no dependencies)
3. **GameMarketplace** (depends on 1 & 2)
4. **GameEngine** (depends on 1, 2, & 3)

## Building Contracts

### Prerequisites

```bash
# Install Rust and WASM target
rustup target add wasm32-unknown-unknown

# Verify installation
rustc --version && cargo --version
```

### Build All Contracts

```bash
cd apps/contracts

# Build release version (optimized for WASM)
cargo build --target wasm32-unknown-unknown --release

# Output files:
ls -la target/wasm32-unknown-unknown/release/*.wasm
```

### Build Individual Contract

```bash
# Build specific contract
cargo build --target wasm32-unknown-unknown --release --package game-land-token
cargo build --target wasm32-unknown-unknown --release --package game-property-nft
cargo build --target wasm32-unknown-unknown --release --package game-marketplace
cargo build --target wasm32-unknown-unknown --release --package game-engine
```

### Run Tests

```bash
# Run all contract tests
cargo test

# Run specific contract tests
cargo test -p game-land-token
cargo test -p game-property-nft
cargo test -p game-marketplace
cargo test -p game-engine
```

## Deploying to Testnet

### Quick Deploy (Automated)

```bash
./scripts/deploy-game-contracts.sh testnet
```

This script will:

- Build all contracts
- Deploy in dependency order
- Initialize with correct arguments
- Verify with read-only calls
- Output contract IDs

### Manual Deployment

See [docs/contracts/deployment.md](../../docs/contracts/deployment.md#game-contracts-deployment-cycle-5) for detailed step-by-step instructions.

## Contract APIs

### GameLandToken

**Functions:**

- `initialize(env, admin: Address) -> bool` - Initialize with admin account
- `mint(env, to: Address, amount: i128) -> bool` - Mint tokens (admin only)
- `burn_from(env, from: Address, amount: i128) -> bool` - Burn tokens (admin only)
- `balance_of(env, account: Address) -> i128` - Get account balance
- `total_supply(env) -> i128` - Get total supply
- `faucet(env, account: Address) -> bool` - Claim 1,000 LAND (testnet, once per account)
- `transfer(env, from: Address, to: Address, amount: i128) -> bool` - Transfer tokens

**Decimals:** 7 (1 LAND = 10,000,000 stroops)

### GamePropertyNFT

**Functions:**

- `initialize(env, treasury: Address, game_engine: Address) -> bool` - Mint all 400 properties to treasury
- `get_owner(env, property_id: u32) -> Address` - Get property owner
- `get_property(env, property_id: u32) -> PropertyData` - Get full property state
- `get_coordinates(env, property_id: u32) -> PropertyCoords` - Get (x, y) coordinates
- `transfer(env, property_id: u32, to: Address) -> bool` - Transfer property
- `set_improvement_level(env, property_id: u32, level: u32) -> bool` - Update level (engine only)
- `set_last_claimed_ledger(env, property_id: u32, ledger: u64) -> bool` - Update claim ledger (engine only)
- `set_marketplace(env, marketplace: Address) -> bool` - Register marketplace

**Property Levels:** 0=Vacant, 1=Residential, 2=Commercial, 3=Skyscraper

### GameMarketplace

**Functions:**

- `initialize(env, token_contract: Address, nft_contract: Address) -> bool` - Initialize
- `list(env, seller: Address, property_id: u32, price_land: i128) -> bool` - List property
- `buy(env, buyer: Address, property_id: u32) -> bool` - Buy listed property
- `cancel_listing(env, seller: Address, property_id: u32) -> bool` - Cancel listing
- `get_listing(env, property_id: u32) -> Option<Listing>` - Get listing details
- `get_seller_listings(env, seller: Address) -> Vec<u32>` - Get seller's active listings

### GameEngine

**Functions:**

- `initialize(env, treasury: Address, token_contract: Address, nft_contract: Address) -> bool` - Initialize
- `buy_from_treasury(env, buyer: Address, property_id: u32) -> bool` - Buy property (500 LAND)
- `improve(env, caller: Address, property_id: u32) -> bool` - Improve building
- `claim_rental(env, caller: Address, property_id: u32) -> bool` - Claim rental income
- `get_accrued_income(env, property_id: u32, last_claimed_ledger: u64, level: u32) -> i128` - Calculate income
- `get_improvement_cost(env, current_level: u32) -> i128` - Get upgrade cost
- `approve_property_transfer(env, property_id: u32, to: Address) -> bool` - Approve transfer

## Game Mechanics

### Rental Income Calculation

```
Income per 100 ledgers = BASE_RATE × MULTIPLIER × EPOCHS_ELAPSED

BASE_RATE: 10 LAND
EPOCHS_ELAPSED: (current_ledger - last_claimed_ledger) / 100

Multipliers by level:
  - Vacant (0): 1.0× = 10 LAND per epoch
  - Residential (1): 1.5× = 15 LAND per epoch
  - Commercial (2): 3.0× = 30 LAND per epoch
  - Skyscraper (3): 6.0× = 60 LAND per epoch
```

### Building Improvements

| Target Level             | Cost       |
| ------------------------ | ---------- |
| Vacant → Residential     | 200 LAND   |
| Residential → Commercial | 600 LAND   |
| Commercial → Skyscraper  | 1,800 LAND |

### Property Purchases

**From Treasury:** 500 LAND per property
**From Player:** Set by seller, buyer approves LAND transfer

## Events

All contracts emit events for indexing and frontend updates:

**GameLandToken:**

- `initialized(admin)`
- `mint(to, amount)`
- `burn(from, amount)`
- `faucet_claimed(account, amount)`
- `transfer(from, to, amount)`

**GamePropertyNFT:**

- `initialized(treasury)`
- `transfer(from, to, property_id)`
- `improved(owner, property_id, level)`
- `claimed(owner, property_id, ledger)`
- `marketplace_set(marketplace)`

**GameMarketplace:**

- `initialized("marketplace")`
- `listed(seller, property_id, price)`
- `sold(seller, buyer, property_id, price)`
- `cancelled(seller, property_id)`

**GameEngine:**

- `initialized("game_engine")`
- `property_bought(buyer, property_id, price)`
- `building_improved(caller, property_id, cost)`
- `rental_claimed(caller, property_id)`

## Testing

### Run Unit Tests

```bash
cargo test --all
```

### Integration Testing

After deployment, test contract interactions:

```bash
# Test faucet claim
stellar contract invoke \
  --network testnet \
  --contract-id $TOKEN_ID \
  --function faucet \
  --arg "$PLAYER_ADDRESS"

# Test property ownership query
stellar contract invoke \
  --network testnet \
  --contract-id $NFT_ID \
  --function get_owner \
  --arg 0

# Test income calculation
stellar contract invoke \
  --network testnet \
  --contract-id $ENGINE_ID \
  --function get_accrued_income \
  --arg 0 \
  --arg 0 \
  --arg 0
```

## Verification Checklist

After deployment:

- [ ] All contract IDs recorded (start with 'C')
- [ ] GameLandToken.total_supply() works
- [ ] GamePropertyNFT.get_owner(0) returns treasury
- [ ] GameMarketplace.get_listing(0) handles empty listings
- [ ] GameEngine.get_improvement_cost(0) returns 200000000
- [ ] Contract IDs saved in game-contracts.testnet.json
- [ ] .env variables updated
- [ ] CI workflows pass

## Game Constants

**Grid:** 20 × 20 = 400 properties
**Property IDs:** 0-399 (calculated as `y * 20 + x`)

**Epoch:** 100 ledgers (~8 minutes)
**Token Decimals:** 7

**Faucet:** 1,000 LAND per player (testnet only)
**Treasury Price:** 500 LAND per property
**Marketplace:** Player-set prices with atomic swaps

## References

- [Soroban Documentation](https://soroban.stellar.org/)
- [SEP-41 Token Standard](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-01.md)
- [Game Mechanics Guide](../../GAME_MECHANICS_SUMMARY.md)
- [Deployment Guide](../../docs/contracts/deployment.md)

## Development

### Structure

```
apps/contracts/
├── contracts/
│   ├── defi-rwa/              # Real estate DeFi contracts
│   ├── game-land-token/       # LAND token contract
│   ├── game-property-nft/     # Property NFT contract
│   ├── game-marketplace/      # Marketplace contract
│   └── game-engine/           # Game engine contract
├── Cargo.toml                 # Workspace root
└── Cargo.lock
```

### Adding New Contracts

1. Create directory: `contracts/my-contract/`
2. Add to workspace in root `Cargo.toml` (auto-discovered)
3. Create `src/lib.rs` with contract code
4. Build and test locally
5. Add deployment steps to scripts

## Support

For issues or questions:

- Check [Soroban docs](https://soroban.stellar.org/)
- Review game mechanics in [GAME_MECHANICS_SUMMARY.md](../../GAME_MECHANICS_SUMMARY.md)
- See deployment troubleshooting in [deployment.md](../../docs/contracts/deployment.md)
