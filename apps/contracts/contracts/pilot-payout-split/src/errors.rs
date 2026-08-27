use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PayoutError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ContractPaused = 4,
    InvalidEvidenceHash = 5,
    MissingEvidenceLink = 6,
    ZeroAmount = 7,
    CycleAlreadyRecorded = 8,
    CycleNotRecorded = 9,
    CycleAlreadyDistributed = 10,
    EmptyHolderSet = 11,
    RecipientNotApproved = 12,
    ArithmeticOverflow = 13,
    InsufficientPayoutBalance = 14,
    Reentrancy = 15,
    InternalInvariant = 16,
    SignerCollision = 17,
    /// A per-holder swap leg failed at the external venue (illiquidity, venue error).
    /// The leg is rejected for that holder only; other holders are unaffected.
    SwapFailed = 18,
    /// The swap delivered less than the signed minimum-received bound.
    SlippageExceeded = 19,
    /// EURC/swap-router configuration is missing or inconsistent.
    RouterNotConfigured = 20,
    /// A cycle with EURC-preference holders was executed without a positive
    /// minimum exchange rate bound.
    InvalidMinRate = 21,
    /// The ally/property relationship has been permanently terminated via
    /// `exit`; evidence recording and distribution execution are rejected
    /// forever after. Distinct from `ContractPaused`, which is reversible.
    ContractExited = 22,
    /// `exit` was invoked without a non-empty reason string.
    MissingExitReason = 23,
}
