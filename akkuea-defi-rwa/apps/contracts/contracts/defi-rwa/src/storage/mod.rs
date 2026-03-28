use soroban_sdk::{contracttype, Address};

#[contracttype]
pub enum DataKey {
    Admin,
    Property(u64),
    Shares(u64, Address),
    DistCount(u64),
    Dist(u64, u32),
    Claimed(u64, u32, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyInfo {
    pub id: u64,
    pub admin: Address,
    pub total_shares: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Distribution {
    pub id: u32,
    pub property_id: u64,
    pub total_amount: i128,
    pub period: u64,
    pub total_shares: u32,
    pub claimed_amount: i128,
}
