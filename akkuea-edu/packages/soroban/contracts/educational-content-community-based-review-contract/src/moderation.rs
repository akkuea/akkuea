use crate::utils::{
    get_vote_weight, ModerationFlag, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD,
    MODERATION_FLAGS,
};
use core::option::Option;
use soroban_sdk::{Address, Env, Map, String, Symbol};

pub fn flag_review_impl(env: Env, flagger: Address, review_id: u64, reason: String) {
    flagger.require_auth();

    env.storage().persistent().extend_ttl(
        &MODERATION_FLAGS,
        INSTANCE_LIFETIME_THRESHOLD,
        INSTANCE_BUMP_AMOUNT,
    );
    let mut flags: Map<u64, ModerationFlag> =
        env.storage().persistent().get(&MODERATION_FLAGS).unwrap();

    if flags.contains_key(review_id) {
        panic!("Review already flagged");
    }

    let flag = ModerationFlag {
        review_id,
        flagger: flagger.clone(),
        reason,
        votes_approve: 0,
        votes_reject: 0,
        resolved: false,
        voters: Map::new(&env),
    };

    flags.set(review_id, flag);
    env.storage().persistent().set(&MODERATION_FLAGS, &flags);

    env.events()
        .publish((Symbol::new(&env, "review_flagged"),), (review_id, flagger));
}

pub fn vote_moderation_impl(env: Env, voter: Address, review_id: u64, approve: bool) {
    voter.require_auth();

    env.storage().persistent().extend_ttl(
        &MODERATION_FLAGS,
        INSTANCE_LIFETIME_THRESHOLD,
        INSTANCE_BUMP_AMOUNT,
    );
    let mut flags: Map<u64, ModerationFlag> =
        env.storage().persistent().get(&MODERATION_FLAGS).unwrap();
    let mut flag = flags
        .get(review_id)
        .unwrap_or_else(|| panic!("Flag not found"));

    if flag.resolved {
        panic!("Moderation already resolved");
    }

    if flag.voters.contains_key(voter.clone()) {
        panic!("Voter has already voted");
    }

    let vote_weight = get_vote_weight(&voter, &env);

    if approve {
        flag.votes_approve += vote_weight;
    } else {
        flag.votes_reject += vote_weight;
    }

    flag.voters.set(voter.clone(), true);

    env.events().publish(
        (Symbol::new(&env, "moderation_voted"),),
        (review_id, voter, approve),
    );

    // Resolution logic: require at least 10 total vote weight and a clear majority
    let total_votes = flag.votes_approve + flag.votes_reject;
    if total_votes >= 10
        && ((flag.votes_approve > flag.votes_reject && flag.votes_approve > total_votes / 2)
            || (flag.votes_reject > flag.votes_approve && flag.votes_reject > total_votes / 2))
    {
        flag.resolved = true;
        let outcome = flag.votes_approve > flag.votes_reject; // true if approved for removal

        env.events().publish(
            (Symbol::new(&env, "moderation_resolved"),),
            (review_id, outcome),
        );
    }

    flags.set(review_id, flag.clone());
    env.storage().persistent().set(&MODERATION_FLAGS, &flags);
}

pub fn get_flag_impl(env: Env, review_id: u64) -> Option<ModerationFlag> {
    env.storage().persistent().extend_ttl(
        &MODERATION_FLAGS,
        INSTANCE_LIFETIME_THRESHOLD,
        INSTANCE_BUMP_AMOUNT,
    );
    let flags: Map<u64, ModerationFlag> =
        env.storage().persistent().get(&MODERATION_FLAGS).unwrap();
    flags.get(review_id)
}
