use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // General errors
    InvalidAmount = 1,
    InsufficientBalance = 2,
    Unauthorized = 3,

    // Reward-specific errors
    InvalidRewardType = 10,
    RewardThresholdNotMet = 11,
    DuplicateReward = 12,

    // Balance errors
    BalanceNotFound = 20,
    BalanceUpdateFailed = 21,

    // Event errors
    EventEmissionFailed = 30,
}
