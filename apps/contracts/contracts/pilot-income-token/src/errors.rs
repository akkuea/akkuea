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
    /// `transfer_admin_accept` was called by an address that does not match
    /// the pending admin recorded by `transfer_admin_start`, or no transfer
    /// is pending at all.
    NotPendingAdmin = 15,
    /// A state-changing call was rejected because the contract is paused.
    ContractPaused = 16,
}
