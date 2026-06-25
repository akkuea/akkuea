# C5-006: Implement GameEngine Contract with Cougr ECS

## Issue Metadata

| Attribute       | Value           |
| --------------- | --------------- |
| Issue ID        | C5-006          |
| Area            | CONTRACTS       |
| Difficulty      | High            |
| Labels          | contracts, high |
| Dependencies    | C5-003, C5-004  |
| Estimated Lines | 300-450         |

## Constants Module

Create `src/constants.rs`:

```rust
pub const EPOCH_LENGTH: u64 = 100;
pub const BASE_RENTAL_RATE: i128 = 10 * 10_000_000; // 10 LAND per epoch (7 decimals)

pub const IMPROVEMENT_COST_RESIDENTIAL: i128 = 200 * 10_000_000;
pub const IMPROVEMENT_COST_COMMERCIAL: i128 = 600 * 10_000_000;
pub const IMPROVEMENT_COST_SKYSCRAPER: i128 = 1_800 * 10_000_000;

// Rental multipliers as integer ratios (numerator, denominator)
pub const MULTIPLIER_VACANT: (i128, i128) = (1, 1);
pub const MULTIPLIER_RESIDENTIAL: (i128, i128) = (3, 2); // 1.5x
pub const MULTIPLIER_COMMERCIAL: (i128, i128) = (3, 1);  // 3x
pub const MULTIPLIER_SKYSCRAPER: (i128, i128) = (6, 1);  // 6x

pub const LEVEL_VACANT: u32 = 0;
pub const LEVEL_RESIDENTIAL: u32 = 1;
pub const LEVEL_COMMERCIAL: u32 = 2;
pub const LEVEL_SKYSCRAPER: u32 = 3;
```

## Rental Income Calculation

```rust
pub fn calculate_accrued_income(
    current_ledger: u64,
    last_claimed_ledger: u64,
    level: u32,
) -> i128 {
    let epochs_elapsed = (current_ledger - last_claimed_ledger) / EPOCH_LENGTH;
    if epochs_elapsed == 0 {
        return 0;
    }

    let (num, den) = match level {
        LEVEL_RESIDENTIAL => MULTIPLIER_RESIDENTIAL,
        LEVEL_COMMERCIAL => MULTIPLIER_COMMERCIAL,
        LEVEL_SKYSCRAPER => MULTIPLIER_SKYSCRAPER,
        _ => MULTIPLIER_VACANT,
    };

    (BASE_RENTAL_RATE * num / den) * epochs_elapsed as i128
}
```

This uses integer division. Partial epochs do not generate income.

## ECS Systems via GameApp

```rust
use cougr_core::app::{named_system, GameApp, ScheduleStage};

fn build_improve_app(env: &Env, caller: Address, property_id: u32, target_level: u32) -> GameApp {
    let mut app = GameApp::new(env);

    app.add_systems((
        named_system("validate_ownership", move |world, env| {
            // read property from NFT contract, confirm caller is owner
        })
        .in_stage(ScheduleStage::PreUpdate),

        named_system("deduct_improvement_cost", move |world, env| {
            // read current level, determine cost, call token.burn_from
        })
        .in_stage(ScheduleStage::Update),

        named_system("apply_improvement", move |world, env| {
            // call nft.set_improvement_level
        })
        .in_stage(ScheduleStage::PostUpdate),
    ));

    app
}
```

For simpler entry points like `claim_rental`, you may call the NFT and token clients directly without a full GameApp if the logic is a single step. Use GameApp for multi-step flows where system ordering matters.

## Entry Points

```rust
#[contractimpl]
impl GameEngine {
    pub fn initialize(
        env: Env,
        nft_contract: Address,
        token_contract: Address,
        treasury: Address,
    );

    pub fn improve(env: Env, caller: Address, property_id: u32);

    pub fn claim_rental(env: Env, caller: Address, property_id: u32);

    pub fn get_accrued_income(env: Env, property_id: u32) -> i128;
}
```

### improve Implementation

1. Verify caller owns `property_id` via `nft.get_owner`.
2. Read current level from `nft.get_property`.
3. Verify level is not already Skyscraper.
4. Calculate improvement cost for next level.
5. Burn cost from caller via `token.burn_from` (caller must have approved GameEngine).
6. Call `nft.set_improvement_level(caller, property_id, next_level)`.
7. Emit event: `(symbol_short!("improved"), caller, property_id, next_level)`.

### claim_rental Implementation

1. Verify caller owns `property_id`.
2. Read `last_claimed_ledger` and `level` from `nft.get_property`.
3. Calculate accrued income with `calculate_accrued_income`.
4. If income is zero, return early.
5. Call `token.mint(caller, income)`.
6. Call `nft.set_last_claimed_ledger(caller, property_id, current_ledger)`.
7. Emit event: `(symbol_short!("claimed"), caller, property_id, income)`.

## Error Enum

```rust
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EngineError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    AlreadyMaxLevel = 3,
    NothingToClaim = 4,
    InsufficientBalance = 5,
}
```

## Required Tests

- `improve_vacant_to_residential_succeeds`
- `improve_skyscraper_fails_already_max`
- `improve_fails_if_not_owner`
- `improve_deducts_correct_cost`
- `claim_rental_vacant_property`
- `claim_rental_skyscraper_multiplier`
- `claim_rental_fails_if_not_owner`
- `get_accrued_income_returns_correct_amount`
- `rental_accumulates_across_multiple_epochs`

## Definition of Done

- All entry points implemented using integer arithmetic for economic calculations.
- GameApp ECS used for the `improve` flow.
- All required tests pass.
- `stellar contract build` succeeds.
- All CI workflows pass on the pull request.
