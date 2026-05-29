use super::*;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Map, Symbol};

const OWNERS_KEY: Symbol = symbol_short!("OWNERS");
const APPROVALS_KEY: Symbol = symbol_short!("APPROVALS");
const BALANCES_KEY: Symbol = symbol_short!("BALANCES");
const ALLOWANCES_KEY: Symbol = symbol_short!("ALLOWANCE");

#[contract]
pub struct GamePropertyNft;

#[contractimpl]
impl GamePropertyNft {
    pub fn initialize(env: Env, _treasury: Address) {
        env.storage()
            .instance()
            .set(&OWNERS_KEY, &Map::<u32, Address>::new(&env));
        env.storage()
            .instance()
            .set(&APPROVALS_KEY, &Map::<u32, Address>::new(&env));
    }

    pub fn mint(env: Env, recipient: Address, property_id: u32) {
        let mut owners: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&OWNERS_KEY)
            .unwrap_or_else(|| Map::<u32, Address>::new(&env));
        owners.set(property_id, recipient);
        env.storage().instance().set(&OWNERS_KEY, &owners);
    }

    pub fn approve(env: Env, owner: Address, spender: Address, property_id: u32) {
        owner.require_auth();
        let owners: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&OWNERS_KEY)
            .unwrap_or_else(|| Map::new(&env));
        let current_owner = owners
            .get(property_id)
            .expect("property does not exist");
        if current_owner != owner {
            panic!("not owner");
        }
        let mut approvals: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&APPROVALS_KEY)
            .unwrap_or_else(|| Map::<u32, Address>::new(&env));
        approvals.set(property_id, spender);
        env.storage().instance().set(&APPROVALS_KEY, &approvals);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, property_id: u32) {
        spender.require_auth();
        let owners: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&OWNERS_KEY)
            .unwrap_or_else(|| Map::new(&env));
        let current_owner = owners
            .get(property_id)
            .expect("property does not exist");
        if current_owner != from {
            panic!("not owner");
        }
        let approvals: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&APPROVALS_KEY)
            .unwrap_or_else(|| Map::<u32, Address>::new(&env));
        let approved = approvals
            .get(property_id)
            .expect("not approved");
        if approved != spender {
            panic!("not approved");
        }

        let mut owners: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&OWNERS_KEY)
            .unwrap_or_else(|| Map::<u32, Address>::new(&env));
        owners.set(property_id, to);
        env.storage().instance().set(&OWNERS_KEY, &owners);
    }

    pub fn transfer(env: Env, from: Address, to: Address, property_id: u32) {
        from.require_auth();
        let mut owners: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&OWNERS_KEY)
            .unwrap_or_else(|| Map::new(&env));
        let current_owner = owners
            .get(property_id)
            .expect("property does not exist");
        if current_owner != from {
            panic!("not owner");
        }
        owners.set(property_id, to);
        env.storage().instance().set(&OWNERS_KEY, &owners);
    }

    pub fn get_owner(env: Env, property_id: u32) -> Address {
        let owners: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&OWNERS_KEY)
            .unwrap_or_else(|| Map::<u32, Address>::new(&env));
        owners
            .get(property_id)
            .expect("property does not exist")
    }
}

#[contract]
pub struct GameLandToken;

#[contractimpl]
impl GameLandToken {
    pub fn initialize(env: Env, _admin: Address, _testnet_mode: bool) {
        env.storage()
            .instance()
            .set(&BALANCES_KEY, &Map::<Address, i128>::new(&env));
        env.storage()
            .instance()
            .set(&ALLOWANCES_KEY, &Map::<(Address, Address), i128>::new(&env));
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let mut balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&BALANCES_KEY)
            .unwrap_or_else(|| Map::<Address, i128>::new(&env));
        let balance = balances.get(to.clone()).unwrap_or(0);
        balances.set(to, balance + amount);
        env.storage().instance().set(&BALANCES_KEY, &balances);
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        let mut allowances: Map<(Address, Address), i128> = env
            .storage()
            .instance()
            .get(&ALLOWANCES_KEY)
            .unwrap_or_else(|| Map::<(Address, Address), i128>::new(&env));
        allowances.set((from.clone(), spender), amount);
        env.storage().instance().set(&ALLOWANCES_KEY, &allowances);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let mut balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&BALANCES_KEY)
            .unwrap_or_else(|| Map::<Address, i128>::new(&env));
        let current = balances.get(from.clone()).unwrap_or(0);
        if current < amount {
            panic!("insufficient balance");
        }
        balances.set(from.clone(), current - amount);
        let recipient = balances.get(to.clone()).unwrap_or(0);
        balances.set(to, recipient + amount);
        env.storage().instance().set(&BALANCES_KEY, &balances);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let mut allowances: Map<(Address, Address), i128> = env
            .storage()
            .instance()
            .get(&ALLOWANCES_KEY)
            .unwrap_or_else(|| Map::<(Address, Address), i128>::new(&env));
        let allowance = allowances.get((from.clone(), spender.clone())).unwrap_or(0);
        if allowance < amount {
            panic!("insufficient allowance");
        }
        allowances.set((from.clone(), spender.clone()), allowance - amount);
        env.storage().instance().set(&ALLOWANCES_KEY, &allowances);
        Self::transfer(env.clone(), from, to, amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let balances: Map<Address, i128> = env
            .storage()
            .instance()
            .get(&BALANCES_KEY)
            .unwrap_or_else(|| Map::<Address, i128>::new(&env));
        balances.get(id).unwrap_or(0)
    }
}

struct Setup {
    _env: Env,
    seller: Address,
    buyer: Address,
    marketplace_id: Address,
    marketplace_client: GameMarketplaceClient<'static>,
    _nft_id: Address,
    nft_client: GamePropertyNftClient<'static>,
    _token_id: Address,
    token_client: GameLandTokenClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    #[contract]
    struct DummyAccount;

    let seller = env.register(DummyAccount, ());
    let buyer = env.register(DummyAccount, ());

    let nft_id = env.register(GamePropertyNft, ());
    let nft_client = GamePropertyNftClient::new(&env, &nft_id);
    nft_client.initialize(&seller);

    let token_id = env.register(GameLandToken, ());
    let token_client = GameLandTokenClient::new(&env, &token_id);
    token_client.initialize(&seller, &true);

    let marketplace_id = env.register(GameMarketplace, ());
    let marketplace_client = GameMarketplaceClient::new(&env, &marketplace_id);
    marketplace_client.initialize(&nft_id, &token_id);

    Setup {
        _env: env,
        seller,
        buyer,
        marketplace_id,
        marketplace_client,
        _nft_id: nft_id,
        nft_client,
        _token_id: token_id,
        token_client,
    }
}

fn list_property(setup: &Setup, property_id: u32, price: i128) {
    setup.nft_client.mint(&setup.seller, &property_id);
    setup
        .nft_client
        .approve(&setup.seller, &setup.marketplace_id, &property_id);
    setup
        .marketplace_client
        .list(&setup.seller, &property_id, &price);
}

#[test]
fn list_creates_escrow_and_listing() {
    let setup = setup();
    list_property(&setup, 42, 1_000);

    let owner = setup.nft_client.get_owner(&42);
    assert_eq!(owner, setup.marketplace_id);

    let listing = setup.marketplace_client.get_listing(&42).unwrap();
    assert_eq!(listing.seller, setup.seller);
    assert_eq!(listing.property_id, 42);
    assert_eq!(listing.price_in_land, 1_000);
}

#[test]
fn buy_transfers_nft_and_land_atomically() {
    let setup = setup();
    list_property(&setup, 100, 5_000);

    setup.token_client.mint(&setup.buyer, &5_000);
    setup
        .token_client
        .approve(&setup.buyer, &setup.marketplace_id, &5_000, &0);

    setup.marketplace_client.buy(&setup.buyer, &100);

    let owner = setup.nft_client.get_owner(&100);
    assert_eq!(owner, setup.buyer);
    let seller_balance = setup.token_client.balance(&setup.seller);
    assert_eq!(seller_balance, 5_000);
    assert!(setup.marketplace_client.get_listing(&100).is_none());
}

#[test]
#[should_panic(expected = "insufficient allowance")]
fn buy_fails_with_insufficient_balance() {
    let setup = setup();
    list_property(&setup, 300, 7_000);
    setup.token_client.mint(&setup.buyer, &1_000);
    setup.marketplace_client.buy(&setup.buyer, &300);
}

#[test]
fn cancel_returns_nft_to_seller() {
    let setup = setup();
    list_property(&setup, 77, 2_500);
    setup.marketplace_client.cancel(&setup.seller, &77);

    let owner = setup.nft_client.get_owner(&77);
    assert_eq!(owner, setup.seller);
    assert!(setup.marketplace_client.get_listing(&77).is_none());
}

#[test]
#[should_panic]
fn cancel_fails_if_not_seller() {
    let setup = setup();
    list_property(&setup, 88, 3_000);
    setup.marketplace_client.cancel(&setup.buyer, &88);
}

#[test]
#[should_panic]
fn list_fails_if_not_owner() {
    let setup = setup();
    setup.nft_client.mint(&setup.seller, &123);
    setup
        .nft_client
        .approve(&setup.seller, &setup.marketplace_id, &123);
    setup.marketplace_client.list(&setup.buyer, &123, &1_000);
}

#[test]
#[should_panic(expected = "ListingNotFound")]
fn buy_fails_if_listing_not_found() {
    let setup = setup();
    setup.marketplace_client.buy(&setup.buyer, &999);
}
