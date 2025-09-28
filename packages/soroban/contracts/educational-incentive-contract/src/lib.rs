#![no_std]
use soroban_sdk::contract;

mod balance;
mod datatype;
mod error;
mod events;
mod interface;
mod reward;

pub use balance::*;
pub use datatype::*;
pub use error::*;
pub use events::*;
pub use interface::*;
pub use reward::*;

#[contract]
pub struct RewardSystem;

mod test;
