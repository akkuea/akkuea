use soroban_sdk::{contracttype, symbol_short, Address, Bytes, Env, Symbol};

#[derive(Clone, Copy)]
pub enum ComponentStorage {
    Table,
    Sparse,
}

pub trait ComponentTrait: Sized {
    fn component_type() -> Symbol;
    fn serialize(&self, env: &Env) -> Bytes;
    fn deserialize(env: &Env, data: &Bytes) -> Option<Self>;
    fn default_storage() -> ComponentStorage;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct WorldKey {
    storage: u32,
    component: Symbol,
    entity: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SimpleWorld;

impl SimpleWorld {
    pub fn new(_env: &Env) -> Self {
        Self
    }

    pub fn set_typed<T: ComponentTrait>(&mut self, env: &Env, entity: u32, value: &T) {
        let storage = match T::default_storage() {
            ComponentStorage::Table => 0,
            ComponentStorage::Sparse => 1,
        };
        let key = WorldKey {
            storage,
            component: T::component_type(),
            entity,
        };
        let bytes = value.serialize(env);
        env.storage().persistent().set(&key, &bytes);
        env.storage()
            .persistent()
            .extend_ttl(&key, 518_400, 518_400);
    }

    pub fn get_typed<T: ComponentTrait>(&self, env: &Env, entity: u32) -> Option<T> {
        let storage = match T::default_storage() {
            ComponentStorage::Table => 0,
            ComponentStorage::Sparse => 1,
        };
        let key = WorldKey {
            storage,
            component: T::component_type(),
            entity,
        };
        let bytes: Bytes = env.storage().persistent().get(&key)?;
        T::deserialize(env, &bytes)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ownable {
    ns: Symbol,
}

impl Ownable {
    pub fn new(ns: Symbol) -> Self {
        Self { ns }
    }

    fn key(&self, _env: &Env) -> (Symbol, Symbol) {
        (symbol_short!("owner"), self.ns.clone())
    }

    pub fn initialize(&self, env: &Env, owner: &Address) -> Result<(), ()> {
        let key = self.key(env);
        if env.storage().instance().has(&key) {
            return Err(());
        }
        env.storage().instance().set(&key, owner);
        Ok(())
    }

    pub fn owner(&self, env: &Env) -> Option<Address> {
        env.storage().instance().get(&self.key(env))
    }

    pub fn require_owner(&self, env: &Env, caller: &Address) -> Result<(), ()> {
        match self.owner(env) {
            Some(owner) if owner == *caller => Ok(()),
            _ => Err(()),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Pausable {
    ns: Symbol,
}

impl Pausable {
    pub fn new(ns: Symbol) -> Self {
        Self { ns }
    }

    fn key(&self, _env: &Env) -> (Symbol, Symbol) {
        (symbol_short!("paused"), self.ns.clone())
    }

    pub fn require_not_paused(&self, env: &Env) -> Result<(), ()> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&self.key(env))
            .unwrap_or(false);
        if paused {
            Err(())
        } else {
            Ok(())
        }
    }

    pub fn pause(&self, env: &Env, _admin: &Address) -> Result<(), ()> {
        env.storage().instance().set(&self.key(env), &true);
        Ok(())
    }

    pub fn unpause(&self, env: &Env, _admin: &Address) -> Result<(), ()> {
        env.storage().instance().set(&self.key(env), &false);
        Ok(())
    }
}
