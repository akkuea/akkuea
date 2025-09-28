#[cfg(test)]
pub mod helpers {
    use soroban_sdk::Env;

    pub fn setup_minimal_env() -> Env {
        // Explicitly minimal setup - no snapshots
        Env::default()
    }
}
