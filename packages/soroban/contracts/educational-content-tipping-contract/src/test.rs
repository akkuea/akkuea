#![cfg(test)]

use soroban_sdk::{
    log,
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

extern crate alloc;

use crate::{TippingRewardContract, TippingRewardContractClient};

fn create_contract(e: &Env) -> TippingRewardContractClient {
    let contract_id = e.register(TippingRewardContract, ());
    TippingRewardContractClient::new(e, &contract_id)
}

#[test]
fn test_initialize() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let client = create_contract(&e);

    client.initialize(&admin);
    // No panic = success
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let client = create_contract(&e);

    client.initialize(&admin);
    client.initialize(&admin); // This should panic
}

#[test]
fn test_send_tip_and_stats() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let amount = 100;
    let token = Address::generate(&e); // fake token address
    let message = Some(String::from_str(&e, "Great content!"));

    client.send_tip(&sender, &recipient, &amount, &token, &message);

    // Verify educator stats
    let stats = client.get_educator_stats(&recipient).unwrap();
    assert_eq!(stats.total_tips, 1);
    assert_eq!(stats.total_amount, amount);
    assert_eq!(stats.tip_count, 1);

    // Verify tip history
    let history = client.get_tip_history(&recipient).unwrap();
    assert_eq!(history.tips.len(), 1);
    let tip = history.tips.get(0).unwrap();
    assert_eq!(tip.from, sender);
    assert_eq!(tip.to, recipient);
    assert_eq!(tip.amount, amount);
    assert_eq!(tip.token, token);
    assert_eq!(tip.message, message);
}

#[test]
fn test_get_top_educators() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient1 = Address::generate(&e);
    let recipient2 = Address::generate(&e);
    let recipient3 = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send tips in descending order
    client.send_tip(&sender, &recipient2, &200, &token, &None);
    client.send_tip(&sender, &recipient3, &150, &token, &None);
    client.send_tip(&sender, &recipient1, &100, &token, &None);

    let top_educators = client.get_top_educators(&2);

    assert_eq!(top_educators.len(), 2);

    // Verify amounts are in descending order
    let (_, stats1) = top_educators.get(0).unwrap();
    let (_, stats2) = top_educators.get(1).unwrap();
    log!(&e, "Top educators: {:?}, {:?}", stats1, stats2);

    assert_eq!(stats1.total_amount, 200);
    assert_eq!(stats2.total_amount, 150);
    assert_eq!(stats1.tip_count, 1);
    assert_eq!(stats2.tip_count, 1);

    // Verify the addresses are either recipient2 or recipient3
    let (addr1, _) = top_educators.get(0).unwrap();
    let (addr2, _) = top_educators.get(1).unwrap();

    assert!(
        (addr1 == recipient2 && addr2 == recipient3)
            || (addr1 == recipient3 && addr2 == recipient2)
    );
}

#[test]
#[should_panic]
fn test_send_tip_invalid_amount() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    client.send_tip(&sender, &recipient, &0, &token, &None);
}

#[test]
fn test_multiple_tips_same_educator() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send first tip
    client.send_tip(&sender, &recipient, &100, &token, &None);

    // Send second tip
    client.send_tip(&sender, &recipient, &200, &token, &None);

    // Verify stats reflect the latest tip
    let stats = client.get_educator_stats(&recipient).unwrap();
    assert_eq!(stats.total_amount, 300);
    assert_eq!(stats.tip_count, 2);

    // Verify tip history has both tips
    let history = client.get_tip_history(&recipient).unwrap();
    assert_eq!(history.tips.len(), 2);

    let first_tip = history.tips.get(0).unwrap();
    assert_eq!(first_tip.amount, 100);

    let second_tip = history.tips.get(1).unwrap();
    assert_eq!(second_tip.amount, 200);
}

#[test]
fn test_get_top_educators_with_empty_list() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let client = create_contract(&e);
    client.initialize(&admin);

    let top_educators = client.get_top_educators(&5);
    assert_eq!(top_educators.len(), 0);
}

#[test]
fn test_get_top_educators_with_limit_larger_than_educators() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);
    client.send_tip(&sender, &recipient, &100, &token, &None);

    let top_educators = client.get_top_educators(&5);
    assert_eq!(top_educators.len(), 1);

    let (addr, stats) = top_educators.get(0).unwrap();
    assert_eq!(addr, recipient);
    assert_eq!(stats.total_amount, 100);
    assert_eq!(stats.tip_count, 1);
}

#[test]
fn test_tip_with_message() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);
    let message = Some(String::from_str(&e, "Thank you for your help!"));

    client.send_tip(&sender, &recipient, &100, &token, &message);

    let history = client.get_tip_history(&recipient).unwrap();
    let tip = history.tips.get(0).unwrap();
    assert_eq!(tip.message, message);
}

#[test]
fn test_multiple_tokens() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token1 = Address::generate(&e);
    let token2 = Address::generate(&e);

    // Send tips with different tokens
    client.send_tip(&sender, &recipient, &100, &token1, &None);
    client.send_tip(&sender, &recipient, &200, &token2, &None);

    // Verify stats reflect the latest tip
    let stats = client.get_educator_stats(&recipient).unwrap();
    assert_eq!(stats.total_amount, 300);
    assert_eq!(stats.tip_count, 2);

    // Verify tip history has both tips with correct tokens
    let history = client.get_tip_history(&recipient).unwrap();
    assert_eq!(history.tips.len(), 2);

    let first_tip = history.tips.get(0).unwrap();
    assert_eq!(first_tip.token, token1);
    assert_eq!(first_tip.amount, 100);

    let second_tip = history.tips.get(1).unwrap();
    assert_eq!(second_tip.token, token2);
    assert_eq!(second_tip.amount, 200);
}

#[test]
fn test_multiple_senders() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender1 = Address::generate(&e);
    let sender2 = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send tips from different senders
    client.send_tip(&sender1, &recipient, &100, &token, &None);
    client.send_tip(&sender2, &recipient, &200, &token, &None);

    // Verify tip history has both tips with correct senders
    let history = client.get_tip_history(&recipient).unwrap();
    assert_eq!(history.tips.len(), 2);

    let first_tip = history.tips.get(0).unwrap();
    assert_eq!(first_tip.from, sender1);
    assert_eq!(first_tip.amount, 100);

    let second_tip = history.tips.get(1).unwrap();
    assert_eq!(second_tip.from, sender2);
    assert_eq!(second_tip.amount, 200);
}

#[test]
fn test_tip_timestamps() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);
    let initial_timestamp = e.ledger().timestamp();

    // Send first tip
    client.send_tip(&sender, &recipient, &100, &token, &None);

    // Advance time
    e.ledger()
        .with_mut(|l| l.timestamp = initial_timestamp + 1000);

    // Send second tip
    client.send_tip(&sender, &recipient, &200, &token, &None);

    // Verify timestamps in history
    let history = client.get_tip_history(&recipient).unwrap();
    assert_eq!(history.tips.len(), 2);

    let first_tip = history.tips.get(0).unwrap();
    assert_eq!(first_tip.timestamp, initial_timestamp);

    let second_tip = history.tips.get(1).unwrap();
    assert_eq!(second_tip.timestamp, initial_timestamp + 1000);

    // Verify last_tip_timestamp in stats
    let stats = client.get_educator_stats(&recipient).unwrap();
    assert_eq!(stats.last_tip_timestamp, initial_timestamp + 1000);
}

#[test]
fn test_get_educator_stats_nonexistent() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let nonexistent_educator = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    // Verify stats for nonexistent educator
    let stats = client.get_educator_stats(&nonexistent_educator);
    assert!(stats.is_none());
}

#[test]
fn test_get_tip_history_nonexistent() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let nonexistent_educator = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    // Verify history for nonexistent educator
    let history = client.get_tip_history(&nonexistent_educator);
    assert!(history.is_none());
}

#[test]
fn test_update_existing_educator() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send initial tip
    client.send_tip(&sender, &recipient, &100, &token, &None);

    // Send higher tip to same recipient
    client.send_tip(&sender, &recipient, &300, &token, &None);

    // Verify stats reflect the latest tip
    let stats = client.get_educator_stats(&recipient).unwrap();
    assert_eq!(stats.total_amount, 400);
    assert_eq!(stats.tip_count, 2);

    // Verify top educators
    let top_educators = client.get_top_educators(&1);
    assert_eq!(top_educators.len(), 1);
    let (addr, stats) = top_educators.get(0).unwrap();
    assert_eq!(addr, recipient);
    assert_eq!(stats.total_amount, 400);
}

#[test]
fn test_tied_amounts() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient1 = Address::generate(&e);
    let recipient2 = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send same amount to different recipients
    client.send_tip(&sender, &recipient1, &200, &token, &None);
    client.send_tip(&sender, &recipient2, &200, &token, &None);

    // Verify top educators
    let top_educators = client.get_top_educators(&2);
    assert_eq!(top_educators.len(), 2);

    // Both should have the same amount
    let (_, stats1) = top_educators.get(0).unwrap();
    let (_, stats2) = top_educators.get(1).unwrap();
    assert_eq!(stats1.total_amount, 200);
    assert_eq!(stats2.total_amount, 200);
}

#[test]
fn test_update_lower_amount() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient1 = Address::generate(&e);
    let recipient2 = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send initial tips
    client.send_tip(&sender, &recipient1, &300, &token, &None);
    client.send_tip(&sender, &recipient2, &200, &token, &None);

    // Send lower tip to first recipient
    client.send_tip(&sender, &recipient1, &100, &token, &None);

    // Verify top educators order
    let top_educators = client.get_top_educators(&2);
    assert_eq!(top_educators.len(), 2);

    // Second recipient should now be first
    let (addr1, stats1) = top_educators.get(0).unwrap();
    let (addr2, stats2) = top_educators.get(1).unwrap();
    assert_eq!(addr1, recipient1);
    assert_eq!(addr2, recipient2);
    assert_eq!(stats1.total_amount, 400);
    assert_eq!(stats2.total_amount, 200);
}

#[test]
fn test_multiple_updates_same_educator() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send multiple tips to same recipient
    client.send_tip(&sender, &recipient, &100, &token, &None);
    client.send_tip(&sender, &recipient, &200, &token, &None);
    client.send_tip(&sender, &recipient, &300, &token, &None);
    client.send_tip(&sender, &recipient, &400, &token, &None);

    // Verify stats reflect the latest tip
    let stats = client.get_educator_stats(&recipient).unwrap();
    assert_eq!(stats.total_amount, 1000);
    assert_eq!(stats.tip_count, 4);

    // Verify tip history has all tips
    let history = client.get_tip_history(&recipient).unwrap();
    assert_eq!(history.tips.len(), 4);

    // Verify amounts in history
    assert_eq!(history.tips.get(0).unwrap().amount, 100);
    assert_eq!(history.tips.get(1).unwrap().amount, 200);
    assert_eq!(history.tips.get(2).unwrap().amount, 300);
    assert_eq!(history.tips.get(3).unwrap().amount, 400);
}

#[test]
fn test_top_educators_limit() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let mut recipients = Vec::new(&e);
    for _ in 0..5 {
        recipients.push_back(Address::generate(&e));
    }

    let client = create_contract(&e);
    client.initialize(&admin);

    let token = Address::generate(&e);

    // Send tips to 5 recipients
    for (i, recipient) in recipients.iter().enumerate() {
        let amount = ((i + 1) * 100) as i128;
        client.send_tip(&sender, &recipient, &amount, &token, &None);
    }

    // Test different limits
    let top_2 = client.get_top_educators(&2);
    assert_eq!(top_2.len(), 2);
    let (_, stats1) = top_2.get(0).unwrap();
    let (_, stats2) = top_2.get(1).unwrap();
    assert_eq!(stats1.total_amount, 500);
    assert_eq!(stats2.total_amount, 400);

    let top_3 = client.get_top_educators(&3);
    assert_eq!(top_3.len(), 3);
    let (_, stats1) = top_3.get(0).unwrap();
    let (_, stats2) = top_3.get(1).unwrap();
    let (_, stats3) = top_3.get(2).unwrap();
    assert_eq!(stats1.total_amount, 500);
    assert_eq!(stats2.total_amount, 400);
    assert_eq!(stats3.total_amount, 300);
}

#[test]
fn test_create_and_cancel_subscription() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let subscriber = Address::generate(&e);
    let educator = Address::generate(&e);
    let token = Address::generate(&e);
    let client = create_contract(&e);
    client.initialize(&admin);

    let amount = 100;
    let interval = 3600; // 1 hour

    client.create_subscription(&subscriber, &educator, &amount, &token, &interval, &None);

    // Verify subscription exists (by trying to get it, assuming we add a helper getter in lib.rs or test directly from storage)
    // For now, we'll test indirectly by ensuring no panics and then attempting to cancel.
    // A direct getter for subscription would be needed for a robust assertion.

    // Test cancellation
    client.cancel_subscription(&subscriber, &educator);

    // After cancellation, trying to process it should not do anything.
    // (Actual verification would require checking storage, but current contract doesn't expose a getter for single subscription)
}

#[test]
fn test_tip_goal_set_and_achieved() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let educator = Address::generate(&e);
    let token = Address::generate(&e);
    let client = create_contract(&e);
    client.initialize(&admin);

    let goal_amount = 500;
    client.set_tip_goal(&educator, &goal_amount); // Set the goal

    let goal = client.get_tip_goal(&educator).unwrap(); // Get the goal
    assert_eq!(goal.goal_amount, goal_amount); // Verify goal amount
    assert!(!goal.achieved); // Verify not yet achieved

    // Send a tip that is less than the goal
    client.send_tip(&sender, &educator, &300, &token, &None);
    let goal_after_first_tip = client.get_tip_goal(&educator).unwrap();
    assert!(!goal_after_first_tip.achieved); // Still not achieved

    // Send another tip that makes the total amount reach or exceed the goal
    client.send_tip(&sender, &educator, &200, &token, &None); // Total tips for this educator is now 200 (since send_tip overwrites total_amount, not adds)

    // After applying the `send_tip` accumulation fix, this test should pass:
    client.send_tip(&sender, &educator, &300, &token, &None); // total_amount = 300
    client.send_tip(&sender, &educator, &200, &token, &None); // total_amount = 500

    let goal_after_second_tip = client.get_tip_goal(&educator).unwrap();
    log!(&e, "Goal after second tip: {:?}", goal_after_second_tip);
    assert!(goal_after_second_tip.achieved); // Should be achieved
}

#[test]
fn test_trend_report_no_tips() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let educator = Address::generate(&e);
    let client = create_contract(&e);
    client.initialize(&admin);

    let trend_report = client.get_trend_report(&educator, &100);
    assert_eq!(trend_report.len(), 0);
}

#[test]
fn test_analytics_data_collection_and_get() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let educator = Address::generate(&e);
    let token = Address::generate(&e);
    let client = create_contract(&e);
    client.initialize(&admin);

    // Simulate different timestamps
    e.ledger().with_mut(|l| l.timestamp = 100);
    client.send_tip(&sender, &educator, &100, &token, &None); // Analytics: 100 amount at timestamp 100

    e.ledger().with_mut(|l| l.timestamp = 200);
    let sender2 = Address::generate(&e);
    client.send_tip(&sender2, &educator, &150, &token, &None); // Analytics: 150 amount at timestamp 200, new unique tipper

    e.ledger().with_mut(|l| l.timestamp = 300);
    client.send_tip(&sender, &educator, &50, &token, &None); // Analytics: 50 amount at timestamp 300

    let analytics = client.get_analytics(&educator).unwrap(); // Get analytics
    assert_eq!(analytics.total_tips, 3); // Three tips recorded
    assert_eq!(analytics.total_amount, 300); // 100 + 150 + 50 = 300
    assert_eq!(analytics.unique_tippers, 2); // sender and sender2
    assert_eq!(analytics.tips_per_period.len(), 3); // Three entries
    assert_eq!(analytics.tips_per_period.get(0).unwrap(), (100, 100));
    assert_eq!(analytics.tips_per_period.get(1).unwrap(), (200, 150));
    assert_eq!(analytics.tips_per_period.get(2).unwrap(), (300, 50));
}

#[test]
fn test_get_trend_report() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let sender = Address::generate(&e);
    let educator = Address::generate(&e);
    let token = Address::generate(&e);
    let client = create_contract(&e);
    client.initialize(&admin);

    // Populate analytics data
    e.ledger().with_mut(|l| l.timestamp = 100);
    client.send_tip(&sender, &educator, &10, &token, &None);
    e.ledger().with_mut(|l| l.timestamp = 150);
    client.send_tip(&sender, &educator, &20, &token, &None);
    e.ledger().with_mut(|l| l.timestamp = 250);
    client.send_tip(&sender, &educator, &30, &token, &None);
    e.ledger().with_mut(|l| l.timestamp = 300);
    client.send_tip(&sender, &educator, &40, &token, &None);
    e.ledger().with_mut(|l| l.timestamp = 450);
    client.send_tip(&sender, &educator, &50, &token, &None);

    // Test with period of 200 seconds
    // Period 0 (0-199): (100, 10), (150, 20) -> total 30. Period start: 0
    // Period 1 (200-399): (250, 30), (300, 40) -> total 70. Period start: 200
    // Period 2 (400-599): (450, 50) -> total 50. Period start: 400
    let trend_report_200 = client.get_trend_report(&educator, &200);
    assert_eq!(trend_report_200.len(), 3);

    let mut expected_report_200 = Vec::new(&e);
    expected_report_200.push_back((0, 30));
    expected_report_200.push_back((200, 70));
    expected_report_200.push_back((400, 50));

    // Sort both Vecs to ensure order doesn't matter for comparison
    let mut sorted_actual: alloc::vec::Vec<_> = (0..trend_report_200.len())
        .map(|i| trend_report_200.get(i).unwrap())
        .collect();
    sorted_actual.sort_by(|a, b| a.0.cmp(&b.0));

    let mut sorted_expected: alloc::vec::Vec<_> = (0..expected_report_200.len())
        .map(|i| expected_report_200.get(i).unwrap())
        .collect();
    sorted_expected.sort_by(|a, b| a.0.cmp(&b.0));

    assert_eq!(sorted_actual, sorted_expected);

    // Test with period of 100 seconds
    // Period 0 (0-99): None
    // Period 1 (100-199): (100, 10), (150, 20) -> total 30. Period start: 100
    // Period 2 (200-299): (250, 30) -> total 30. Period start: 200
    // Period 3 (300-399): (300, 40) -> total 40. Period start: 300
    // Period 4 (400-499): (450, 50) -> total 50. Period start: 400
    let trend_report_100 = client.get_trend_report(&educator, &100);
    assert_eq!(trend_report_100.len(), 4); // Note: Map might not include periods with 0 tips if not explicitly added

    let mut expected_report_100 = Vec::new(&e);
    expected_report_100.push_back((100, 30));
    expected_report_100.push_back((200, 30));
    expected_report_100.push_back((300, 40));
    expected_report_100.push_back((400, 50));

    let sorted_actual_100: Vec<(i128, i128)> = Vec::new(&e);
    for i in 0..trend_report_100.len() {
        let mut sorted_actual_100: alloc::vec::Vec<_> = (0..trend_report_100.len())
            .map(|i| trend_report_100.get(i).unwrap())
            .collect();
        sorted_actual_100.sort_by(|a, b| a.0.cmp(&b.0));

        let mut sorted_expected_100: alloc::vec::Vec<_> = (0..expected_report_100.len())
            .map(|i| expected_report_100.get(i).unwrap())
            .collect();
        sorted_expected_100.sort_by(|a, b| a.0.cmp(&b.0));

        assert_eq!(sorted_actual_100, sorted_expected_100);
    }
}
