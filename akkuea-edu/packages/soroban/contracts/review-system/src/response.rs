use soroban_sdk::{Address, Env, Vec};

use crate::{
    DataKey, ModerationStatus, Response, ResponseError, ReviewSystemContract, MAX_THREAD_DEPTH,
};

impl ReviewSystemContract {
    /// Update response indices to maintain thread structure
    pub(crate) fn update_response_indices(
        env: &Env,
        review_id: u64,
        parent_response: u64,
        response_id: u64,
    ) {
        // Add to review's response list
        let review_responses_key = DataKey::ResponsesByReview(review_id);
        let mut review_responses: Vec<u64> = env
            .storage()
            .persistent()
            .get(&review_responses_key)
            .unwrap_or(Vec::new(env));
        review_responses.push_back(response_id);
        env.storage()
            .persistent()
            .set(&review_responses_key, &review_responses);

        // If this is a reply to another response, update parent's children list
        if parent_response != 0 {
            let parent_children_key = DataKey::ResponsesByParent(parent_response);
            let mut parent_children: Vec<u64> = env
                .storage()
                .persistent()
                .get(&parent_children_key)
                .unwrap_or(Vec::new(env));
            parent_children.push_back(response_id);
            env.storage()
                .persistent()
                .set(&parent_children_key, &parent_children);
        }
    }

    /// Validate that a parent response exists and belongs to the same review
    pub(crate) fn validate_parent_response(
        env: &Env,
        parent_response: u64,
        review_id: u64,
    ) -> Result<(), ResponseError> {
        let parent: Response = env
            .storage()
            .persistent()
            .get(&DataKey::Response(parent_response))
            .ok_or(ResponseError::InvalidParentResponse)?;

        if parent.review_id != review_id {
            return Err(ResponseError::InvalidParentResponse);
        }

        // Check if parent response is approved (prevent replies to rejected content)
        if parent.moderation_status != ModerationStatus::Approved {
            return Err(ResponseError::ResponseRejected);
        }

        Ok(())
    }

    /// Validate thread depth to prevent excessively deep nesting
    pub(crate) fn validate_thread_depth(
        env: &Env,
        parent_response: u64,
    ) -> Result<(), ResponseError> {
        let mut depth = 0u32;
        let mut current_parent = parent_response;

        // Calculate the current depth of the parent response
        while current_parent != 0 {
            let parent: Response = env
                .storage()
                .persistent()
                .get(&DataKey::Response(current_parent))
                .ok_or(ResponseError::InvalidParentResponse)?;

            current_parent = parent.parent_response;
            depth += 1;
        }

        // Check if adding a new response would exceed the maximum depth
        // The new response would have depth = depth + 1
        if depth + 1 > MAX_THREAD_DEPTH {
            return Err(ResponseError::InvalidParentResponse);
        }

        Ok(())
    }

    /// Get child responses for a given parent response
    pub(crate) fn get_child_responses_impl(
        env: Env,
        parent_response_id: u64,
    ) -> Result<Vec<Response>, ResponseError> {
        let children_key = DataKey::ResponsesByParent(parent_response_id);
        let child_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&children_key)
            .unwrap_or(Vec::new(&env));

        let mut children = Vec::new(&env);
        for child_id in child_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(child_id))
            {
                if response.moderation_status == ModerationStatus::Approved {
                    children.push_back(response);
                }
            }
        }

        Ok(children)
    }

    /// Get the complete thread tree starting from top-level responses for a review
    pub fn get_thread_tree(env: Env, review_id: u64) -> Result<Vec<ThreadNode>, ResponseError> {
        let response_ids_key = DataKey::ResponsesByReview(review_id);
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&response_ids_key)
            .unwrap_or(Vec::new(&env));

        let mut top_level_nodes = Vec::new(&env);

        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                // Only include approved responses and top-level responses
                if response.moderation_status == ModerationStatus::Approved
                    && response.parent_response == 0
                {
                    let node = Self::build_thread_node(&env, response)?;
                    top_level_nodes.push_back(node);
                }
            }
        }

        Ok(top_level_nodes)
    }

    /// Recursively build a thread node with its children
    fn build_thread_node(env: &Env, response: Response) -> Result<ThreadNode, ResponseError> {
        let children_key = DataKey::ResponsesByParent(response.response_id);
        let child_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&children_key)
            .unwrap_or(Vec::new(env));

        let mut children = Vec::new(env);
        for child_id in child_ids.iter() {
            if let Some(child_response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(child_id))
            {
                if child_response.moderation_status == ModerationStatus::Approved {
                    let child_node = Self::build_thread_node(env, child_response)?;
                    children.push_back(child_node);
                }
            }
        }

        Ok(ThreadNode { response, children })
    }

    /// Get responses count for a review
    pub(crate) fn get_response_count_impl(env: Env, review_id: u64) -> u64 {
        let response_ids_key = DataKey::ResponsesByReview(review_id);
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&response_ids_key)
            .unwrap_or(Vec::new(&env));

        let mut count = 0u64;
        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                if response.moderation_status == ModerationStatus::Approved {
                    count += 1;
                }
            }
        }

        count
    }

    /// Get top-level responses (direct replies to review)
    pub(crate) fn get_top_level_responses_impl(
        env: Env,
        review_id: u64,
    ) -> Result<Vec<Response>, ResponseError> {
        let response_ids_key = DataKey::ResponsesByReview(review_id);
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&response_ids_key)
            .unwrap_or(Vec::new(&env));

        let mut top_level_responses = Vec::new(&env);
        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                if response.moderation_status == ModerationStatus::Approved
                    && response.parent_response == 0
                {
                    top_level_responses.push_back(response);
                }
            }
        }

        Ok(top_level_responses)
    }

    /// Delete a response and all its children (admin function)
    pub fn delete_response_thread(env: Env, response_id: u64) -> Result<(), ResponseError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ResponseError::Unauthorized)?;

        admin.require_auth();

        Self::recursively_delete_response(&env, response_id)?;

        Ok(())
    }

    /// Recursively delete a response and all its children
    fn recursively_delete_response(env: &Env, response_id: u64) -> Result<(), ResponseError> {
        // Get the response to delete
        let response: Response = env
            .storage()
            .persistent()
            .get(&DataKey::Response(response_id))
            .ok_or(ResponseError::ResponseNotFound)?;

        // First, delete all children
        let children_key = DataKey::ResponsesByParent(response_id);
        if let Some(child_ids) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u64>>(&children_key)
        {
            for child_id in child_ids.iter() {
                Self::recursively_delete_response(env, child_id)?;
            }
            // Remove the children list
            env.storage().persistent().remove(&children_key);
        }

        // Remove from parent's children list if this isn't a top-level response
        if response.parent_response != 0 {
            let parent_children_key = DataKey::ResponsesByParent(response.parent_response);
            if let Some(siblings) = env
                .storage()
                .persistent()
                .get::<DataKey, Vec<u64>>(&parent_children_key)
            {
                // Remove this response from parent's children
                let mut new_siblings = Vec::new(env);
                for sibling_id in siblings.iter() {
                    if sibling_id != response_id {
                        new_siblings.push_back(sibling_id);
                    }
                }
                if new_siblings.is_empty() {
                    env.storage().persistent().remove(&parent_children_key);
                } else {
                    env.storage()
                        .persistent()
                        .set(&parent_children_key, &new_siblings);
                }
            }
        }

        // Remove from review's response list
        let review_responses_key = DataKey::ResponsesByReview(response.review_id);
        if let Some(review_responses) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u64>>(&review_responses_key)
        {
            let mut new_responses = Vec::new(env);
            for resp_id in review_responses.iter() {
                if resp_id != response_id {
                    new_responses.push_back(resp_id);
                }
            }
            env.storage()
                .persistent()
                .set(&review_responses_key, &new_responses);
        }

        // Finally, delete the response itself
        env.storage()
            .persistent()
            .remove(&DataKey::Response(response_id));

        Ok(())
    }
}

/// Represents a threaded structure of responses
use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone)]
pub struct ThreadNode {
    pub response: Response,
    pub children: Vec<ThreadNode>,
}
