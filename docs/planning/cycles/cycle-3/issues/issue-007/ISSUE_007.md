# Create Admin Operations Dashboard for Property Verification

## Description

Build a professional operations dashboard that allows the team to review, verify, and manage tokenized real estate inventory before launch and during pilot operations.

## Requirements

| Requirement | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| REQ-001     | Provide review queues for pending properties                 |
| REQ-002     | Show verification status, valuation state, and KYC readiness |
| REQ-003     | Allow operational actions with confirmation flows            |
| REQ-004     | Surface audit-relevant context for reviewers                 |
| REQ-005     | Restrict access to authorized internal users                 |

## Acceptance Criteria

| Criteria                                       | Validation Method   |
| ---------------------------------------------- | ------------------- |
| Operators can review pending properties        | UI test             |
| Verification status is clearly visible         | UX review           |
| Critical actions require explicit confirmation | Manual QA           |
| Unauthorized users cannot access admin views   | Access control test |

## Files to Create/Modify

| File                          | Action | Purpose                            |
| ----------------------------- | ------ | ---------------------------------- |
| `apps/webapp/src/app/`        | Create | Admin dashboard routes             |
| `apps/webapp/src/components/` | Create | Verification workflow components   |
| `apps/webapp/src/services/`   | Modify | Admin API integration              |
| `apps/api/src/routes/`        | Modify | Back internal operations endpoints |

## Test Requirements

| Test Case                              | Expected Result         |
| -------------------------------------- | ----------------------- |
| Reviewer opens pending properties list | Queue renders correctly |
| Reviewer approves or rejects asset     | Status updates persist  |
| Non-admin user accesses admin route    | Access denied           |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-007/ISSUE_007_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Issue ID        | C3-007                                                      |
| Title           | Create admin operations dashboard for property verification |
| Area            | WEBAPP                                                      |
| Difficulty      | Medium                                                      |
| Labels          | frontend, admin, operations, real-estate                    |
| Dependencies    | C2-003                                                      |
| Estimated Lines | 180-260                                                     |
