use crate::nft::get_educational_nft_safe;
use crate::utils::NFTError;
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

pub const SHARE_EVENT: Symbol = symbol_short!("nft_share");
pub const COLLABORATE_EVENT: Symbol = symbol_short!("nft_colab");
pub const SHOWCASE_EVENT: Symbol = symbol_short!("nft_show");
pub const JOIN_GROUP_EVENT: Symbol = symbol_short!("join_grp");
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SocialAction {
    pub token_id: u64,
    pub user: Address,
    pub action_type: String,
    pub group_id: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VisibilityLevel {
    Public,
    GroupOnly,
    Private,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollaborativeGroup {
    pub id: u64,
    pub name: String,
    pub creator: Address,
    pub members: Vec<Address>,
    pub nfts: Vec<u64>,
    pub created_at: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NFTShare {
    pub token_id: u64,
    pub owner: Address,
    pub visibility: VisibilityLevel,
    pub group_id: u64,
    pub shared_at: u64,
    pub description: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EducationalJourney {
    pub user: Address,
    pub collection_id: u64,
    pub showcase_nfts: Vec<u64>,
    pub title: String,
    pub description: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub visibility: VisibilityLevel,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReputationBoost {
    pub user: Address,
    pub reputation_score: u32,
    pub boost_level: u32,
    pub verified_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShareEvent {
    pub token_id: u64,
    pub owner: Address,
    pub visibility: VisibilityLevel,
    pub group_id: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollaborateEvent {
    pub token_id: u64,
    pub user: Address,
    pub group_id: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShowcaseEvent {
    pub user: Address,
    pub collection_id: u64,
    pub nft_count: u32,
    pub timestamp: u64,
}

const SOCIAL_ACTIONS: Symbol = symbol_short!("soc_acts");
const NFT_SHARES: Symbol = symbol_short!("nft_shr");
const COLLABORATIVE_GROUPS: Symbol = symbol_short!("col_grps");
const EDUCATIONAL_JOURNEYS: Symbol = symbol_short!("edu_jrny");
const REPUTATION_BOOSTS: Symbol = symbol_short!("rep_bst");
const GROUP_COUNTER: Symbol = symbol_short!("grp_cnt");

pub fn store_social_action(env: &Env, action: &SocialAction) {
    let key = (SOCIAL_ACTIONS, action.user.clone(), action.token_id);
    let mut actions: Vec<SocialAction> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    actions.push_back(action.clone());
    env.storage().persistent().set(&key, &actions);
}

pub fn get_social_actions(env: &Env, user: &Address, token_id: u64) -> Vec<SocialAction> {
    let key = (SOCIAL_ACTIONS, user.clone(), token_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn store_nft_share(env: &Env, share: &NFTShare) {
    let key = (NFT_SHARES, share.token_id);
    env.storage().persistent().set(&key, share);
}

pub fn get_nft_share(env: &Env, token_id: u64) -> Option<NFTShare> {
    let key = (NFT_SHARES, token_id);
    env.storage().persistent().get(&key)
}

pub fn store_collaborative_group(env: &Env, group: &CollaborativeGroup) {
    let key = (COLLABORATIVE_GROUPS, group.id);
    env.storage().persistent().set(&key, group);
}

pub fn get_collaborative_group(env: &Env, group_id: u64) -> Option<CollaborativeGroup> {
    let key = (COLLABORATIVE_GROUPS, group_id);
    env.storage().persistent().get(&key)
}

pub fn store_educational_journey(env: &Env, journey: &EducationalJourney) {
    let key = (
        EDUCATIONAL_JOURNEYS,
        journey.user.clone(),
        journey.collection_id,
    );
    env.storage().persistent().set(&key, journey);
}

pub fn get_educational_journey(
    env: &Env,
    user: &Address,
    collection_id: u64,
) -> Option<EducationalJourney> {
    let key = (EDUCATIONAL_JOURNEYS, user.clone(), collection_id);
    env.storage().persistent().get(&key)
}

pub fn store_reputation_boost(env: &Env, boost: &ReputationBoost) {
    let key = (REPUTATION_BOOSTS, boost.user.clone());
    env.storage().persistent().set(&key, boost);
}

pub fn get_reputation_boost(env: &Env, user: &Address) -> Option<ReputationBoost> {
    let key = (REPUTATION_BOOSTS, user.clone());
    env.storage().persistent().get(&key)
}

pub fn get_next_group_id(env: &Env) -> u64 {
    let counter = env
        .storage()
        .persistent()
        .get(&GROUP_COUNTER)
        .unwrap_or(0u64);
    let next_id = counter + 1;
    env.storage().persistent().set(&GROUP_COUNTER, &next_id);
    next_id
}

pub fn share_nft(
    env: &Env,
    caller: &Address,
    token_id: u64,
    visibility: String,
    group_id: Option<u64>,
    description: String,
) -> Result<(), NFTError> {
    let nft_data = get_educational_nft_safe(env, token_id)?;
    if nft_data.owner != *caller {
        return Err(NFTError::NotOwner);
    }

    let visibility_level = if visibility == String::from_str(env, "Public") {
        VisibilityLevel::Public
    } else if visibility == String::from_str(env, "GroupOnly") {
        VisibilityLevel::GroupOnly
    } else if visibility == String::from_str(env, "Private") {
        VisibilityLevel::Private
    } else {
        return Err(NFTError::Unauthorized);
    };

    let final_group_id = if visibility_level == VisibilityLevel::GroupOnly {
        let gid = group_id.unwrap_or(0);
        if gid == 0 {
            return Err(NFTError::InvalidCollection);
        }

        let group = get_collaborative_group(env, gid).ok_or(NFTError::InvalidCollection)?;

        if !group.members.contains(caller) && group.creator != *caller {
            return Err(NFTError::Unauthorized);
        }

        gid
    } else {
        group_id.unwrap_or(0)
    };

    let timestamp = env.ledger().timestamp();

    let nft_share = NFTShare {
        token_id,
        owner: caller.clone(),
        visibility: visibility_level.clone(),
        group_id: final_group_id,
        shared_at: timestamp,
        description,
    };

    store_nft_share(env, &nft_share);

    let social_action = SocialAction {
        token_id,
        user: caller.clone(),
        action_type: String::from_str(env, "Share"),
        group_id: final_group_id,
        timestamp,
    };

    store_social_action(env, &social_action);

    let share_event = ShareEvent {
        token_id,
        owner: caller.clone(),
        visibility: visibility_level,
        group_id: final_group_id,
        timestamp,
    };

    env.events().publish((SHARE_EVENT,), share_event);

    Ok(())
}

pub fn join_collaborative_group(
    env: &Env,
    caller: &Address,
    token_id: u64,
    group_id: Option<u64>,
    group_name: Option<String>,
) -> Result<u64, NFTError> {
    let nft_data = get_educational_nft_safe(env, token_id)?;
    if nft_data.owner != *caller {
        return Err(NFTError::NotOwner);
    }

    let timestamp = env.ledger().timestamp();

    let final_group_id = if let Some(gid) = group_id {
        let mut group = get_collaborative_group(env, gid).ok_or(NFTError::InvalidCollection)?;

        if !group.is_active {
            return Err(NFTError::Unauthorized);
        }

        if !group.members.contains(caller) && group.creator != *caller {
            group.members.push_back(caller.clone());
        }

        if !group.nfts.contains(&token_id) {
            group.nfts.push_back(token_id);
        }

        store_collaborative_group(env, &group);
        gid
    } else {
        let group_name = group_name.ok_or(NFTError::InvalidCollection)?;
        let new_group_id = get_next_group_id(env);

        let mut members = Vec::new(env);
        members.push_back(caller.clone());

        let mut nfts = Vec::new(env);
        nfts.push_back(token_id);

        let new_group = CollaborativeGroup {
            id: new_group_id,
            name: group_name,
            creator: caller.clone(),
            members,
            nfts,
            created_at: timestamp,
            is_active: true,
        };

        store_collaborative_group(env, &new_group);
        new_group_id
    };

    let social_action = SocialAction {
        token_id,
        user: caller.clone(),
        action_type: String::from_str(env, "Collaborate"),
        group_id: final_group_id,
        timestamp,
    };

    store_social_action(env, &social_action);

    let collaborate_event = CollaborateEvent {
        token_id,
        user: caller.clone(),
        group_id: final_group_id,
        timestamp,
    };

    env.events()
        .publish((COLLABORATE_EVENT,), collaborate_event);

    Ok(final_group_id)
}

pub fn showcase_collection(
    env: &Env,
    caller: &Address,
    collection_id: u64,
    title: String,
    description: String,
    visibility: String,
) -> Result<(), NFTError> {
    let visibility_level = if visibility == String::from_str(env, "Public") {
        VisibilityLevel::Public
    } else if visibility == String::from_str(env, "Private") {
        VisibilityLevel::Private
    } else {
        return Err(NFTError::Unauthorized);
    };

    let showcase_nfts = Vec::new(env);

    let timestamp = env.ledger().timestamp();

    if let Some(mut existing_journey) = get_educational_journey(env, caller, collection_id) {
        existing_journey.title = title;
        existing_journey.description = description;
        existing_journey.visibility = visibility_level;
        existing_journey.updated_at = timestamp;

        store_educational_journey(env, &existing_journey);
    } else {
        let educational_journey = EducationalJourney {
            user: caller.clone(),
            collection_id,
            showcase_nfts: showcase_nfts.clone(),
            title,
            description,
            created_at: timestamp,
            updated_at: timestamp,
            visibility: visibility_level,
        };

        store_educational_journey(env, &educational_journey);
    }

    let social_action = SocialAction {
        token_id: 0,
        user: caller.clone(),
        action_type: String::from_str(env, "Showcase"),
        group_id: collection_id,
        timestamp,
    };

    store_social_action(env, &social_action);

    let showcase_event = ShowcaseEvent {
        user: caller.clone(),
        collection_id,
        nft_count: showcase_nfts.len(),
        timestamp,
    };

    env.events().publish((SHOWCASE_EVENT,), showcase_event);

    Ok(())
}

pub fn add_nft_to_showcase(
    env: &Env,
    caller: &Address,
    collection_id: u64,
    token_id: u64,
) -> Result<(), NFTError> {
    let nft_data = get_educational_nft_safe(env, token_id)?;
    if nft_data.owner != *caller {
        return Err(NFTError::NotOwner);
    }

    let mut journey =
        get_educational_journey(env, caller, collection_id).ok_or(NFTError::MetadataNotFound)?;

    if !journey.showcase_nfts.contains(&token_id) {
        journey.showcase_nfts.push_back(token_id);
        journey.updated_at = env.ledger().timestamp();

        store_educational_journey(env, &journey);
    }

    Ok(())
}

pub fn get_public_nft_shares(env: &Env) -> Vec<NFTShare> {
    Vec::new(env)
}

pub fn get_user_groups(env: &Env, _user: &Address) -> Vec<CollaborativeGroup> {
    Vec::new(env)
}

pub fn verify_reputation_boost(env: &Env, user: &Address, min_reputation: u32) -> bool {
    if let Some(boost) = get_reputation_boost(env, user) {
        boost.reputation_score >= min_reputation
    } else {
        false
    }
}

pub fn update_reputation_boost(
    env: &Env,
    user: &Address,
    reputation_score: u32,
    boost_level: u32,
) -> Result<(), NFTError> {
    let timestamp = env.ledger().timestamp();

    let reputation_boost = ReputationBoost {
        user: user.clone(),
        reputation_score,
        boost_level,
        verified_at: timestamp,
    };

    store_reputation_boost(env, &reputation_boost);

    Ok(())
}
