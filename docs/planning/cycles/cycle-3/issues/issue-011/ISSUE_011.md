# Build Investor Portfolio Analytics and Property Reporting

## Description

Upgrade the investor experience with real data-driven portfolio analytics, property performance reporting, and clear trust signals suitable for a professional real estate investment platform.

## Requirements

| Requirement | Description                                       |
| ----------- | ------------------------------------------------- |
| REQ-001     | Replace mock portfolio values with real data      |
| REQ-002     | Add allocation, yield, and position breakdowns    |
| REQ-003     | Present property-level performance context        |
| REQ-004     | Display health and risk indicators where relevant |
| REQ-005     | Support responsive data visualizations            |

## Acceptance Criteria

| Criteria                                  | Validation Method |
| ----------------------------------------- | ----------------- |
| Portfolio page is powered by live data    | Integration test  |
| Property reporting is understandable      | Product review    |
| Visualizations work on desktop and mobile | Manual QA         |
| Key metrics match backend data            | Cross-check test  |

## Files to Create/Modify

| File                          | Action | Purpose                       |
| ----------------------------- | ------ | ----------------------------- |
| `apps/webapp/src/app/`        | Modify | Portfolio and dashboard pages |
| `apps/webapp/src/components/` | Create | Charts and reporting blocks   |
| `apps/webapp/src/hooks/`      | Modify | Investor data queries         |
| `apps/webapp/src/services/`   | Modify | Reporting API integration     |

## Test Requirements

| Test Case                           | Expected Result              |
| ----------------------------------- | ---------------------------- |
| Dashboard loads real portfolio data | Metrics render correctly     |
| Portfolio contains mixed assets     | Aggregations remain accurate |
| Mobile dashboard view               | Charts remain usable         |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-011/ISSUE_011_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Issue ID        | C3-011                                                    |
| Title           | Build investor portfolio analytics and property reporting |
| Area            | WEBAPP                                                    |
| Difficulty      | Medium                                                    |
| Labels          | frontend, analytics, reporting, investor                  |
| Dependencies    | C2-011                                                    |
| Estimated Lines | 180-260                                                   |
