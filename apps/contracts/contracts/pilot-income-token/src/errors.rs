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
    /// The pilot has already been marked wound down; the marker is one-way.
    AlreadyWoundDown = 13,
    /// `mark_wound_down` was invoked without a non-empty reason string.
    MissingWoundDownReason = 14,
}
