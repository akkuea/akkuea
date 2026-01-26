# Add Date and Number Formatting Utilities

## Description

Create utility functions for consistent date and number formatting across the application. These utilities will handle currency formatting, percentage display, date/time formatting, and relative time calculations.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Create currency formatting function |
| REQ-002 | Create percentage formatting function |
| REQ-003 | Create date formatting functions |
| REQ-004 | Create relative time function |
| REQ-005 | Create number abbreviation function |
| REQ-006 | Support locale-aware formatting |
| REQ-007 | Export all utilities from shared library |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| Currency formats correctly | Unit tests |
| Percentages display with correct decimals | Unit tests |
| Dates format in expected format | Unit tests |
| Relative time is human-readable | Unit tests |
| Large numbers abbreviate correctly | Unit tests |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/shared/src/utils/format.ts` | Create | Formatting utilities |
| `apps/shared/src/utils/index.ts` | Modify | Export formatters |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| formatCurrency(1234.56) | "$1,234.56" |
| formatPercent(0.1234) | "12.34%" |
| formatDate(date) | "Jan 15, 2024" |
| formatRelativeTime(pastDate) | "2 hours ago" |
| abbreviateNumber(1500000) | "1.5M" |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-010/ISSUE_010_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-010 |
| Title | Add date and number formatting utilities |
| Area | SHARED |
| Difficulty | Trivial |
| Labels | shared, utilities, trivial |
| Dependencies | None |
| Estimated Lines | 50-80 |
