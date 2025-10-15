use crate::AkkueaPurchaseNFTArgs;
use crate::AkkueaPurchaseNFTClient;
use soroban_sdk::{contractimpl, Address, Env};

#[contractimpl]
impl super::AkkueaPurchaseNFT {
    /// Transfer an NFT to a new owner
    pub fn transfer_nft(env: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();

        let mut nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        if nft.owner != from {
            panic!("Unauthorized: you are not the owner of this NFT");
        }

        // Update owner
        nft.owner = to.clone();
        env.storage().persistent().set(&token_id, &nft);

        // Log the transfer event
        env.events()
            .publish(("transfer", "nft"), (from, to, token_id));
    }

    /// Burn an NFT
    pub fn burn_nft(env: Env, owner: Address, token_id: u32) {
        owner.require_auth();

        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        if nft.owner != owner {
            panic!("Unauthorized: you can't burn this NFT");
        }

        // Remove the NFT from storage
        env.storage().persistent().remove(&token_id);

        // Log the burn event
        env.events().publish(("burn", "nft"), (owner, token_id));
    }

    /// Admin function to recover and redistribute an NFT
    pub fn admin_redistribute_nft(env: Env, admin: Address, token_id: u32, new_owner: Address) {
        Self::check_admin(&env, &admin);
        admin.require_auth();

        let mut nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Update owner
        let previous_owner = nft.owner.clone();
        nft.owner = new_owner.clone();
        env.storage().persistent().set(&token_id, &nft);

        // Log the redistribution event
        env.events().publish(
            ("admin", "redistribute"),
            (admin, previous_owner, new_owner, token_id),
        );
    }
}
