#![no_std]
#![allow(linker_messages)]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, panic_with_error, token, Address, Bytes,
    Env, String, Vec,
};

mod errors;
mod events;
mod storage;

pub use errors::PayoutError;
use storage::{DataKey, Storage};

pub const PLATFORM_FEE_PERCENT: i128 = 10;
pub const PERCENT_DENOMINATOR: i128 = 100;
pub const REQUIRED_EVIDENCE_HASH_BYTES: u32 = 32;

#[contractclient(name = "IncomeTokenClient")]
pub trait IncomeToken {
    fn balance(env: Env, id: Address) -> i128;
    fn total_supply(env: Env) -> i128;
    fn holders(env: Env) -> Vec<Address>;
}

#[contractclient(name = "WhitelistClient")]
pub trait Whitelist {
    fn is_approved(env: Env, address: Address) -> bool;
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EvidenceRecord {
    pub cycle_id: String,
    pub evidence_hash: Bytes,
    pub evidence_link: String,
    pub total_income: i128,
    pub recorded_at: u64,
    pub distributed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct DistributionSummary {
    pub cycle_id: String,
    pub total_income: i128,
    pub platform_fee: i128,
    pub holder_amount: i128,
    pub holder_count: u32,
    pub distributed_total: i128,
    pub dust: i128,
}

struct ExecutionGuard<'a> {
    env: &'a Env,
}

impl<'a> ExecutionGuard<'a> {
    fn acquire(env: &'a Env) -> Result<Self, PayoutError> {
        let locked: bool = env
            .storage()
            .instance()
            .get(&DataKey::Guard)
            .unwrap_or(false);
        if locked {
            return Err(PayoutError::Reentrancy);
        }
        env.storage().instance().set(&DataKey::Guard, &true);
        Ok(Self { env })
    }
}

impl Drop for ExecutionGuard<'_> {
    fn drop(&mut self) {
        self.env.storage().instance().set(&DataKey::Guard, &false);
    }
}

#[contract]
pub struct PilotPayoutSplit;

#[contractimpl]
impl PilotPayoutSplit {
    /// Initialize payout configuration, including the two required evidence approvers.
    pub fn initialize(
        env: Env,
        admin: Address,
        operator: Address,
        ally: Address,
        platform_fee_recipient: Address,
        income_token: Address,
        whitelist: Address,
        usdc_token: Address,
    ) {
        if Storage::is_initialized(&env) {
            panic_with_error!(&env, PayoutError::AlreadyInitialized);
        }

        Storage::set_address(&env, &DataKey::Admin, &admin);
        Storage::set_address(&env, &DataKey::Operator, &operator);
        Storage::set_address(&env, &DataKey::Ally, &ally);
        Storage::set_address(
            &env,
            &DataKey::PlatformFeeRecipient,
            &platform_fee_recipient,
        );
        Storage::set_address(&env, &DataKey::IncomeToken, &income_token);
        Storage::set_address(&env, &DataKey::Whitelist, &whitelist);
        Storage::set_address(&env, &DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Guard, &false);

        events::emit_initialized(&env, admin, operator, ally);
    }

    /// Record a monthly income evidence reference and approve the distribution amount.
    ///
    /// Both `operator` and `ally` must sign the same invocation through native Soroban auth.
    pub fn record_evidence(
        env: Env,
        operator: Address,
        ally: Address,
        cycle_id: String,
        evidence_hash: Bytes,
        evidence_link: String,
        total_income: i128,
    ) {
        operator.require_auth();
        ally.require_auth();
        Self::require_operator(&env, &operator);
        Self::require_ally(&env, &ally);
        Self::require_not_paused(&env);

        if total_income <= 0 {
            panic_with_error!(&env, PayoutError::ZeroAmount);
        }

        if evidence_hash.len() != REQUIRED_EVIDENCE_HASH_BYTES {
            panic_with_error!(&env, PayoutError::InvalidEvidenceHash);
        }

        if evidence_link.is_empty() {
            panic_with_error!(&env, PayoutError::MissingEvidenceLink);
        }

        if Storage::evidence(&env, &cycle_id).is_some() {
            panic_with_error!(&env, PayoutError::CycleAlreadyRecorded);
        }

        let record = EvidenceRecord {
            cycle_id: cycle_id.clone(),
            evidence_hash,
            evidence_link,
            total_income,
            recorded_at: env.ledger().timestamp(),
            distributed: false,
        };
        Storage::set_evidence(&env, &cycle_id, &record);
        events::emit_evidence_recorded(&env, operator, ally, cycle_id, total_income);
    }

    /// Execute the approved USDC payout for a cycle.
    pub fn execute_distribution(env: Env, cycle_id: String) -> DistributionSummary {
        Self::require_not_paused(&env);
        let _guard = ExecutionGuard::acquire(&env).unwrap_or_else(|e| panic_with_error!(&env, e));

        let mut record = Storage::evidence(&env, &cycle_id)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::CycleNotRecorded));

        if record.distributed {
            panic_with_error!(&env, PayoutError::CycleAlreadyDistributed);
        }

        let income_token_address = Storage::address(&env, &DataKey::IncomeToken)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let whitelist_address = Storage::address(&env, &DataKey::Whitelist)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let usdc_token_address = Storage::address(&env, &DataKey::UsdcToken)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
        let platform_fee_recipient = Storage::address(&env, &DataKey::PlatformFeeRecipient)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));

        let income_token = IncomeTokenClient::new(&env, &income_token_address);
        let whitelist = WhitelistClient::new(&env, &whitelist_address);
        let usdc = token::Client::new(&env, &usdc_token_address);
        let holders = income_token.holders();
        let total_supply = income_token.total_supply();

        if holders.is_empty() || total_supply <= 0 {
            panic_with_error!(&env, PayoutError::EmptyHolderSet);
        }

        let platform_fee = record
            .total_income
            .checked_mul(PLATFORM_FEE_PERCENT)
            .and_then(|value| value.checked_div(PERCENT_DENOMINATOR))
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));
        let holder_amount = record
            .total_income
            .checked_sub(platform_fee)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));

        let contract_address = env.current_contract_address();
        let contract_balance = usdc.balance(&contract_address);
        if contract_balance < record.total_income {
            panic_with_error!(&env, PayoutError::InsufficientPayoutBalance);
        }

        record.distributed = true;
        Storage::set_evidence(&env, &cycle_id, &record);

        usdc.transfer(&contract_address, &platform_fee_recipient, &platform_fee);

        let mut distributed_total = 0i128;
        for i in 0..holders.len() {
            let holder = holders
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, PayoutError::InternalInvariant));
            if !whitelist.is_approved(&holder) {
                panic_with_error!(&env, PayoutError::RecipientNotApproved);
            }

            let holder_balance = income_token.balance(&holder);
            if holder_balance <= 0 {
                continue;
            }

            let payout = holder_amount
                .checked_mul(holder_balance)
                .and_then(|value| value.checked_div(total_supply))
                .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));

            if payout > 0 {
                distributed_total = distributed_total
                    .checked_add(payout)
                    .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));
                usdc.transfer(&contract_address, &holder, &payout);
            }
        }

        let dust = holder_amount
            .checked_sub(distributed_total)
            .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));

        let summary = DistributionSummary {
            cycle_id: cycle_id.clone(),
            total_income: record.total_income,
            platform_fee,
            holder_amount,
            holder_count: holders.len(),
            distributed_total,
            dust,
        };
        events::emit_distribution_executed(&env, summary.clone());
        summary
    }

    /// Pause evidence recording and distribution execution.
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
        events::emit_paused(&env, admin);
    }

    /// Resume evidence recording and distribution execution.
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        events::emit_unpaused(&env, admin);
    }

    /// Return whether the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        Storage::is_paused(&env)
    }

    /// Return an evidence record for a cycle, if present.
    pub fn get_evidence(env: Env, cycle_id: String) -> Option<EvidenceRecord> {
        Storage::evidence(&env, &cycle_id)
    }

    /// Return a static marker for the deferred EURC swap path.
    pub fn eurc_swap_path_status(env: Env) -> String {
        String::from_str(&env, "stubbed-fast-follow")
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Storage::address(env, &DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::NotInitialized));
        if admin != caller.clone() {
            panic_with_error!(env, PayoutError::Unauthorized);
        }
    }

    fn require_operator(env: &Env, caller: &Address) {
        let operator = Storage::address(env, &DataKey::Operator)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::NotInitialized));
        if operator != caller.clone() {
            panic_with_error!(env, PayoutError::Unauthorized);
        }
    }

    fn require_ally(env: &Env, caller: &Address) {
        let ally = Storage::address(env, &DataKey::Ally)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::NotInitialized));
        if ally != caller.clone() {
            panic_with_error!(env, PayoutError::Unauthorized);
        }
    }

    fn require_not_paused(env: &Env) {
        if Storage::is_paused(env) {
            panic_with_error!(env, PayoutError::ContractPaused);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pilot_income_token::{PilotIncomeToken, PilotIncomeTokenClient};
    use pilot_whitelist::{PilotWhitelist, PilotWhitelistClient};
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        token::StellarAssetClient,
        Error, IntoVal,
    };

    struct Setup {
        env: Env,
        admin: Address,
        operator: Address,
        ally: Address,
        fee_recipient: Address,
        holders: Vec<Address>,
        whitelist_admin: Address,
        whitelist: PilotWhitelistClient<'static>,
        token: PilotIncomeTokenClient<'static>,
        payout: PilotPayoutSplitClient<'static>,
        payout_id: Address,
        usdc: StellarAssetClient<'static>,
    }

    fn evidence_hash(env: &Env) -> Bytes {
        Bytes::from_array(env, &[7u8; 32])
    }

    fn short_hash(env: &Env) -> Bytes {
        Bytes::from_array(env, &[7u8; 12])
    }

    fn cycle(env: &Env, value: &str) -> String {
        String::from_str(env, value)
    }

    fn setup() -> Setup {
        setup_with_balance_values(&[1, 2, 3, 4, 10])
    }

    fn setup_with_balance_values(balance_values: &[i128]) -> Setup {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let ally = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let whitelist_admin = Address::generate(&env);

        let whitelist_id = env.register(PilotWhitelist, ());
        let whitelist = PilotWhitelistClient::new(&env, &whitelist_id);
        whitelist.initialize(&whitelist_admin);

        let mut holders = Vec::new(&env);
        let mut amounts = Vec::new(&env);
        for amount in balance_values {
            let holder = Address::generate(&env);
            whitelist.approve(&whitelist_admin, &holder);
            holders.push_back(holder);
            amounts.push_back(*amount);
        }

        let income_token_id = env.register(PilotIncomeToken, ());
        let token = PilotIncomeTokenClient::new(&env, &income_token_id);
        token.initialize(
            &admin,
            &whitelist_id,
            &String::from_str(&env, "Akkuea Pilot Income"),
            &String::from_str(&env, "AKIN"),
            &7,
        );
        token.mint_fixed_supply(&admin, &holders, &amounts);

        let usdc_admin = Address::generate(&env);
        let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin);
        let usdc = StellarAssetClient::new(&env, &usdc_contract.address());

        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);
        payout.initialize(
            &admin,
            &operator,
            &ally,
            &fee_recipient,
            &income_token_id,
            &whitelist_id,
            &usdc_contract.address(),
        );

        usdc.mint(&payout_id, &100_000);

        Setup {
            env,
            admin,
            operator,
            ally,
            fee_recipient,
            holders,
            whitelist_admin,
            whitelist,
            token,
            payout,
            payout_id,
            usdc,
        }
    }

    fn record_default(s: &Setup) {
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/2026-08"),
            &10_000,
        );
    }

    #[test]
    fn happy_path_distributes_fee_and_uneven_holder_amounts_exactly() {
        let s = setup();
        record_default(&s);

        let summary = s.payout.execute_distribution(&cycle(&s.env, "2026-08"));

        assert_eq!(summary.platform_fee, 1_000);
        assert_eq!(summary.holder_amount, 9_000);
        assert_eq!(summary.distributed_total, 9_000);
        assert_eq!(summary.dust, 0);
        assert_eq!(summary.holder_count, 5);

        assert_eq!(s.usdc.balance(&s.fee_recipient), 1_000);
        assert_eq!(s.usdc.balance(&s.holders.get(0).unwrap()), 450);
        assert_eq!(s.usdc.balance(&s.holders.get(1).unwrap()), 900);
        assert_eq!(s.usdc.balance(&s.holders.get(2).unwrap()), 1_350);
        assert_eq!(s.usdc.balance(&s.holders.get(3).unwrap()), 1_800);
        assert_eq!(s.usdc.balance(&s.holders.get(4).unwrap()), 4_500);

        let record = s.payout.get_evidence(&cycle(&s.env, "2026-08")).unwrap();
        assert!(record.distributed);
    }

    #[test]
    fn revoked_holder_blocks_distribution() {
        let s = setup();
        s.whitelist
            .revoke(&s.whitelist_admin, &s.holders.get(2).unwrap());
        record_default(&s);

        let res = s.payout.try_execute_distribution(&cycle(&s.env, "2026-08"));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::RecipientNotApproved as u32
            )))
        );
    }

    #[test]
    fn insufficient_evidence_hash_is_rejected() {
        let s = setup();

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "bad-hash"),
            &short_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/bad"),
            &10_000,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::InvalidEvidenceHash as u32
            )))
        );
    }

    #[test]
    fn zero_amount_distribution_is_rejected() {
        let s = setup();

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "zero"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/zero"),
            &0,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ZeroAmount as u32
            )))
        );
    }

    #[test]
    fn double_distribution_for_same_cycle_is_rejected() {
        let s = setup();
        record_default(&s);
        s.payout.execute_distribution(&cycle(&s.env, "2026-08"));

        let res = s.payout.try_execute_distribution(&cycle(&s.env, "2026-08"));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::CycleAlreadyDistributed as u32
            )))
        );
    }

    #[test]
    fn double_evidence_record_for_same_cycle_is_rejected() {
        let s = setup();
        record_default(&s);

        let res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "2026-08"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/duplicate"),
            &10_000,
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::CycleAlreadyRecorded as u32
            )))
        );
    }

    #[test]
    fn paused_contract_blocks_record_and_execute() {
        let s = setup();
        s.payout.pause(&s.admin);

        let record_res = s.payout.try_record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "paused"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/paused"),
            &10_000,
        );
        assert_eq!(
            record_res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractPaused as u32
            )))
        );

        let execute_res = s.payout.try_execute_distribution(&cycle(&s.env, "missing"));
        assert_eq!(
            execute_res,
            Err(Ok(Error::from_contract_error(
                PayoutError::ContractPaused as u32
            )))
        );
    }

    #[test]
    fn unpause_restores_execution() {
        let s = setup();
        s.payout.pause(&s.admin);
        s.payout.unpause(&s.admin);

        assert!(!s.payout.is_paused());
        record_default(&s);
        let summary = s.payout.execute_distribution(&cycle(&s.env, "2026-08"));
        assert_eq!(summary.distributed_total, 9_000);
    }

    #[test]
    fn only_admin_can_pause() {
        let s = setup();
        let attacker = Address::generate(&s.env);

        let res = s.payout.try_pause(&attacker);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn insufficient_usdc_balance_rejects_distribution() {
        let s = setup();
        record_default(&s);
        s.usdc.burn(&s.payout_id, &95_000);

        let res = s.payout.try_execute_distribution(&cycle(&s.env, "2026-08"));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                PayoutError::InsufficientPayoutBalance as u32
            )))
        );
    }

    #[test]
    fn single_signer_attempt_is_rejected() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let ally = Address::generate(&env);
        let fee_recipient = Address::generate(&env);
        let income_token = Address::generate(&env);
        let whitelist = Address::generate(&env);
        let usdc = Address::generate(&env);
        let payout_id = env.register(PilotPayoutSplit, ());
        let payout = PilotPayoutSplitClient::new(&env, &payout_id);

        payout.initialize(
            &admin,
            &operator,
            &ally,
            &fee_recipient,
            &income_token,
            &whitelist,
            &usdc,
        );

        let cycle_id = cycle(&env, "single-signer");
        let hash = evidence_hash(&env);
        let link = String::from_str(&env, "ipfs://evidence/single-signer");
        env.mock_auths(&[MockAuth {
            address: &operator,
            invoke: &MockAuthInvoke {
                contract: &payout_id,
                fn_name: "record_evidence",
                args: (
                    operator.clone(),
                    ally.clone(),
                    cycle_id.clone(),
                    hash.clone(),
                    link.clone(),
                    10_000i128,
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = payout.try_record_evidence(&operator, &ally, &cycle_id, &hash, &link, &10_000);

        assert!(res.is_err());
    }

    #[test]
    fn eurc_swap_path_is_stubbed() {
        let s = setup();

        assert_eq!(
            s.payout.eurc_swap_path_status(),
            String::from_str(&s.env, "stubbed-fast-follow")
        );
    }

    #[test]
    fn token_client_surface_is_used_for_distribution() {
        let s = setup();
        assert_eq!(s.token.total_supply(), 20);
        assert_eq!(s.token.holders().len(), 5);
    }

    #[test]
    fn budget_check_execute_distribution_for_ten_holders() {
        let s = setup_with_balance_values(&[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        s.usdc.mint(&s.payout_id, &1_000_000);
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "budget-25"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/budget-25"),
            &325_000,
        );

        s.env.cost_estimate().budget().reset_default();
        let summary = s.payout.execute_distribution(&cycle(&s.env, "budget-25"));
        let cpu = s.env.cost_estimate().budget().cpu_instruction_cost();
        let mem = s.env.cost_estimate().budget().memory_bytes_cost();
        s.env.cost_estimate().budget().print();

        assert_eq!(summary.holder_count, 10);
        assert!(
            cpu <= 120_000_000,
            "execute_distribution CPU budget exceeded"
        );
        assert!(
            mem <= 12_000_000,
            "execute_distribution memory budget exceeded"
        );
    }
}
