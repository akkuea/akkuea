use crate::utils::emit_transfer_event;
use crate::{nft, utils::NFTError, Base, MockEducatorVerificationNft};
use soroban_sdk::{contracttype, log, symbol_short, Address, Bytes, Env, String, Symbol, Vec};
use stellar_tokens::non_fungible::{emit_transfer, ContractOverrides};

const BATCH_COUNTER_KEY: Symbol = symbol_short!("bat_cnt");
const BATCH_OPS_PREFIX: Symbol = symbol_short!("bat_op");
const BATCH_EVENT: Symbol = symbol_short!("batch");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct BatchOperation {
    operation_id: u64,       // Unique identifier for the batch
    operation_type: String,  // Mint, Transfer, Query
    token_ids: Vec<u64>,     // List of affected NFT token IDs
    status: OperationStatus, // Pending, Completed, Failed
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OperationStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchEventData {
    pub operation_id: u64,
    pub op_type: String,
    pub status: OperationStatus,
}

pub fn emit_batch_event(env: &Env, operation_id: u64, op_type: &String, status: OperationStatus) {
    let event_data = BatchEventData {
        operation_id,
        op_type: op_type.clone(),
        status,
    };
    env.events().publish((BATCH_EVENT,), event_data);
}

fn get_next_batch_id(e: &Env) -> u64 {
    let key = BATCH_COUNTER_KEY;
    let id: u64 = e.storage().instance().get(&key).unwrap_or(0u64);
    e.storage().instance().set(&key, &(id + 1));
    id + 1
}

fn store_batch_operation(e: &Env, op: &BatchOperation) {
    let key = (BATCH_OPS_PREFIX, &op.operation_id);
    e.storage().persistent().set(&key, op);
}

pub fn batch_mint_nfts(
    e: &Env,
    caller: Address,
    owners: Vec<Address>,
    collection_id: u64,
    fractions: u32,
    metadata_hashes: Vec<Bytes>,
) -> Result<Vec<u32>, NFTError> {
    if owners.len() != metadata_hashes.len() {
        return Err(NFTError::InvalidFractionAmount);
    }
    let op_id = get_next_batch_id(e);
    let mut minted_token_ids: Vec<u32> = Vec::new(e);
    let mut token_ids_u64: Vec<u64> = Vec::new(e);
    for i in 0..owners.len() {
        let owner = owners.get(i).unwrap();
        let is_verified = MockEducatorVerificationNft::verify_educator(e.clone(), owner.clone());
        if !is_verified {
            return Err(NFTError::Unauthorized);
        }
        let token_id = Base::sequential_mint(e, &owner);
        let nft_data = nft::EducationalNFT {
            token_id: token_id as u64,
            owner: owner.clone(),
            collection_id,
            fractions,
            metadata_hash: metadata_hashes.get(i).unwrap().clone(),
        };
        nft::store_educational_nft(e, nft_data.token_id, &nft_data);
        crate::utils::emit_mint_event(
            e,
            nft_data.token_id,
            &owner,
            collection_id,
            fractions,
            &nft_data.metadata_hash,
        );
        minted_token_ids.push_back(token_id);
        token_ids_u64.push_back(token_id as u64)
    }
    // let token_ids_u64: Vec<u64> = minted_token_ids.iter().map(|id| id as u64).collect();
    let batch_op = BatchOperation {
        operation_id: op_id,
        operation_type: String::from_str(e, "Mint"),
        token_ids: token_ids_u64,
        status: OperationStatus::Completed,
    };
    store_batch_operation(e, &batch_op);
    emit_batch_event(
        e,
        op_id,
        &String::from_str(e, "Mint"),
        OperationStatus::Completed,
    );
    Ok(minted_token_ids)
}

pub fn batch_transfer_nfts(
    e: &Env,
    caller: &Address,
    token_ids: Vec<u64>,
    recipients: Vec<Address>,
) -> Result<(), NFTError> {
    if token_ids.len() != recipients.len() {
        return Err(NFTError::InvalidFractionAmount);
    }
    let is_verified = MockEducatorVerificationNft::verify_educator(e.clone(), caller.clone());
    if !is_verified {
        return Err(NFTError::Unauthorized);
    }
    let op_id = get_next_batch_id(e);
    let token_ids_clone = token_ids.clone();
    // Perform all checks and storage updates first
    for i in 0..token_ids.len() {
        let token_id = token_ids.get(i).unwrap();
        let new_owner = recipients.get(i).unwrap();
        let mut nft = nft::get_educational_nft_safe(e, token_id)?;
        if nft.owner != *caller {
            return Err(NFTError::NotOwner);
        }
        if nft.fractions > 0 {
            let fractional_ownership = nft::get_fractional_ownership_safe(e, token_id)?;
            if !fractional_ownership.can_make_decisions(caller) {
                return Err(NFTError::InsufficientFractionsForTransfer);
            }
        }
        // Update NFT storage
        nft.owner = new_owner.clone();
        nft::store_educational_nft(e, token_id, &nft);
    }
    // Perform Base::transfer calls after storage updates
    for i in 0..token_ids.len() {
        let token_id = token_ids.get(i).unwrap();
        let new_owner = recipients.get(i).unwrap();
        transfer_without_auth(e, caller, &new_owner, token_id as u32)?;
        crate::utils::emit_transfer_event(e, token_id as u32, caller, &new_owner);
    }
    let batch_op = BatchOperation {
        operation_id: op_id,
        operation_type: String::from_str(e, "Transfer"),
        token_ids: token_ids_clone,
        status: OperationStatus::Completed,
    };
    store_batch_operation(e, &batch_op);
    emit_batch_event(
        e,
        op_id,
        &String::from_str(e, "Transfer"),
        OperationStatus::Completed,
    );
    Ok(())
}

pub fn batch_query_ownership(
    e: &Env,
    token_ids: Vec<u64>,
) -> Result<Vec<(u64, nft::EducationalNFT)>, NFTError> {
    let mut results: Vec<(u64, nft::EducationalNFT)> = Vec::new(e);
    for token_id in token_ids.iter() {
        let nft = nft::get_educational_nft_safe(e, token_id)?;
        results.push_back((token_id, nft));
    }
    Ok(results)
}

// Helper function to transfer without requiring auth each time
fn transfer_without_auth(
    e: &Env,
    from: &Address,
    to: &Address,
    token_id: u32,
) -> Result<(), NFTError> {
    // Check ownership
    let owner = Base::owner_of(e, token_id);
    if owner != *from {
        return Err(NFTError::Unauthorized);
    }

    Base::update(e, Some(from), Some(to), token_id);
    // Emit transfer event
    emit_transfer(e, from, to, token_id);

    Ok(())
}
