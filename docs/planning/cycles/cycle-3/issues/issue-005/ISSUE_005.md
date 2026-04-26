# Add Platform-Wide Rate Limiting and Abuse Protection

## Description

Implement consistent abuse protection across API endpoints to reduce operational risk, protect infrastructure, and improve security for launch.

## Requirements

| Requirement | Description                                             |
| ----------- | ------------------------------------------------------- |
| REQ-001     | Add reusable rate limiting middleware                   |
| REQ-002     | Support endpoint-specific and global thresholds         |
| REQ-003     | Distinguish between anonymous and authenticated traffic |
| REQ-004     | Return consistent error payloads for throttling         |
| REQ-005     | Add visibility into rate-limit events                   |

## Acceptance Criteria

| Criteria                                                      | Validation Method |
| ------------------------------------------------------------- | ----------------- |
| Sensitive endpoints are rate limited                          | API test          |
| Rate-limit responses are consistent                           | Contract test     |
| Authenticated and unauthenticated limits differ appropriately | Manual review     |

## Files to Create/Modify

| File                       | Action | Purpose                           |
| -------------------------- | ------ | --------------------------------- |
| `apps/api/src/middleware/` | Create | Shared rate limiting middleware   |
| `apps/api/src/routes/`     | Modify | Apply limits to sensitive routes  |
| `apps/shared/src/errors/`  | Modify | Shared throttling error contracts |

## Test Requirements

| Test Case                       | Expected Result          |
| ------------------------------- | ------------------------ |
| Repeated anonymous requests     | `429` returned           |
| Repeated authenticated requests | Limit enforced correctly |
| Normal usage within threshold   | Requests succeed         |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-005/ISSUE_005_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                |
| --------------- | ---------------------------------------------------- |
| Issue ID        | C3-005                                               |
| Title           | Add platform-wide rate limiting and abuse protection |
| Area            | API                                                  |
| Difficulty      | Trivial                                              |
| Labels          | api, security, abuse-protection                      |
| Dependencies    | C1-009                                               |
| Estimated Lines | 80-140                                               |
