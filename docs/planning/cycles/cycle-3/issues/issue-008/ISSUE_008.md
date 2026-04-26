# Implement Risk Monitoring and Liquidation Readiness Service

## Description

Create the backend service that continuously evaluates borrower health, identifies operational risk, and prepares the platform for safe liquidation support and proactive interventions.

## Requirements

| Requirement | Description                                            |
| ----------- | ------------------------------------------------------ |
| REQ-001     | Evaluate health factors across active borrow positions |
| REQ-002     | Detect warning and critical thresholds                 |
| REQ-003     | Record risk state transitions for auditability         |
| REQ-004     | Expose internal views for operations dashboards        |
| REQ-005     | Generate actionable signals for notifications          |
| REQ-006     | Prepare inputs for eventual liquidation execution      |

## Acceptance Criteria

| Criteria                                       | Validation Method |
| ---------------------------------------------- | ----------------- |
| Positions are classified by risk level         | Service test      |
| Threshold transitions are persisted            | Repository test   |
| Monitoring data is available to internal tools | API test          |
| Monitoring handles empty and edge cases        | Unit test         |

## Files to Create/Modify

| File                         | Action | Purpose                       |
| ---------------------------- | ------ | ----------------------------- |
| `apps/api/src/services/`     | Create | Risk monitoring logic         |
| `apps/api/src/routes/`       | Create | Internal monitoring endpoints |
| `apps/api/src/repositories/` | Modify | Monitoring persistence        |
| `apps/api/src/controllers/`  | Modify | Monitoring orchestration      |

## Test Requirements

| Test Case                       | Expected Result              |
| ------------------------------- | ---------------------------- |
| Healthy positions are evaluated | Safe classification returned |
| Warning threshold breached      | Warning state recorded       |
| Critical threshold breached     | Critical state recorded      |
| No positions exist              | Empty result returned safely |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-008/ISSUE_008_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Issue ID        | C3-008                                                      |
| Title           | Implement risk monitoring and liquidation readiness service |
| Area            | API                                                         |
| Difficulty      | Medium                                                      |
| Labels          | api, monitoring, risk, lending                              |
| Dependencies    | C2-012                                                      |
| Estimated Lines | 160-240                                                     |
