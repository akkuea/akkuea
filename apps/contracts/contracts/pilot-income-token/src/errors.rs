use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum IncomeTokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AlreadyMinted = 4,
    EmptyHolderSet = 5,
    HolderAmountLengthMismatch = 6,
    InvalidAmount = 7,
    HolderNotApproved = 8,
    BalanceOverflow = 9,
    SupplyOverflow = 10,
    InsufficientBalance = 11,
    InternalInvariant = 12,
}
