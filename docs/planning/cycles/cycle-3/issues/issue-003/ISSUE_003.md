# Add Live Property and Market Updates to the Webapp

## Description

Implement live updates for property status, valuation changes, and lending market data in the investor-facing webapp. The experience should improve confidence and responsiveness without relying on page refreshes.

## Requirements

| Requirement | Description                                           |
| ----------- | ----------------------------------------------------- |
| REQ-001     | Add live updates for property valuation changes       |
| REQ-002     | Update lending and portfolio views in near real time  |
| REQ-003     | Handle reconnects, stale states, and fallback polling |
| REQ-004     | Surface timestamp and freshness indicators            |
| REQ-005     | Avoid disruptive UI shifts during updates             |
| REQ-006     | Preserve mobile performance and accessibility         |

## Acceptance Criteria

| Criteria                                        | Validation Method |
| ----------------------------------------------- | ----------------- |
| Valuation changes appear without manual refresh | UI test           |
| Connection loss degrades gracefully             | Manual QA         |
| Last-updated indicators are visible to the user | UX review         |
| Live updates do not break core flows            | Regression test   |

## Files to Create/Modify

| File                            | Action | Purpose                          |
| ------------------------------- | ------ | -------------------------------- |
| `apps/webapp/src/app/`          | Modify | Surface live property state      |
| `apps/webapp/src/hooks/`        | Create | Realtime subscriptions and cache |
| `apps/webapp/src/services/api/` | Modify | Live update integration          |
| `apps/webapp/src/components/`   | Modify | Freshness and state indicators   |

## Test Requirements

| Test Case                          | Expected Result         |
| ---------------------------------- | ----------------------- |
| New valuation event received       | Relevant card refreshes |
| WebSocket or SSE disconnect occurs | UI falls back safely    |
| Multiple rapid updates arrive      | UI remains stable       |
| Mobile session receives updates    | No layout breakage      |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-003/ISSUE_003_DETAILED.md

## Issue Metadata

| Attribute       | Value                                              |
| --------------- | -------------------------------------------------- |
| Issue ID        | C3-003                                             |
| Title           | Add live property and market updates to the webapp |
| Area            | WEBAPP                                             |
| Difficulty      | Medium                                             |
| Labels          | frontend, realtime, investor-experience, medium    |
| Dependencies    | C2-007                                             |
| Estimated Lines | 140-220                                            |
