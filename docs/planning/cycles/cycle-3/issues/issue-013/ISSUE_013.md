# Finalize Oracle Consumer and Price Guardrails in Contracts

## Description

Complete the contract-side pricing integration so lending and real estate flows can rely on external valuations safely. The implementation must include guardrails suitable for production use.

## Requirements

| Requirement | Description                                          |
| ----------- | ---------------------------------------------------- |
| REQ-001     | Finalize oracle consumer wiring in contracts         |
| REQ-002     | Add staleness and invalid-price checks               |
| REQ-003     | Normalize decimals safely                            |
| REQ-004     | Fail closed on invalid or missing pricing            |
| REQ-005     | Ensure borrow and risk paths consume guarded pricing |

## Acceptance Criteria

| Criteria                                | Validation Method |
| --------------------------------------- | ----------------- |
| Valid oracle prices are consumed safely | Contract test     |
| Missing or stale prices are rejected    | Negative test     |
| Decimal normalization is correct        | Precision test    |
| Borrow logic respects guarded prices    | Scenario test     |

## Files to Create/Modify

| File                                                      | Action | Purpose                   |
| --------------------------------------------------------- | ------ | ------------------------- |
| `apps/contracts/contracts/defi-rwa/src/lending/oracle.rs` | Modify | Price guardrails          |
| `apps/contracts/contracts/defi-rwa/src/lib.rs`            | Modify | Contract call integration |
| `apps/contracts/contracts/defi-rwa/src/test.rs`           | Modify | Oracle safety tests       |

## Test Requirements

| Test Case                             | Expected Result                  |
| ------------------------------------- | -------------------------------- |
| Oracle returns fresh valid price      | Borrow flow proceeds             |
| Oracle returns stale or invalid price | Borrow flow fails safely         |
| Decimal mismatch from external source | Normalized value remains correct |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-013/ISSUE_013_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Issue ID        | C3-013                                                     |
| Title           | Finalize oracle consumer and price guardrails in contracts |
| Area            | CONTRACT                                                   |
| Difficulty      | Medium                                                     |
| Labels          | smart-contract, oracle, pricing, lending                   |
| Dependencies    | C3-002                                                     |
| Estimated Lines | 120-180                                                    |
