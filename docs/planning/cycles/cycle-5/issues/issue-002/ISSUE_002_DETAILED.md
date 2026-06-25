# C5-002: Bootstrap Game Contracts Cargo Workspace

## Issue Metadata

| Attribute       | Value              |
| --------------- | ------------------ |
| Issue ID        | C5-002             |
| Area            | CONTRACTS          |
| Difficulty      | Trivial            |
| Labels          | contracts, trivial |
| Dependencies    | None               |
| Estimated Lines | 60-100             |

## Directory Structure

Create the following directories under `apps/contracts/contracts/`:

```
game-property-nft/
  Cargo.toml
  src/
    lib.rs
game-land-token/
  Cargo.toml
  src/
    lib.rs
game-marketplace/
  Cargo.toml
  src/
    lib.rs
game-engine/
  Cargo.toml
  src/
    lib.rs
```

## Cargo.toml for Each Contract

Each contract's `Cargo.toml` follows this pattern (substitute the contract name):

```toml
[package]
name = "game-property-nft"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "25.1.0", features = [] }
cougr-core = "1.0.0"

[dev-dependencies]
soroban-sdk = { version = "25.1.0", features = ["testutils"] }
cougr-core = { version = "1.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
lto = true
codegen-units = 1
```

## Stub lib.rs

Each stub `lib.rs` should be minimal but valid:

```rust
#![no_std]

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct GamePropertyNft;

#[contractimpl]
impl GamePropertyNft {
    pub fn version(_env: Env) -> u32 {
        1
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn version_returns_one() {
        let env = Env::default();
        let client = GamePropertyNftClient::new(&env, &env.register(GamePropertyNft, ()));
        assert_eq!(client.version(), 1);
    }
}
```

## Workspace Registration

Add all four crates to `apps/contracts/Cargo.toml`:

```toml
[workspace]
members = [
  "contracts/defi-rwa",
  "contracts/game-property-nft",
  "contracts/game-land-token",
  "contracts/game-marketplace",
  "contracts/game-engine",
]
```

## Verification

Run these commands from `apps/contracts/` to confirm everything builds:

```bash
cargo build --target wasm32v1-none --release
cargo test
```

Both must pass without warnings for all four new crates.

## Definition of Done

- Four contract directories exist with valid `Cargo.toml` and stub `lib.rs`.
- All four are registered in the workspace.
- `cargo build` and `cargo test` pass.
- All CI workflows pass on the pull request.
