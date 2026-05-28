//! Minimal Cougr-compatible ECS runtime for Soroban.
//!
//! Provides a `GameApp` that orchestrates named systems across three
//! schedule stages: PreUpdate (validation), Update (business logic),
//! and PostUpdate (state persistence).

use soroban_sdk::{Address, Env};

use crate::errors::EngineError;

/// Shared world state that ECS systems read from and write to.
///
/// Populated by the caller before `GameApp::run`, then mutated by
/// each system in stage order.
pub struct World {
    // -- Inputs (set before running) --
    pub property_id: u32,
    pub caller: Address,
    pub nft_contract: Address,
    pub token_contract: Address,

    // -- Mutable state (read/written by systems) --
    pub current_level: u32,
    pub next_level: u32,
    pub last_claimed_ledger: u64,
    pub cost: i128,
    pub income: i128,
}

impl World {
    pub fn new(
        property_id: u32,
        caller: Address,
        nft_contract: Address,
        token_contract: Address,
    ) -> Self {
        World {
            property_id,
            caller,
            nft_contract,
            token_contract,
            current_level: 0,
            next_level: 0,
            last_claimed_ledger: 0,
            cost: 0,
            income: 0,
        }
    }
}

/// ECS schedule stages, executed in fixed order.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ScheduleStage {
    PreUpdate,
    Update,
    PostUpdate,
}

/// A system function pointer that operates on the World.
pub type SystemFn = fn(&Env, &mut World) -> Result<(), EngineError>;

/// A named system with a stage assignment.
#[derive(Clone, Copy)]
pub struct NamedSystem {
    pub name: &'static str,
    pub stage: ScheduleStage,
    pub run: SystemFn,
}

/// Builder for creating a `NamedSystem` with a fluent API.
pub struct SystemBuilder {
    name: &'static str,
    run: SystemFn,
}

/// Creates a named system builder. Call `.in_stage()` to assign a stage.
pub fn named_system(name: &'static str, run: SystemFn) -> SystemBuilder {
    SystemBuilder { name, run }
}

impl SystemBuilder {
    pub fn in_stage(self, stage: ScheduleStage) -> NamedSystem {
        NamedSystem {
            name: self.name,
            stage,
            run: self.run,
        }
    }
}

/// GameApp orchestrates system execution across three stages.
///
/// Each stage holds at most one system. Systems are executed in order:
/// PreUpdate → Update → PostUpdate. If any system returns an error,
/// execution stops and the error is propagated.
pub struct GameApp {
    pre_update: Option<NamedSystem>,
    update: Option<NamedSystem>,
    post_update: Option<NamedSystem>,
}

impl GameApp {
    pub fn new() -> Self {
        GameApp {
            pre_update: None,
            update: None,
            post_update: None,
        }
    }

    /// Adds a system to the appropriate stage slot.
    pub fn add_system(&mut self, system: NamedSystem) {
        match system.stage {
            ScheduleStage::PreUpdate => self.pre_update = Some(system),
            ScheduleStage::Update => self.update = Some(system),
            ScheduleStage::PostUpdate => self.post_update = Some(system),
        }
    }

    /// Adds multiple systems at once (convenience method).
    pub fn add_systems(&mut self, systems: &[NamedSystem]) {
        for system in systems {
            self.add_system(*system);
        }
    }

    /// Runs all registered systems in stage order.
    pub fn run(&self, env: &Env, world: &mut World) -> Result<(), EngineError> {
        if let Some(ref sys) = self.pre_update {
            (sys.run)(env, world)?;
        }
        if let Some(ref sys) = self.update {
            (sys.run)(env, world)?;
        }
        if let Some(ref sys) = self.post_update {
            (sys.run)(env, world)?;
        }
        Ok(())
    }
}
