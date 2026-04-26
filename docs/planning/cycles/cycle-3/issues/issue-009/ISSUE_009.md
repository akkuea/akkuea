# Add Audit Log Models and Compliance Export Utilities

## Description

Define shared audit log contracts and export utilities that support internal review, partner diligence, and compliance workflows for tokenized real estate operations.

## Requirements

| Requirement | Description                                              |
| ----------- | -------------------------------------------------------- |
| REQ-001     | Define shared audit event shapes                         |
| REQ-002     | Support operational and investor-facing event categories |
| REQ-003     | Add export-friendly serialization helpers                |
| REQ-004     | Ensure consistent timestamps and actor metadata          |

## Acceptance Criteria

| Criteria                                   | Validation Method |
| ------------------------------------------ | ----------------- |
| Audit event contracts are reusable         | Code review       |
| Export format is deterministic             | Utility tests     |
| Core actor and entity metadata are present | Schema tests      |

## Files to Create/Modify

| File                       | Action | Purpose                      |
| -------------------------- | ------ | ---------------------------- |
| `apps/shared/src/types/`   | Create | Audit types                  |
| `apps/shared/src/schemas/` | Create | Audit event schemas          |
| `apps/shared/src/utils/`   | Create | Compliance export formatting |

## Test Requirements

| Test Case                        | Expected Result         |
| -------------------------------- | ----------------------- |
| Serialize audit event            | Stable export shape     |
| Validate malformed audit payload | Validation failure      |
| Include actor and timestamp data | Required fields present |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-009/ISSUE_009_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                |
| --------------- | ---------------------------------------------------- |
| Issue ID        | C3-009                                               |
| Title           | Add audit log models and compliance export utilities |
| Area            | SHARED                                               |
| Difficulty      | Trivial                                              |
| Labels          | shared, audit, compliance                            |
| Dependencies    | C1-006                                               |
| Estimated Lines | 70-110                                               |
