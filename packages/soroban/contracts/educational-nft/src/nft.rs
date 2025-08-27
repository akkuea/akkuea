use soroban_sdk::{contracttype, panic_with_error, Address, Bytes, Env, Map, String};
use stellar_tokens::non_fungible::{Base, ContractOverrides};

use crate::utils::NFTError;

/// Core Educational NFT data structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EducationalNFT {
    pub token_id: u64,        // Unique identifier for the NFT
    pub owner: Address,       // Stellar address of the current owner
    pub collection_id: u64,   // Identifier for the NFT collection
    pub fractions: u32,       // Number of ownership fractions (0 if non-fractional)
    pub metadata_hash: Bytes, // Hash of metadata stored on IPFS/Arweave
}

/// Fractional ownership data structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FractionalOwnership {
    /// Map of owners to their fraction amounts
    pub fraction_owners: Map<Address, u32>,
    /// Minimum fractions required for ownership decisions
    pub min_decision_threshold: u32,
}

/// Utility functions for fractional ownership
impl FractionalOwnership {
    pub fn new(env: &Env, total_fractions: u32, initial_owner: &Address) -> Self {
        let mut fraction_owners = Map::new(env);
        fraction_owners.set(initial_owner.clone(), total_fractions);

        Self {
            fraction_owners,
            min_decision_threshold: (total_fractions / 2) + 1, // Majority required
        }
    }

    /// Transfer fractions between owners
    pub fn transfer_fractions(
        &mut self,
        from: &Address,
        to: &Address,
        amount: u32,
    ) -> Result<(), NFTError> {
        let from_balance = self.fraction_owners.get(from.clone()).unwrap_or(0);

        if from_balance < amount {
            return Err(NFTError::InsufficientFractions);
        }

        // Update balances
        let new_from_balance = from_balance - amount;
        if new_from_balance == 0 {
            self.fraction_owners.remove(from.clone());
        } else {
            self.fraction_owners.set(from.clone(), new_from_balance);
        }

        let to_balance = self.fraction_owners.get(to.clone()).unwrap_or(0);
        self.fraction_owners.set(to.clone(), to_balance + amount);

        Ok(())
    }

    /// Get fraction balance for an owner
    pub fn get_balance(&self, owner: &Address) -> u32 {
        self.fraction_owners.get(owner.clone()).unwrap_or(0)
    }

    /// Check if an address has enough fractions for decision making
    pub fn can_make_decisions(&self, owner: &Address) -> bool {
        let balance = self.get_balance(owner);
        balance >= self.min_decision_threshold
    }
}

/// Storage keys for NFT data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    EducationalNFT(u64),      // token_id -> EducationalNFT
    NextTokenId,              // Counter for token IDs
    CollectionTokens(u64),    // collection_id -> Vec<u64> of token IDs
    FractionalOwners(u64),    // token_id -> FractionalOwnership
    EducatorVerificationAddr, // Address of the educator verification contract
}

pub struct EducationalNFTStorage;

impl EducationalNFTStorage {
    pub fn sequential_mint(e: &Env, to: &Address) {
        Base::sequential_mint(e, to);
    }
}

/// Implementation of ContractOverrides trait for EducationalNFTStorage
impl ContractOverrides for EducationalNFTStorage {
    fn balance(e: &Env, owner: &Address) -> u32 {
        Base::balance(e, owner)
    }

    fn owner_of(e: &Env, token_id: u32) -> Address {
        Base::owner_of(e, token_id)
    }

    fn transfer(e: &Env, from: &Address, to: &Address, token_id: u32) {
        let nft_data = get_educational_nft_safe(e, token_id as u64).unwrap();

        if nft_data.fractions > 0 {
            let fractional_ownership = get_fractional_ownership_safe(e, token_id as u64).unwrap();
            if !fractional_ownership.can_make_decisions(from) {
                panic_with_error!(e, NFTError::InsufficientFractionsForTransfer);
            }
        } else {
            // For non-fractional NFTs, only the owner can transfer
            if nft_data.owner != *from {
                panic_with_error!(e, NFTError::NotOwner);
            }
        }

        let mut updated_nft_data = nft_data;
        updated_nft_data.owner = to.clone();
        store_educational_nft(e, token_id as u64, &updated_nft_data);

        Base::transfer(e, from, to, token_id);
    }

    // For further ERC721 implementation in future
    fn transfer_from(_e: &Env, _spender: &Address, _from: &Address, _to: &Address, _token_id: u32) {
        // Base::transfer_from(_e, _spender, _from, _to, _token_id);
    }

    fn approve(
        _e: &Env,
        _approver: &Address,
        _approved: &Address,
        _token_id: u32,
        _live_until_ledger: u32,
    ) {
        // Base::approve(_e, _approver, _approved, _token_id, _live_until_ledger);
    }

    fn approve_for_all(_e: &Env, _owner: &Address, _operator: &Address, _live_until_ledger: u32) {
        // Base::approve_for_all(_e, _owner, _operator, _live_until_ledger);
    }

    fn get_approved(e: &Env, token_id: u32) -> Option<Address> {
        Base::get_approved(e, token_id)
    }

    fn is_approved_for_all(e: &Env, owner: &Address, operator: &Address) -> bool {
        Base::is_approved_for_all(e, owner, operator)
    }

    fn name(e: &Env) -> String {
        Base::name(e)
    }

    fn symbol(e: &Env) -> String {
        Base::symbol(e)
    }

    fn token_uri(e: &Env, token_id: u32) -> String {
        Base::token_uri(e, token_id)
    }
}

/// Fractionalize an NFT
pub fn fractionalize_nft(e: &Env, token_id: u64, caller: &Address) -> Result<(), NFTError> {
    // Check if NFT exists and get current data
    let nft_data = get_educational_nft_safe(e, token_id)?;

    // Check if caller is the owner
    if nft_data.owner != *caller {
        return Err(NFTError::NotOwner);
    }

    // Check if NFT was minted as non-fractional (fractions = 0)
    if nft_data.fractions == 0 {
        return Err(NFTError::InvalidFractions);
    }

    // Check if already fractionalized (fractional ownership already exists)
    if get_fractional_ownership_safe(e, token_id).is_ok() {
        return Err(NFTError::AlreadyFractionalized);
    }

    // Create fractional ownership structure with the fractions specified during minting
    let fractional_ownership = FractionalOwnership::new(e, nft_data.fractions, caller);
    store_fractional_ownership(e, token_id, &fractional_ownership);

    Ok(())
}

/// Transfer fractions between owners
pub fn transfer_fractions(
    e: &Env,
    token_id: u64,
    from: &Address,
    to: &Address,
    amount: u32,
) -> Result<(), NFTError> {
    // Validate inputs
    if amount == 0 {
        return Err(NFTError::InvalidFractionAmount);
    }

    // Check if NFT is fractionalized
    let mut fractional_ownership = get_fractional_ownership_safe(e, token_id)?;

    // Transfer fractions
    fractional_ownership.transfer_fractions(from, to, amount)?;

    // Store updated ownership data
    store_fractional_ownership(e, token_id, &fractional_ownership);

    Ok(())
}

/// Get fraction balance for a specific owner
pub fn get_fraction_balance(e: &Env, token_id: u64, owner: &Address) -> Result<u32, NFTError> {
    let fractional_ownership = get_fractional_ownership_safe(e, token_id)?;
    Ok(fractional_ownership.get_balance(owner))
}

/// Store educational NFT data
pub fn store_educational_nft(e: &Env, token_id: u64, nft: &EducationalNFT) {
    let key = DataKey::EducationalNFT(token_id);
    e.storage().instance().set(&key, nft);
}

/// Get educational NFT data safely (returns Result)
pub fn get_educational_nft_safe(e: &Env, token_id: u64) -> Result<EducationalNFT, NFTError> {
    let key = DataKey::EducationalNFT(token_id);
    e.storage()
        .instance()
        .get(&key)
        .ok_or(NFTError::TokenNotFound)
}

/// Store fractional ownership data
pub fn store_fractional_ownership(e: &Env, token_id: u64, ownership: &FractionalOwnership) {
    let key = DataKey::FractionalOwners(token_id);
    e.storage().instance().set(&key, ownership);
}

/// Get fractional ownership data safely
pub fn get_fractional_ownership_safe(
    e: &Env,
    token_id: u64,
) -> Result<FractionalOwnership, NFTError> {
    let key = DataKey::FractionalOwners(token_id);
    e.storage()
        .instance()
        .get(&key)
        .ok_or(NFTError::NotFractionalized)
}

/// Store educator verification contract address
pub fn store_educator_verification_address(e: &Env, address: &Address) {
    let key = DataKey::EducatorVerificationAddr;
    e.storage().instance().set(&key, address);
}

/// Get educator verification contract address safely
pub fn get_educator_verification_address_safe(e: &Env) -> Result<Address, NFTError> {
    let key = DataKey::EducatorVerificationAddr;
    e.storage()
        .instance()
        .get(&key)
        .ok_or(NFTError::ContractNotInitialized)
}
