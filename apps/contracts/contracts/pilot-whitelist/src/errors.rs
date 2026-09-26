use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WhitelistError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    /// `transfer_admin_accept` was called by an address that does not match
    /// the pending admin recorded by `transfer_admin_start`, or no transfer
    /// is pending at all.
    NotPendingAdmin = 4,
    /// A state-changing call was rejected because the contract is paused.
    ContractPaused = 5,
}
