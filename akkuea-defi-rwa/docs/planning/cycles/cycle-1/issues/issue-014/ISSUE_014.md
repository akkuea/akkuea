# Add Pagination Types and Utilities

## Description

Create shared pagination types and utility functions for consistent pagination handling across the API and webapp. This includes types for pagination parameters, paginated responses, and helper functions for calculating offsets.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Define PaginationParams interface |
| REQ-002 | Define PaginatedResponse interface |
| REQ-003 | Create pagination calculation utilities |
| REQ-004 | Add default pagination constants |
| REQ-005 | Export from shared library |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| Types are usable in API and webapp | Import verification |
| Utilities calculate correctly | Unit tests |
| Default values are sensible | Code review |
| TypeScript inference works | IDE verification |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/shared/src/types/pagination.ts` | Create | Pagination types |
| `apps/shared/src/utils/pagination.ts` | Create | Pagination utilities |
| `apps/shared/src/types/index.ts` | Modify | Export pagination types |
| `apps/shared/src/utils/index.ts` | Modify | Export pagination utils |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| calculateOffset(2, 20) | 20 |
| calculateTotalPages(100, 20) | 5 |
| calculateTotalPages(101, 20) | 6 |
| Default page size | 20 |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-014/ISSUE_014_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-014 |
| Title | Add pagination types and utilities |
| Area | SHARED |
| Difficulty | Trivial |
| Labels | shared, utilities, trivial |
| Dependencies | None |
| Estimated Lines | 40-60 |
