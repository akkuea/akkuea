# C5-004: Implement LandToken Fungible Token Contract

## Issue Metadata

| Attribute       | Value             |
| --------------- | ----------------- |
| Issue ID        | C5-004            |
| Area            | CONTRACTS         |
| Difficulty      | Medium            |
| Labels          | contracts, medium |
| Dependencies    | C5-002            |
| Estimated Lines | 200-300           |

## SEP-41 Interface

The LandToken contract implements the full SEP-41 fungible token interface. The function signatures match the Stellar token spec exactly so that wallets and DEXes can interact with it without custom integration.

### Entry Points

```rust
#[contractimpl]
impl GameLandToken {
    pub fn initialize(env: Env, admin: Address, testnet_mode: bool);
    pub fn mint(env: Env, to: Address, amount: i128);
    pub fn burn(env: Env, from: Address, amount: i128);
    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128);
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128);
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128);
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32);
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128;
    pub fn balance(env: Env, id: Address) -> i128;
    pub fn spendable_balance(env: Env, id: Address) -> i128;
    pub fn authorized(env: Env, id: Address) -> bool;
    pub fn set_authorized(env: Env, id: Address, authorize: bool);
    pub fn decimals(env: Env) -> u32;
    pub fn name(env: Env) -> soroban_sdk::String;
    pub fn symbol(env: Env) -> soroban_sdk::String;
    pub fn faucet(env: Env, recipient: Address);
}
```

### Token Parameters

| Parameter | Value               |
| --------- | ------------------- |
| Name      | "Akkuea Land Token" |
| Symbol    | "LAND"              |
| Decimals  | 7                   |

### Faucet Implementation

The faucet mints 1,000 LAND (stored as `1_000 * 10_000_000` = `10_000_000_000` stroop-equivalent units given 7 decimals) to the recipient. It rejects a second call from the same address.

```rust
const FAUCET_AMOUNT: i128 = 10_000_000_000;
const FAUCET_KEY: Symbol = symbol_short!("FAUCET");

pub fn faucet(env: Env, recipient: Address) {
    recipient.require_auth();

    let testnet_mode: bool = env.storage().instance().get(&symbol_short!("TESTNET")).unwrap_or(false);
    if !testnet_mode {
        panic_with_error!(&env, TokenError::FaucetDisabled);
    }

    let mut claimed: Map<Address, bool> = env
        .storage()
        .instance()
        .get(&FAUCET_KEY)
        .unwrap_or(Map::new(&env));

    if claimed.get(recipient.clone()).unwrap_or(false) {
        panic_with_error!(&env, TokenError::FaucetAlreadyClaimed);
    }

    claimed.set(recipient.clone(), true);
    env.storage().instance().set(&FAUCET_KEY, &claimed);

    // mint FAUCET_AMOUNT to recipient
    Self::internal_mint(&env, &recipient, FAUCET_AMOUNT);
}
```

### Error Enum

```rust
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum TokenError {
    AlreadyInitialized = 1,
    InsufficientBalance = 2,
    InsufficientAllowance = 3,
    FaucetDisabled = 4,
    FaucetAlreadyClaimed = 5,
    Unauthorized = 6,
}
```

### Required Tests

- `initialize_sets_name_and_symbol`
- `mint_increases_balance`
- `transfer_moves_balance`
- `transfer_from_requires_approval`
- `faucet_mints_starter_allocation`
- `faucet_rejects_second_claim`
- `faucet_disabled_on_mainnet_mode`
- `mint_unauthorized_fails`

## Definition of Done

- All SEP-41 functions implemented.
- `faucet` enforces one-claim-per-address on-chain.
- All required tests pass.
- `stellar contract build` produces a valid WASM artifact.
- All CI workflows pass on the pull request.
