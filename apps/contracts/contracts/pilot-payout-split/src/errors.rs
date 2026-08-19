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
}
