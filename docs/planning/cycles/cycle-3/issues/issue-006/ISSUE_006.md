# Implement Dividend and Cashflow Distribution

## Description

Implement the contract-side logic required to distribute real estate cashflows to token holders. The design should support professional real estate operations and maintain clear accounting for investor distributions.

## Requirements

| Requirement | Description                                                    |
| ----------- | -------------------------------------------------------------- |
| REQ-001     | Define dividend distribution flow for property owners          |
| REQ-002     | Track distributable amounts and distribution periods           |
| REQ-003     | Support investor claim or proportional allocation              |
| REQ-004     | Emit clear distribution events                                 |
| REQ-005     | Prevent double-claim or incorrect accounting                   |
| REQ-006     | Document operational assumptions for off-chain cash management |

## Acceptance Criteria

| Criteria                                 | Validation Method |
| ---------------------------------------- | ----------------- |
| Distributions can be created and claimed | Contract tests    |
| Shareholder accounting is consistent     | Scenario tests    |
| Duplicate claims are prevented           | Negative tests    |
| Distribution events are emitted          | Event tests       |

## Files to Create/Modify

| File                                             | Action | Purpose                            |
| ------------------------------------------------ | ------ | ---------------------------------- |
| `apps/contracts/contracts/defi-rwa/src/lib.rs`   | Modify | Add dividend flow                  |
| `apps/contracts/contracts/defi-rwa/src/events/`  | Modify | Emit distribution and claim events |
| `apps/contracts/contracts/defi-rwa/src/storage/` | Modify | Persist dividend state             |
| `apps/contracts/contracts/defi-rwa/src/test.rs`  | Modify | Add dividend scenarios             |

## Test Requirements

| Test Case                              | Expected Result                |
| -------------------------------------- | ------------------------------ |
| Create distribution for valid property | Distribution recorded          |
| Investor claims valid distribution     | Correct amount transferred     |
| Investor attempts duplicate claim      | Transaction fails              |
| Property with no eligible holders      | Safe no-op or explicit failure |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-006/ISSUE_006_DETAILED.md

## Issue Metadata

| Attribute       | Value                                        |
| --------------- | -------------------------------------------- |
| Issue ID        | C3-006                                       |
| Title           | Implement dividend and cashflow distribution |
| Area            | CONTRACT                                     |
| Difficulty      | Medium                                       |
| Labels          | smart-contract, real-estate, distributions   |
| Dependencies    | C2-010                                       |
| Estimated Lines | 160-240                                      |
