# Add Contract Event Definitions

## Description

Define and implement contract events for the property tokenization and lending contracts. Events enable off-chain services to track on-chain activities such as property registrations, share transfers, deposits, borrows, and liquidations.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Define property registration event |
| REQ-002 | Define share transfer event |
| REQ-003 | Define share purchase event |
| REQ-004 | Define deposit event |
| REQ-005 | Define withdrawal event |
| REQ-006 | Define borrow event |
| REQ-007 | Define repayment event |
| REQ-008 | Define liquidation event |
| REQ-009 | Create event emission helper functions |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| All events compile correctly | cargo build |
| Events contain necessary data | Code review |
| Events are indexed appropriately | Event structure review |
| Helper functions emit events correctly | Unit tests |
| Events are documented | Code review |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/contracts/contracts/defi-rwa/src/events/mod.rs` | Create | Events module |
| `apps/contracts/contracts/defi-rwa/src/events/property.rs` | Create | Property events |
| `apps/contracts/contracts/defi-rwa/src/events/lending.rs` | Create | Lending events |
| `apps/contracts/contracts/defi-rwa/src/lib.rs` | Modify | Add events module |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| Property registration event | Event data matches inputs |
| Share transfer event | From, to, amount correct |
| Deposit event | Pool, amount, shares correct |
| Borrow event | Collateral info included |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-011/ISSUE_011_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-011 |
| Title | Add contract event definitions |
| Area | CONTRACT |
| Difficulty | Medium |
| Labels | smart-contract, soroban, events, medium |
| Dependencies | None |
| Estimated Lines | 80-120 |
