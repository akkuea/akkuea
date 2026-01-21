use soroban_sdk::{contracttype, Symbol, Address};

/// Storage keys for the property tokenization contract
///
/// This enum defines unique storage keys to prevent collisions and organize
/// contract data efficiently. Each key type corresponds to a specific data
/// structure stored on-chain.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    /// Token configuration (symbol, name, decimals)
    /// Single instance per contract
    TokenConfig,

    /// Property metadata indexed by property ID
    /// Key: PropertyMetadata(property_id)
    Property(u64),

    /// Share balance for a specific account and property
    /// Key: ShareBalance(property_id, owner_address)
    ShareBalance(u64, Address),

    /// Total shares issued for a property
    /// Key: TotalShares(property_id)
    TotalShares(u64),

    /// Admin address with special permissions
    /// Single instance per contract
    Admin,

    /// Property counter to generate unique property IDs
    /// Single instance per contract
    PropertyCounter,
}

impl StorageKey {
    /// Returns a symbolic name for the storage key type
    /// Useful for debugging and logging
    pub fn as_symbol(&self) -> Symbol {
        match self {
            StorageKey::TokenConfig => Symbol::new(&soroban_sdk::Env::default(), "TknCfg"),
            StorageKey::Property(_) => Symbol::new(&soroban_sdk::Env::default(), "Prop"),
            StorageKey::ShareBalance(_, _) => Symbol::new(&soroban_sdk::Env::default(), "Share"),
            StorageKey::TotalShares(_) => Symbol::new(&soroban_sdk::Env::default(), "TotShrs"),
            StorageKey::Admin => Symbol::new(&soroban_sdk::Env::default(), "Admin"),
            StorageKey::PropertyCounter => Symbol::new(&soroban_sdk::Env::default(), "PropCnt"),
        }
    }
}
