use crate::cougr_compat::{ComponentStorage, ComponentTrait};
use soroban_sdk::xdr::{FromXdr, ToXdr};
use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyCoords {
    pub x: u32,
    pub y: u32,
}

impl ComponentTrait for PropertyCoords {
    fn component_type() -> Symbol {
        symbol_short!("coords")
    }

    fn serialize(&self, env: &Env) -> Bytes {
        (self.x, self.y).to_xdr(env)
    }

    fn deserialize(env: &Env, data: &Bytes) -> Option<Self> {
        let (x, y) = <(u32, u32)>::from_xdr(env, data).ok()?;
        Some(Self { x, y })
    }

    fn default_storage() -> ComponentStorage {
        ComponentStorage::Table
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyOwner {
    pub address: Address,
}

impl ComponentTrait for PropertyOwner {
    fn component_type() -> Symbol {
        symbol_short!("owner")
    }

    fn serialize(&self, env: &Env) -> Bytes {
        self.address.clone().to_xdr(env)
    }

    fn deserialize(env: &Env, data: &Bytes) -> Option<Self> {
        let address = Address::from_xdr(env, data).ok()?;
        Some(PropertyOwner { address })
    }

    fn default_storage() -> ComponentStorage {
        ComponentStorage::Table
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyMeta {
    pub level: u32,
    pub last_claimed_ledger: u64,
    pub approved_spender: u32, // entity id of approved address, 0 if none
}

impl ComponentTrait for PropertyMeta {
    fn component_type() -> Symbol {
        symbol_short!("meta")
    }

    fn serialize(&self, env: &Env) -> Bytes {
        (self.level, self.last_claimed_ledger, self.approved_spender).to_xdr(env)
    }

    fn deserialize(env: &Env, data: &Bytes) -> Option<Self> {
        let (level, last_claimed_ledger, approved_spender) =
            <(u32, u64, u32)>::from_xdr(env, data).ok()?;
        Some(Self {
            level,
            last_claimed_ledger,
            approved_spender,
        })
    }

    fn default_storage() -> ComponentStorage {
        ComponentStorage::Sparse
    }
}
