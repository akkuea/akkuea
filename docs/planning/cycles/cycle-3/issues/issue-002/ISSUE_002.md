# Implement Real Estate Valuation Oracle Service

## Description

Build the API-side valuation service that ingests, validates, stores, and exposes real estate pricing inputs used by the platform. The implementation must be designed for real estate assets, not generic commodity or token prices.

## Requirements

| Requirement | Description                                            |
| ----------- | ------------------------------------------------------ |
| REQ-001     | Define oracle price payloads for real estate assets    |
| REQ-002     | Validate freshness, source identity, and price bounds  |
| REQ-003     | Store valuation history for auditability               |
| REQ-004     | Expose internal APIs for latest and historical pricing |
| REQ-005     | Support fallback or manual review paths                |
| REQ-006     | Add source provenance and valuation metadata           |
| REQ-007     | Prepare pricing data for contract consumption          |

## Acceptance Criteria

| Criteria                                          | Validation Method        |
| ------------------------------------------------- | ------------------------ |
| Latest property valuation can be fetched by asset | API test                 |
| Stale or malformed prices are rejected            | Validation test          |
| Historical valuation events are traceable         | Repository test          |
| Source metadata is stored and returned            | Contract/API integration |
| Manual fallback path is documented                | Documentation review     |

## Files to Create/Modify

| File                         | Action | Purpose                                   |
| ---------------------------- | ------ | ----------------------------------------- |
| `apps/api/src/routes/`       | Create | Valuation and oracle endpoints            |
| `apps/api/src/controllers/`  | Create | Valuation orchestration                   |
| `apps/api/src/services/`     | Create | Oracle ingestion and freshness validation |
| `apps/api/src/repositories/` | Create | Price storage and query helpers           |
| `apps/api/src/db/schema/`    | Modify | Persist valuation records                 |
| `apps/shared/src/schemas/`   | Modify | Shared valuation contracts                |

## Test Requirements

| Test Case                                     | Expected Result                    |
| --------------------------------------------- | ---------------------------------- |
| Submit valid valuation payload                | Price stored successfully          |
| Submit stale or out-of-range valuation        | Request rejected                   |
| Request latest valuation for a known property | Current value returned             |
| Request valuation history                     | Ordered history returned           |
| Contract-facing payload generation            | Normalized output is deterministic |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-002/ISSUE_002_DETAILED.md

## Issue Metadata

| Attribute       | Value                                          |
| --------------- | ---------------------------------------------- |
| Issue ID        | C3-002                                         |
| Title           | Implement real estate valuation oracle service |
| Area            | API                                            |
| Difficulty      | High                                           |
| Labels          | api, oracle, real-estate, pricing, production  |
| Dependencies    | C2-012                                         |
| Estimated Lines | 220-320                                        |
