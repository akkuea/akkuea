# C5-003: Implement PropertyNFT Soroban Contract with Cougr

## Issue Metadata

| Attribute       | Value           |
| --------------- | --------------- |
| Issue ID        | C5-003          |
| Area            | CONTRACTS       |
| Difficulty      | High            |
| Labels          | contracts, high |
| Dependencies    | C5-001, C5-002  |
| Estimated Lines | 300-450         |

## Contract Architecture

The PropertyNFT contract stores all game state in a Cougr `SimpleWorld`. Each property tile is an ECS entity with three components.

### Components

```rust
use cougr_core::impl_component;

impl_component!(PropertyCoords { x: u32, y: u32 });
impl_component!(PropertyOwner { address: soroban_sdk::Address });
impl_component!(PropertyMeta {
    level: u32,           // 0=vacant, 1=residential, 2=commercial, 3=skyscraper
    last_claimed_ledger: u64,
    approved_spender: u32 // entity id of approved address, 0 if none
});
```

Property IDs are integers from 0 to 399. The mapping from `(x, y)` to ID is `y * 20 + x`.

### Storage Model

Store the `SimpleWorld` state under a single `Symbol` key. Store the `treasury_address` and `paused` flag as instance storage entries. Store approvals per property in a `Map<u32, Address>` (property id to approved spender).

### Entry Points

```rust
#[contractimpl]
impl GamePropertyNft {
    pub fn initialize(env: Env, treasury: Address);
    pub fn transfer(env: Env, from: Address, to: Address, property_id: u32);
    pub fn approve(env: Env, owner: Address, spender: Address, property_id: u32);
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, property_id: u32);
    pub fn get_property(env: Env, property_id: u32) -> PropertyState;
    pub fn get_owner(env: Env, property_id: u32) -> Address;
    pub fn list_by_owner(env: Env, owner: Address) -> soroban_sdk::Vec<u32>;
    pub fn set_improvement_level(env: Env, caller: Address, property_id: u32, level: u32);
    pub fn set_last_claimed_ledger(env: Env, caller: Address, property_id: u32, ledger: u64);
    pub fn pause(env: Env, admin: Address);
    pub fn unpause(env: Env, admin: Address);
}
```

`set_improvement_level` and `set_last_claimed_ledger` must only be callable by the GameEngine contract address, stored in instance storage during `initialize`.

### Events

Emit events with `env.events().publish` for every state change:

| Topic        | Data                                            |
| ------------ | ----------------------------------------------- |
| `"transfer"` | `{ from: Address, to: Address, id: u32 }`       |
| `"approve"`  | `{ owner: Address, spender: Address, id: u32 }` |
| `"improved"` | `{ owner: Address, id: u32, level: u32 }`       |

### Error Enum

```rust
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum NftError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    NotApproved = 3,
    InvalidProperty = 4,
    ContractPaused = 5,
    Unauthorized = 6,
}
```

### Cougr Standards

Use Cougr's `Ownable` to protect `initialize`:

```rust
use cougr_core::ops::Ownable;

// In initialize:
Ownable::initialize(&env, &treasury);
Ownable::only_owner(&env, &caller)?;
```

Use `Pausable` to protect mutating entry points:

```rust
use cougr_core::ops::Pausable;

// In transfer:
Pausable::when_not_paused(&env)?;
```

### Tests

Test file at `src/test.rs`. Required test cases:

- `initialize_mints_all_400_properties`
- `transfer_from_treasury_succeeds`
- `transfer_fails_if_not_owner`
- `approve_then_transfer_from_succeeds`
- `transfer_from_fails_without_approval`
- `set_improvement_level_fails_if_not_game_engine`
- `pause_blocks_transfer`

## Definition of Done

- All entry points implemented and tested.
- Events emitted for every state-changing operation.
- `cargo test` passes with all test cases above.
- `stellar contract build` produces a valid WASM artifact.
- All CI workflows pass on the pull request.
