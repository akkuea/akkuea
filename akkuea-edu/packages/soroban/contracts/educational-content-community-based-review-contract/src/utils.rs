use soroban_sdk::{contractclient, contracttype, symbol_short, Address, Env, Map, String, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModerationFlag {
    pub review_id: u64,
    pub flagger: Address,
    pub reason: String,
    pub votes_approve: u32,
    pub votes_reject: u32,
    pub resolved: bool,
    pub voters: Map<Address, bool>, // Using Map for efficient voter lookup
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReputationTier {
    New,
    Low,
    Medium,
    High,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReputationData {
    pub reputation_score: u32,
    pub reputation_tier: ReputationTier,
}

#[contractclient(name = "ReputationContractClient")]
pub trait ReputationContract {
    fn get_user_reputation(user: &Address) -> ReputationData;
}

pub(crate) const MODERATION_FLAGS: Symbol = symbol_short!("MOD_FLAGS");
pub(crate) const ADMIN: Symbol = symbol_short!("ADMIN");
pub(crate) const REPUTATION_CONTRACT: Symbol = symbol_short!("REP_CTR");

pub const DAY_IN_LEDGERS: u32 = 17280; // 60*60*24 / 5 seconds per ledger
pub const INSTANCE_BUMP_AMOUNT: u32 = 7 * DAY_IN_LEDGERS;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

pub(crate) fn get_vote_weight(voter: &Address, env: &Env) -> u32 {
    let reputation_contract_id: Address = env
        .storage()
        .persistent()
        .get(&REPUTATION_CONTRACT)
        .unwrap();
    let client = ReputationContractClient::new(env, &reputation_contract_id);
    let reputation = client.get_user_reputation(voter);

    1 + (reputation.reputation_score / 20)
}
